import { storage } from '../../storage-mongodb';
import type { ITelephonyIdentity } from '../../models';
import { encryptTelephonyCredentials } from '../security/credentialEncryption';

/** Never include encryptedCredentials/credentialFields in anything that
 * reaches the frontend — this is the one function every route in this
 * module must funnel identity documents through before res.json(). */
export function publicTelephonyIdentity(identity: ITelephonyIdentity) {
  return {
    id: identity.id,
    tenantId: identity.tenantId,
    userId: identity.userId,
    providerKey: identity.providerKey,
    providerAgentId: identity.providerAgentId,
    registeredNumber: identity.registeredNumber,
    virtualNumber: identity.virtualNumber,
    extension: identity.extension,
    incomingEnabled: identity.incomingEnabled,
    outgoingEnabled: identity.outgoingEnabled,
    status: identity.status,
    hasCredentialsConfigured: Boolean(identity.credentialFields?.length),
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  };
}

export async function getTelephonyIdentity(tenantId: string, userId: string) {
  return storage.getTelephonyIdentityForUser(tenantId, userId);
}

export async function listTelephonyIdentities(tenantId: string) {
  return storage.getTelephonyIdentitiesForTenant(tenantId);
}

export interface TelephonyIdentityWriteInput {
  providerKey?: string;
  providerAgentId?: string;
  registeredNumber?: string;
  virtualNumber?: string;
  extension?: string;
  incomingEnabled?: boolean;
  outgoingEnabled?: boolean;
  status?: ITelephonyIdentity['status'];
  /** Plaintext credentials from the request body — encrypted here, never
   * persisted or echoed back in plaintext. */
  credentials?: Record<string, unknown>;
}

export async function upsertTelephonyIdentity(
  tenantId: string,
  targetUserId: string,
  input: TelephonyIdentityWriteInput,
  actorUserId: string,
) {
  const update: Record<string, unknown> = {
    providerKey: input.providerKey,
    providerAgentId: input.providerAgentId,
    registeredNumber: input.registeredNumber,
    virtualNumber: input.virtualNumber,
    extension: input.extension,
    incomingEnabled: input.incomingEnabled,
    outgoingEnabled: input.outgoingEnabled,
    status: input.status,
  };
  for (const key of Object.keys(update)) {
    if (update[key] === undefined) delete update[key];
  }

  if (input.credentials && Object.keys(input.credentials).length > 0) {
    // AAD binds ciphertext to (tenantId, userId) — the same envelope can't
    // be replayed against a different tenant or user even if the raw
    // ciphertext string leaked from a backup/log.
    update.encryptedCredentials = encryptTelephonyCredentials(
      input.credentials,
      tenantId,
      targetUserId.toLowerCase(),
    );
    update.credentialFields = Object.keys(input.credentials);
  }

  return storage.upsertTelephonyIdentityRecord(tenantId, targetUserId, update, actorUserId);
}
