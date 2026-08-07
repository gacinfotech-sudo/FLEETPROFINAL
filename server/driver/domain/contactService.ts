// TASK-DRIVER-DOMAIN-02 — Driver Contact/Reference model service layer
// (spec §2, the "Contact Data Rule").
import { Driver } from '../../models/index';
import { recordDriverAuditEvent } from './auditLog';
import { DriverContact, DriverContactPolicy, type IDriverContact } from './models';
import {
  DEFAULT_CONTACT_THRESHOLD, HARD_MAX_CONTACTS,
  type ActorRef, type ConsentStatus, type ContactCategory, type NotificationStatus,
} from './types';

export class DriverNotFoundError extends Error {
  constructor() { super('Driver not found.'); this.name = 'DriverNotFoundError'; }
}
export class DuplicateContactPhoneError extends Error {
  constructor(public phone: string) {
    super(`Phone number '${phone}' is already used by another contact for this driver.`);
    this.name = 'DuplicateContactPhoneError';
  }
}
export class ContactPolicyViolationError extends Error {
  constructor(message: string) { super(message); this.name = 'ContactPolicyViolationError'; }
}

async function assertDriverExists(tenantId: string, driverId: string): Promise<void> {
  const exists = await Driver.exists({ _id: driverId, tenantId });
  if (!exists) throw new DriverNotFoundError();
}

// ---------------------------------------------------------------------------
// Tenant contact policy (the ">4 contacts requires businessPurpose" gate).
// ---------------------------------------------------------------------------
export async function getDriverContactPolicy(tenantId: string) {
  const policy = await DriverContactPolicy.findOne({ tenantId }).lean();
  return policy || { tenantId, maxContacts: DEFAULT_CONTACT_THRESHOLD, businessPurpose: undefined };
}

// Acceptance criterion: "A tenant configuring >4 required contacts without
// businessPurpose set is blocked from reaching that configuration" — this
// enforces it AT THE POINT the policy itself is set, not just documented.
export async function setDriverContactPolicy(params: {
  tenantId: string;
  maxContacts: number;
  businessPurpose?: string;
  actor: ActorRef;
}) {
  const { tenantId, maxContacts, businessPurpose, actor } = params;
  if (maxContacts > HARD_MAX_CONTACTS) {
    throw new ContactPolicyViolationError(`maxContacts cannot exceed the hard ceiling of ${HARD_MAX_CONTACTS}.`);
  }
  if (maxContacts > DEFAULT_CONTACT_THRESHOLD && !businessPurpose?.trim()) {
    throw new ContactPolicyViolationError(
      `Configuring more than ${DEFAULT_CONTACT_THRESHOLD} required contacts requires a stated businessPurpose on the tenant policy.`,
    );
  }
  const policy = await DriverContactPolicy.findOneAndUpdate(
    { tenantId },
    { $set: { maxContacts, businessPurpose, updatedBy: actor, updatedAt: new Date() } },
    { new: true, upsert: true },
  );
  return policy;
}

