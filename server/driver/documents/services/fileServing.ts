// Activates the security PATTERN behind server/routes.ts:190-220's
// servePrivateTenantFile() for Drive-backed documents.
//
// Why this isn't a literal call into servePrivateTenantFile(): that helper is a
// closure private to registerRoutes() in server/routes.ts (not exported, so it
// cannot be imported from server/driver/documents/**, which this task is
// restricted to), and it serves bytes from a local filesystem baseDir/tenantId/
// filename layout via fs.sendFile — Drive-backed documents have no local file at
// all (Drive holds file bytes only, per GOOGLE-DRIVE-SECURITY-SPEC.md's "Core
// principle"). Re-implementing the exact security SHAPE here — tenant match
// resolved from the authenticated session (never a client-supplied tenant
// param) with a 404 (not 403) on any mismatch so a guessed id can't be used to
// even confirm another tenant's document exists — is the closest honest
// equivalent, and this task's report proposes exporting servePrivateTenantFile
// itself so a future local-cache layer (if ever added) could reuse it directly.
//
// On top of that base pattern this adds two things the generic file helper
// never needed: an access-tier check (accessClassification === 'high' requires
// DRIVER_DOCUMENT_VIEW_HIGH) and an audit-log write on every single access —
// both explicit acceptance criteria for this task.
import type { Response } from 'express';
import type { AuthRequest } from '../../../middleware/auth';
import { getTenantScopedDocument } from './documentService';
import { writeDriverDocumentAudit } from './connectionService';
import { resolveTenantDriveConnection, decryptDriveCredentials } from './connectionService';
import { buildDriveClient } from '../drive/clientFactory';
import { DriveConnectionNotConfiguredError } from './documentService';

export async function serveDriverDocumentFile(
  req: AuthRequest,
  res: Response,
  options: { documentId: string; canViewHigh: boolean; download: boolean },
): Promise<void> {
  const tenantId = req.tenantId;
  if (!tenantId) {
    res.status(403).json({ message: 'Tenant context is required.' });
    return;
  }

  // Tenant scoping resolved ONLY from the authenticated session — never from a
  // request parameter — matching servePrivateTenantFile's own invariant, and a
  // 404 (not 403) on any mismatch/absence so existence in another tenant is
  // never distinguishable from "does not exist at all".
  const document = await getTenantScopedDocument(tenantId, options.documentId);
  if (!document) {
    res.status(404).json({ message: 'Document not found.' });
    return;
  }

  const isHighTier = document.accessClassification === 'high';
  if (isHighTier && !options.canViewHigh) {
    res.status(403).json({ message: 'You do not have permission to view this document.' });
    return;
  }

  const connection = await resolveTenantDriveConnection(tenantId);
  if (!connection || !connection.enabled) {
    res.status(503).json({ message: 'This tenant has no enabled Google Drive connection configured.' });
    return;
  }
  const credentials = decryptDriveCredentials(connection.encryptedCredentials, tenantId, connection.id);
  if (!credentials) {
    res.status(503).json({ message: 'Google Drive credentials are not configured.' });
    return;
  }

  try {
    const client = buildDriveClient(credentials);
    const bytes = await client.downloadFile(document.driveFileId);

    await writeDriverDocumentAudit({
      tenantId,
      userId: req.userId!,
      action: options.download ? 'document.downloaded' : 'document.viewed',
      driverId: String(document.driverId),
      documentId: document.id,
    });

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const disposition = options.download ? 'attachment' : 'inline';
    // Filename derived only from document type/version — never the raw uploaded
    // filename or any PII field — matches this repo's existing safe-filename
    // convention (see server/routes.ts's SAFE_IMAGE_EXTENSIONS comment).
    const safeFilename = `${document.documentType}-v${document.currentVersionNumber}${extensionFor(document.mimeType)}`;
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeFilename}"`);
    res.send(bytes);
  } catch (error) {
    if (error instanceof DriveConnectionNotConfiguredError) {
      res.status(503).json({ message: error.message });
      return;
    }
    res.status(502).json({ message: 'Failed to retrieve the document from Google Drive.' });
  }
}

function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  return map[mimeType] || '';
}
