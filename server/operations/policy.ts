// Booking End Reminder policy — resolves a tenant's configured reminder
// stages (Settings → Operations → Booking End Reminders) over the built-in
// defaults. Pure data + small helpers; no DB access here.

export interface ReminderStage {
  minutesBefore: number;
  enabled: boolean;
  whatsappInternal?: boolean;
  whatsappCustomer?: boolean; // self-drive only
  whatsappDriver?: boolean;   // with-driver only
}

export interface OperationsPolicy {
  timezone: string;
  graceMinutes: number;
  turnaroundBufferMinutes: number;
  notifyOwner: boolean;
  notifyAssignedUser: boolean;
  selfDriveStages: ReminderStage[];
  withDriverStages: ReminderStage[];
  whatsappInternalPhone?: string;
}

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

// Default escalation ladder (spec §11-12): 3h/2h/90m CRM, 60m CRM +
// internal WhatsApp, 30m CRM. End-time and overdue alerts always fire —
// they are not stages a tenant can disable, only the grace is tunable.
export const DEFAULT_SELF_DRIVE_STAGES: ReminderStage[] = [
  { minutesBefore: 180, enabled: true },
  { minutesBefore: 120, enabled: true },
  { minutesBefore: 90, enabled: true },
  { minutesBefore: 60, enabled: true, whatsappInternal: true },
  { minutesBefore: 30, enabled: true },
];

export const DEFAULT_WITH_DRIVER_STAGES: ReminderStage[] = [
  { minutesBefore: 180, enabled: true },
  { minutesBefore: 120, enabled: true },
  { minutesBefore: 60, enabled: true, whatsappInternal: true },
  { minutesBefore: 30, enabled: true },
];

export function resolvePolicy(tenant: any): OperationsPolicy {
  const s = tenant?.operationsSettings || {};
  const normalizeStages = (stages: any[] | undefined, fallback: ReminderStage[]): ReminderStage[] => {
    if (!Array.isArray(stages) || stages.length === 0) return fallback;
    return stages
      .filter((st) => Number.isFinite(st?.minutesBefore) && st.minutesBefore >= 5 && st.minutesBefore <= 24 * 60)
      .map((st) => ({
        minutesBefore: Math.round(st.minutesBefore),
        enabled: st.enabled !== false,
        whatsappInternal: !!st.whatsappInternal,
        whatsappCustomer: !!st.whatsappCustomer,
        whatsappDriver: !!st.whatsappDriver,
      }))
      .sort((a, b) => b.minutesBefore - a.minutesBefore);
  };
  return {
    timezone: typeof tenant?.timezone === 'string' && tenant.timezone ? tenant.timezone : DEFAULT_TIMEZONE,
    graceMinutes: Number.isFinite(s.graceMinutes) ? Math.max(0, Math.min(24 * 60, s.graceMinutes)) : 15,
    turnaroundBufferMinutes: Number.isFinite(s.turnaroundBufferMinutes) ? Math.max(0, Math.min(24 * 60, s.turnaroundBufferMinutes)) : 60,
    notifyOwner: s.notifyOwner !== false,
    notifyAssignedUser: s.notifyAssignedUser !== false,
    selfDriveStages: normalizeStages(s.selfDriveStages, DEFAULT_SELF_DRIVE_STAGES),
    withDriverStages: normalizeStages(s.withDriverStages, DEFAULT_WITH_DRIVER_STAGES),
    whatsappInternalPhone: s.whatsappInternalPhone || tenant?.phone || undefined,
  };
}

// Every non-self_drive bookingType (with_driver plus the legacy shape
// values one_way/round_trip/local/airport) operationally means a company
// driver drives — the same rule liveOperations.ts's driverMissing() uses.
export function serviceModeOf(booking: any): 'self_drive' | 'with_driver' {
  return booking?.bookingType === 'self_drive' ? 'self_drive' : 'with_driver';
}

export function stagesFor(policy: OperationsPolicy, mode: 'self_drive' | 'with_driver'): ReminderStage[] {
  return mode === 'self_drive' ? policy.selfDriveStages : policy.withDriverStages;
}

export function priorityForStage(minutesBefore: number): 'info' | 'attention' | 'urgent' {
  if (minutesBefore >= 120) return 'info';
  if (minutesBefore > 30) return 'attention';
  return 'urgent';
}

// Tenant-local display string for reminder messages and card headers —
// reminders must read in the tenant's timezone, never the server's or the
// browser's (spec §9).
export function formatInTenantTz(date: Date | null | undefined, timezone: string): string {
  if (!date) return 'not set';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone, day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function minutesBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 60000);
}

export function humanizeMinutes(mins: number): string {
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