// ---------------------------------------------------------------------------
// Create — duplicate-phone rejection scoped to ONE driver's contact set
// (not a global unique index — the same number legitimately appears across
// different drivers' contact lists, per the spec).
// ---------------------------------------------------------------------------
export async function createDriverContact(params: {
  tenantId: string;
  driverId: string;
  actor: ActorRef;
  fullName: string;
  relationship?: string;
  contactCategory: ContactCategory;
  primaryMobile: string;
  alternateMobile?: string;
  address?: string;
  occupation?: string;
  preferredLanguage?: string;
  emergencyPriority?: number;
  consentStatus?: ConsentStatus;
  notificationStatus?: NotificationStatus;
  notes?: string;
}): Promise<IDriverContact> {
  const { tenantId, driverId, actor } = params;
  await assertDriverExists(tenantId, driverId);

  const activeContacts = await DriverContact.find({ tenantId, driverId, isActive: true }).lean();

  const candidatePhones = [params.primaryMobile, params.alternateMobile].filter(Boolean) as string[];
  for (const contact of activeContacts) {
    const existingPhones = [contact.primaryMobile, contact.alternateMobile].filter(Boolean) as string[];
    const clash = candidatePhones.find((p) => existingPhones.includes(p));
    if (clash) throw new DuplicateContactPhoneError(clash);
  }

  const policy = await getDriverContactPolicy(tenantId);
  const effectiveMax = policy.maxContacts ?? DEFAULT_CONTACT_THRESHOLD;
  const nextCount = activeContacts.length + 1;
  if (nextCount > effectiveMax) {
    throw new ContactPolicyViolationError(
      `This driver already has the tenant-configured maximum of ${effectiveMax} active contacts.`,
    );
  }
  // Contact Data Rule: each contact beyond the default threshold
  // additionally requires consentStatus and notificationStatus to be
  // explicitly set (not left at their unset defaults) before the driver
  // can reach 'approved' — enforced here at creation time for the
  // contacts that trigger it, rather than only at the lifecycle gate, so
  // the requirement can't be silently skipped by never revisiting it.
  if (nextCount > DEFAULT_CONTACT_THRESHOLD) {
    if (!params.consentStatus || !params.notificationStatus) {
      throw new ContactPolicyViolationError(
        `Contact #${nextCount} exceeds the default threshold of ${DEFAULT_CONTACT_THRESHOLD} — consentStatus and notificationStatus must both be explicitly set.`,
      );
    }
  }

  const contact = await DriverContact.create({
    tenantId, driverId,
    fullName: params.fullName,
    relationship: params.relationship,
    contactCategory: params.contactCategory,
    primaryMobile: params.primaryMobile,
    alternateMobile: params.alternateMobile,
    address: params.address,
    occupation: params.occupation,
    preferredLanguage: params.preferredLanguage,
    emergencyPriority: params.emergencyPriority ?? (activeContacts.length + 1),
    consentStatus: params.consentStatus ?? 'not_requested',
    notificationStatus: params.notificationStatus ?? 'not_notified',
    notes: params.notes,
  });

  await recordDriverAuditEvent({
    tenantId, actor, action: 'contact_created', driverId,
    contactId: contact._id.toString(),
    newValue: { fullName: contact.fullName, contactCategory: contact.contactCategory, emergencyPriority: contact.emergencyPriority },
  });

  return contact;
}

// ---------------------------------------------------------------------------
// List — access-tiered. Full list requires DRIVER_CONTACTS_VIEW_FULL (see
// access.ts); a normal Executive-tier viewer gets at most the single
// top-emergencyPriority active contact.
// ---------------------------------------------------------------------------
export async function listDriverContacts(params: {
  tenantId: string; driverId: string; canViewFull: boolean;
}): Promise<IDriverContact[]> {
  const { tenantId, driverId, canViewFull } = params;
  await assertDriverExists(tenantId, driverId);
  const contacts = await DriverContact.find({ tenantId, driverId, isActive: true })
    .sort({ emergencyPriority: 1 })
    .lean();
  if (canViewFull) return contacts as any;
  return contacts.length ? [contacts[0] as any] : [];
}

// ---------------------------------------------------------------------------
// Soft removal — isActive=false + audit entry. No hard delete, ever.
// ---------------------------------------------------------------------------
export async function deactivateDriverContact(params: {
  tenantId: string; driverId: string; contactId: string; actor: ActorRef; reason?: string;
}): Promise<IDriverContact | null> {
  const { tenantId, driverId, contactId, actor, reason } = params;
  const contact = await DriverContact.findOne({ _id: contactId, tenantId, driverId });
  if (!contact) return null;
  if (!contact.isActive) return contact;

  contact.isActive = false;
  await contact.save();

  await recordDriverAuditEvent({
    tenantId, actor, action: 'contact_deactivated', driverId, contactId,
    oldValue: { isActive: true }, newValue: { isActive: false }, reason,
  });

  return contact;
}

export async function setContactVerificationStatus(params: {
  tenantId: string; driverId: string; contactId: string; actor: ActorRef;
  status: 'unverified' | 'pending' | 'verified' | 'rejected';
  verificationMethod?: string;
  reason?: string;
}): Promise<IDriverContact | null> {
  const { tenantId, driverId, contactId, actor, status, verificationMethod, reason } = params;
  const contact = await DriverContact.findOne({ _id: contactId, tenantId, driverId });
  if (!contact) return null;

  const oldStatus = contact.referenceVerificationStatus;
  contact.referenceVerificationStatus = status;
  if (verificationMethod) contact.verificationMethod = verificationMethod;
  if (status === 'verified') {
    contact.verifiedBy = actor;
    contact.verifiedAt = new Date();
  }
  await contact.save();

  await recordDriverAuditEvent({
    tenantId, actor, action: 'contact_verification_status_changed', driverId, contactId,
    oldValue: { referenceVerificationStatus: oldStatus },
    newValue: { referenceVerificationStatus: status },
    reason,
  });

  return contact;
}
