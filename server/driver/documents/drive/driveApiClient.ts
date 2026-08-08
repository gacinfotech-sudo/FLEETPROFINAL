// Thin client against the real Google Drive API v3 REST contract
// (https://developers.google.com/drive/api/reference/rest/v3), built on global
// fetch rather than the `googleapis` SDK — see serviceAccountAuth.ts for why.
// Every request sets supportsAllDrives=true and, where relevant, scopes list
// queries to a specific Shared Drive (corpora=drive) — Shared Drive support is
// off by default in the Drive API and must be explicitly requested, and is the
// whole reason this module uses a Shared Drive rather than My Drive (see
// GOOGLE-DRIVE-SECURITY-SPEC.md's "Connection model").
import type { AccessTokenProvider } from './serviceAccountAuth';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  md5Checksum?: string;
  size?: string;
  parents?: string[];
  trashed?: boolean;
}

export interface DrivePermission {
  id: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: string;
}

export class DriveApiError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: string) {
    super(message);
    this.name = 'DriveApiError';
  }
}

export class DrivePublicSharingDetectedError extends Error {
  constructor(readonly fileId: string, readonly permissionIds: string[]) {
    super(`Drive file ${fileId} had a public ("anyone") permission; it was removed automatically.`);
    this.name = 'DrivePublicSharingDetectedError';
  }
}

export interface DriveClient {
  /** Finds a folder by exact name under parentId within the given Shared Drive,
   * creating it if it doesn't exist. Idempotent — safe to call on every
   * connect/upload rather than caching folder ids client-side, which matters
   * because two concurrent requests must never create two sibling folders with
   * the same name. */
  ensureFolder(name: string, parentId: string, sharedDriveId: string): Promise<string>;
  uploadFile(params: {
    name: string;
    parentId: string;
    sharedDriveId: string;
    mimeType: string;
    content: Buffer;
  }): Promise<DriveFileMetadata>;
  getFileMetadata(fileId: string): Promise<DriveFileMetadata>;
  downloadFile(fileId: string): Promise<Buffer>;
  listPermissions(fileId: string): Promise<DrivePermission[]>;
  deletePermission(fileId: string, permissionId: string): Promise<void>;
  /** Defensive check called right after every upload — GOOGLE-DRIVE-SECURITY-SPEC.md's
   * "No public/anyone-with-the-link sharing" rule enforced as a real runtime check,
   * not just an assumption that Shared Drive defaults are safe. Removes any 'anyone'
   * permission found and throws DrivePublicSharingDetectedError so the caller can
   * alert/audit-log it — this should never fire in normal operation. */
  assertNoPublicPermission(fileId: string): Promise<void>;
  getSharedDriveMetadata(sharedDriveId: string): Promise<{ id: string; name: string }>;
}

async function driveFetch(
  tokenProvider: AccessTokenProvider,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await tokenProvider.getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new DriveApiError(`Drive API request failed: ${init.method || 'GET'} ${url} -> ${response.status}`, response.status, body.slice(0, 500));
  }
  return response;
}

export class GoogleDriveRestClient implements DriveClient {
  constructor(private readonly tokenProvider: AccessTokenProvider) {}

  async ensureFolder(name: string, parentId: string, sharedDriveId: string): Promise<string> {
    const escapedName = name.replace(/[\\']/g, '\\$&');
    const q = `name='${escapedName}' and '${parentId}' in parents and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`;
    const listUrl = `${DRIVE_API_BASE}/files?` + new URLSearchParams({
      q,
      corpora: 'drive',
      driveId: sharedDriveId,
      includeItemsFromAllDrives: 'true',
      supportsAllDrives: 'true',
      fields: 'files(id,name)',
    }).toString();
    const listRes = await driveFetch(this.tokenProvider, listUrl);
    const listBody = await listRes.json() as { files?: { id: string; name: string }[] };
    if (listBody.files && listBody.files.length > 0) {
      return listBody.files[0].id;
    }

    const createUrl = `${DRIVE_API_BASE}/files?supportsAllDrives=true&fields=id`;
    const createRes = await driveFetch(this.tokenProvider, createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE, parents: [parentId] }),
    });
    const created = await createRes.json() as { id: string };
    return created.id;
  }

  async uploadFile(params: { name: string; parentId: string; sharedDriveId: string; mimeType: string; content: Buffer }): Promise<DriveFileMetadata> {
    const boundary = `fleetpro-drive-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const metadata = JSON.stringify({ name: params.name, parents: [params.parentId] });
    const preamble =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${params.mimeType}\r\n\r\n`;
    const closing = `\r\n--${boundary}--`;
    const body = Buffer.concat([Buffer.from(preamble, 'utf8'), params.content, Buffer.from(closing, 'utf8')]);

    const uploadUrl = `${DRIVE_UPLOAD_BASE}/files?` + new URLSearchParams({
      uploadType: 'multipart',
      supportsAllDrives: 'true',
      fields: 'id,name,mimeType,md5Checksum,size,parents',
    }).toString();
    const res = await driveFetch(this.tokenProvider, uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return res.json() as Promise<DriveFileMetadata>;
  }

  async getFileMetadata(fileId: string): Promise<DriveFileMetadata> {
    const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?` + new URLSearchParams({
      supportsAllDrives: 'true',
      fields: 'id,name,mimeType,md5Checksum,size,parents,trashed',
    }).toString();
    const res = await driveFetch(this.tokenProvider, url);
    return res.json() as Promise<DriveFileMetadata>;
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
    const res = await driveFetch(this.tokenProvider, url);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async listPermissions(fileId: string): Promise<DrivePermission[]> {
    const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/permissions?` + new URLSearchParams({
      supportsAllDrives: 'true',
      fields: 'permissions(id,type,role)',
    }).toString();
    const res = await driveFetch(this.tokenProvider, url);
    const body = await res.json() as { permissions?: DrivePermission[] };
    return body.permissions || [];
  }

  async deletePermission(fileId: string, permissionId: string): Promise<void> {
    const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}?supportsAllDrives=true`;
    await driveFetch(this.tokenProvider, url, { method: 'DELETE' });
  }

  async assertNoPublicPermission(fileId: string): Promise<void> {
    const permissions = await this.listPermissions(fileId);
    const publicPermissions = permissions.filter((p) => p.type === 'anyone');
    if (publicPermissions.length === 0) return;
    await Promise.all(publicPermissions.map((p) => this.deletePermission(fileId, p.id)));
    throw new DrivePublicSharingDetectedError(fileId, publicPermissions.map((p) => p.id));
  }

  async getSharedDriveMetadata(sharedDriveId: string): Promise<{ id: string; name: string }> {
    const url = `${DRIVE_API_BASE}/drives/${encodeURIComponent(sharedDriveId)}?fields=id,name`;
    const res = await driveFetch(this.tokenProvider, url);
    return res.json() as Promise<{ id: string; name: string }>;
  }
}
