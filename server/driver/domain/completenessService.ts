// Zero-block onboarding — Profile Completeness engine
// (docs/driver-recovery/DRIVER-ZERO-BLOCK-ONBOARDING-REPORT.md §3-4).
//
// This is informational only. Nothing in this file ever blocks Driver
// creation, save, or onboarding — it only computes advisory scores for a
// reminder UI to display. See eligibility.ts for the one place this
// codebase legitimately gates something (assignment readiness), which is
// a separate, narrower concern this file does not touch.
//
// Cross-task extensibility, same pattern as eligibility.ts's
// registerEligibilityCheck: TASK-DRIVER-DOCUMENTS-03 owns the
// DriverDocument model, which doesn't exist in this branch. Rather than
// creating a cross-task compile dependency on code that isn't here, that
// task (or a later Integrator pass) registers its own section via
// registerCompletenessSection() once merged, without editing this file.
import { Driver } from '../../models/index';
import { DriverContact } from './models';
import { DriverEmploymentHistory } from './models';
import { effectiveLifecycleStage } from './types';
import { DEFAULT_CONTACT_THRESHOLD, MIN_EMERGENCY_CONTACTS, MIN_VERIFIED_REFERENCES } from './types';

// A previous-employment target of 3 mirrors the onboarding spec's "always
// show 3 employer slots" UI requirement (§9) — the UI redesign to actually
// show 3 fixed slots is separate, not-yet-done follow-up work; this engine
// scores against the same target so the two land on the same number once
// both exist.
const EMPLOYMENT_HISTORY_TARGET = 3;
// Two address sections exist on the base Driver record today
// (permanentAddress, currentAddress). A third ("Temporary/Local", spec
// §8) does not exist as a field anywhere in this codebase yet — scored
// out of 2, not 3, so this engine never reports a phantom missing field
// for something that was never built. Revisit this constant if/when that
// third field lands.
const ADDRESS_SECTIONS_AVAILABLE = 2;

export interface CompletenessSection {
  label: string;
  completed: number;
  target: number;
  /** Free-text status for sections that aren't simple counts (e.g. "Pending"). */
  status?: string;
}

export interface DriverCompleteness {
  driverId: string;
  overallPercent: number;
  sections: Record<string, CompletenessSection>;
  /** Human-readable list of what's missing/pending, for a reminder popup. */
  missing: string[];
}

export type CompletenessSectionCheck = (
  tenantId: string,
  driverId: string,
) => Promise<CompletenessSection & { key: string; missingLabel?: string }>;

const additionalSections: CompletenessSectionCheck[] = [];

/** Called by other driver-lifecycle tasks to extend this engine without editing this file. */
export function registerCompletenessSection(check: CompletenessSectionCheck): void {
  additionalSections.push(check);
}

export class DriverNotFoundError extends Error {
  constructor() {
    super('Driver not found.');
    this.name = 'DriverNotFoundError';
  }
}

function percent(section: CompletenessSection): number {
  if (section.target <= 0) return 100;
  return Math.min(100, Math.round((section.completed / section.target) * 100));
}

export async function computeDriverCompleteness(tenantId: string, driverId: string): Promise<DriverCompleteness> {
  const driver = await Driver.findOne({ _id: driverId, tenantId }).lean();
  if (!driver) throw new DriverNotFoundError();

  const [contacts, employmentEntries] = await Promise.all([
    DriverContact.find({ tenantId, driverId, isActive: true }).lean(),
    DriverEmploymentHistory.find({ tenantId, driverId, isActive: true }).lean(),
  ]);

  const sections: Record<string, CompletenessSection> = {};
  const missing: string[] = [];

  // Contacts — target is the same standing 10 the zero-block policy
  // configures as the tenant's contact target (§6), not a requirement.
  sections.contacts = { label: 'Contacts', completed: contacts.length, target: DEFAULT_CONTACT_THRESHOLD };
  if (contacts.length < MIN_EMERGENCY_CONTACTS) {
    missing.push(`${MIN_EMERGENCY_CONTACTS - contacts.length} more emergency contact record(s) recommended`);
  }
  const verifiedReferences = contacts.filter((c) => c.referenceVerificationStatus === 'verified').length;
  if (verifiedReferences < MIN_VERIFIED_REFERENCES) {
    missing.push(`${MIN_VERIFIED_REFERENCES - verifiedReferences} more verified reference(s) recommended`);
  }

  // Addresses — scored against what actually exists on the Driver record
  // today (see ADDRESS_SECTIONS_AVAILABLE's comment above).
  let addressesFilled = 0;
  if ((driver as any).permanentAddress?.trim()) addressesFilled += 1;
  else missing.push('Permanent address');
  if ((driver as any).currentAddress?.trim()) addressesFilled += 1;
  else missing.push('Current address');
  sections.addresses = { label: 'Addresses', completed: addressesFilled, target: ADDRESS_SECTIONS_AVAILABLE };

  // Previous employment — scored against the 3-employer target even
  // though the UI doesn't yet show 3 fixed slots (see constant comment).
  sections.employment = {
    label: 'Previous Employers',
    completed: Math.min(employmentEntries.length, EMPLOYMENT_HISTORY_TARGET),
    target: EMPLOYMENT_HISTORY_TARGET,
  };
  if (employmentEntries.length < EMPLOYMENT_HISTORY_TARGET) {
    missing.push(`${EMPLOYMENT_HISTORY_TARGET - employmentEntries.length} previous employer record(s) pending`);
  }

  // Lifecycle stage — informational status, not a completed/target count.
  const stage = effectiveLifecycleStage(driver as any);
  sections.lifecycle = { label: 'Lifecycle Stage', completed: stage === 'active' ? 1 : 0, target: 1, status: stage };

  // Extension sections (documents, Google Drive/Sheet, compliance —
  // registered by other tasks once their models exist in this branch).
  for (const check of additionalSections) {
    try {
      const result = await check(tenantId, driverId);
      sections[result.key] = { label: result.label, completed: result.completed, target: result.target, status: result.status };
      if (result.completed < result.target && result.missingLabel) missing.push(result.missingLabel);
    } catch {
      // An extension section failing to compute must never break the
      // core (already-verified) sections above, and must never look like
      // a block — skip it silently rather than fail the whole request.
    }
  }

  const sectionValues = Object.values(sections);
  const overallPercent = sectionValues.length
    ? Math.round(sectionValues.reduce((sum, s) => sum + percent(s), 0) / sectionValues.length)
    : 0;

  return { driverId, overallPercent, sections, missing };
}
