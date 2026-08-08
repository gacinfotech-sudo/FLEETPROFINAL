// Booking End Reminder engine (spec §11-19, §58-62).
//
// Server-side, persistence-backed: the sweep re-derives every due reminder
// from canonical Booking times on each run, so a process restart loses
// nothing (spec §58 — no in-memory setTimeout as source of truth). Alert
// creation is idempotent via OperationsAlert.dedupeKey, and WhatsApp
// delivery is idempotent via the existing WhatsAppMessage ledger key, so a
// retried sweep can never send the same T-60 reminder twice (spec §59).
//
// All booking classification comes from buildLiveVehicles — the SAME view
// the Live Operations screen renders. One classification engine, no
// competing state systems (spec §23-24).

import mongoose from 'mongoose';
import { Booking, Tenant, OperationsAlert, WhatsAppMessage } from '../models/index';
import { SelfDriveTrip, computeRefund } from '../booking/self-drive/models';
import { whatsappProvider } from '../whatsapp/index';
import { normalizeIndianPhone } from '../whatsapp/phone';
import {
  resolvePolicy, stagesFor, priorityForStage, formatInTenantTz, humanizeMinutes,
  type OperationsPolicy, type ReminderStage,
} from './policy';
import { buildLiveVehicles, ACTIVE_TRIP_STATUSES, type LiveVehicleCard } from './liveVehicles';

const DONE_STATUSES = ['completed', 'payment_pending', 'closed'];
const STOPPED_STATUSES = ['cancelled', 'no_show'];

function vehicleLabel(card: LiveVehicleCard): string {
  if (card.vehicle) {
    const name = [card.vehicle.make, card.vehicle.model].filter(Boolean).join(' ');
    return card.vehicle.registrationNumber ? `${name} (${card.vehicle.registrationNumber})` : name || 'Vehicle';
  }
  return card.vendorVehicle || 'Vehicle';
}

function modeLabel(card: LiveVehicleCard): string {
  return card.serviceMode === 'self_drive' ? 'Self Drive' : 'With Driver';
}

// ---------- message templates (defaults; spec §16-19, §64 keeps customer
// and internal content strictly separate — customer text never includes
// balance/deposit/internal notes) ----------

function internalReminderText(card: LiveVehicleCard, minutesLeft: number): string {
  const lines = [
    `Booking ${card.bookingCode} (${modeLabel(card)}) is due to end at ${card.endAtLocal}.`,
    `Vehicle: ${vehicleLabel(card)}`,
    `Customer: ${card.customerName}`,
  ];
  if (card.serviceMode === 'with_driver') {
    const d = card.driver?.name || card.vendorDriver?.name;
    if (d) lines.push(`Driver: ${d}`);
    if (card.balance > 0) lines.push(`Balance: ₹${card.balance.toLocaleString('en-IN')}`);
    lines.push(`Time remaining: ${humanizeMinutes(minutesLeft)}. Please coordinate trip completion${card.balance > 0 ? ' and pending collection' : ''}.`);
  } else {
    if (card.returnLocation) lines.push(`Return location: ${card.returnLocation}`);
    lines.push(`Time remaining: ${humanizeMinutes(minutesLeft)}. Please contact ${card.customerName} regarding vehicle return or extension.`);
  }
  return lines.join('\n');
}

function customerReminderText(card: LiveVehicleCard): string {
  // Customer-facing: no balance, no deposit, no internal notes (spec §64).
  const where = card.returnLocation ? ` at ${card.returnLocation}` : '';
  return `Reminder: your ${vehicleLabel(card)} booking ${card.bookingCode} is scheduled to end at ${card.endAtLocal}${where}. ` +
    `Reply here or call us if you plan to return as scheduled or need an extension.`;
}

function driverReminderText(card: LiveVehicleCard): string {
  // Driver-facing: trip end context only — no customer balance unless the
  // tenant explicitly collects through the driver (kept out by default,
  // spec §19: don't expose finance unnecessarily).
  return `Trip ${card.bookingCode} (${vehicleLabel(card)}) is expected to end at ${card.endAtLocal}. Please coordinate trip completion with the office.`;
}

// ---------- idempotent alert creation ----------

interface AlertSeed {
  tenantId: string;
  bookingId: string;
  dedupeKey: string;
  kind: 'ending_soon' | 'return_due' | 'overdue' | 'payment_due' | 'end_time_pending' | 'turnaround_conflict' | 'refund_pending';
  stageKey?: string;
  serviceMode: 'self_drive' | 'with_driver';
  priority: 'info' | 'attention' | 'urgent' | 'critical';
  title: string;
  body: string;
  endAtSnapshot?: Date;
}

async function createAlertIfNew(seed: AlertSeed): Promise<any | null> {
  const res = await OperationsAlert.updateOne(
    { dedupeKey: seed.dedupeKey },
    {
      $setOnInsert: {
        tenantId: seed.tenantId,
        bookingId: seed.bookingId,
        kind: seed.kind,
        stageKey: seed.stageKey,
        serviceMode: seed.serviceMode,
        priority: seed.priority,
        title: seed.title,
        body: seed.body,
        endAtSnapshot: seed.endAtSnapshot,
        status: 'active',
        contactLog: [],
        whatsapp: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
  if ((res as any).upsertedCount > 0) {
    return OperationsAlert.findOne({ dedupeKey: seed.dedupeKey });
  }
  return null; // already existed — reminder already fired for this identity
}

// ---------- WhatsApp dispatch (honest status, tenant's own provider) ----------

async function sendReminderWhatsApp(opts: {
  tenantId: string;
  alert: any;
  card: LiveVehicleCard;
  target: 'internal' | 'customer' | 'driver';
  phone: string | undefined | null;
  text: string;
}): Promise<void> {
  const { tenantId, alert, card, target, phone, text } = opts;
  const recipientPhone = normalizeIndianPhone(phone || '');
  const record = (status: 'SENT' | 'FAILED' | 'SKIPPED', error?: string, sentAt?: Date) => {
    alert.whatsapp.push({ target, status, error, sentAt });
  };

  if (!recipientPhone) {
    record('SKIPPED', `No valid ${target} phone configured`);
    return;
  }

  // WhatsAppMessage ledger row doubles as the delivery-idempotency guard —
  // the partial unique index on idempotencyKey rejects a second queued/sent
  // row for the same reminder identity (spec §59).
  const idempotencyKey = `ops:${alert.dedupeKey}:${target}`;
  let msgDoc: any;
  try {
    msgDoc = await WhatsAppMessage.create({
      tenantId,
      bookingId: card.id,
      recipientType: target === 'internal' ? 'staff' : target,
      recipientPhone,
      messageType: `operations_reminder_${alert.kind}`,
      content: text,
      provider: whatsappProvider.kind,
      status: 'queued',
      attemptCount: 1,
      idempotencyKey,
      createdBy: { userId: 'system', role: 'system' },
    });
  } catch (err: any) {
    if (err?.code === 11000) { record('SKIPPED', 'Already sent (idempotency)'); return; }
    record('FAILED', err?.message || 'Failed to queue message');
    return;
  }

  try {
    // A wedged provider (e.g. a WhatsApp session stuck mid-init) must never
    // stall the sweep — bound every send attempt.
    const result = await Promise.race([
      whatsappProvider.sendText(tenantId, recipientPhone, text),
      new Promise<{ providerMessageId: null; status: 'failed'; error: string }>((resolve) =>
        setTimeout(() => resolve({ providerMessageId: null, status: 'failed', error: 'Send timed out after 15s' }), 15000)),
    ]);
    if (result.status === 'sent') {
      msgDoc.status = 'sent';
      msgDoc.providerMessageId = result.providerMessageId || undefined;
      msgDoc.sentAt = new Date();
      await msgDoc.save();
      record('SENT', undefined, msgDoc.sentAt);
    } else {
      msgDoc.status = 'failed';
      msgDoc.error = result.error || 'Provider reported failure';
      await msgDoc.save();
      record('FAILED', msgDoc.error);
    }
  } catch (err: any) {
    // WhatsApp down must never break CRM alerting (spec §61).
    msgDoc.status = 'failed';
    msgDoc.error = err?.message || 'Send threw';
    await msgDoc.save().catch(() => {});
    record('FAILED', msgDoc.error);
  }
}

// ---------- reconciliation of open alerts ----------

async function reconcileOpenAlerts(tenantId: string, cardsById: Map<string, LiveVehicleCard>, now: Date, policy?: OperationsPolicy): Promise<void> {
  const open: any[] = await OperationsAlert.find({ tenantId, status: { $in: ['active', 'acknowledged', 'snoozed'] } });
  if (open.length === 0) return;

  // Alerts for bookings no longer in an active trip status → resolve from
  // the booking's real terminal state.
  const missingIds = Array.from(new Set(
    open.filter((a) => !cardsById.has(String(a.bookingId))).map((a) => String(a.bookingId))
  ));
  const statuses = new Map<string, string>();
  if (missingIds.length > 0) {
    const rows: any[] = await Booking.find({ _id: { $in: missingIds }, tenantId }).select('status').lean();
    for (const r of rows) statuses.set(String(r._id), r.status);
  }

  for (const alert of open) {
    // Refund alerts outlive the live-vehicle view by design (the vehicle is
    // back; the money isn't) — their lifecycle is reconciled against the
    // refund case in sweepRefunds, never against live cards.
    if (alert.kind === 'refund_pending') continue;
    const card = cardsById.get(String(alert.bookingId));
    if (!card) {
      const st = statuses.get(String(alert.bookingId));
      alert.status = 'resolved';
      alert.resolvedAt = now;
      alert.resolvedReason = STOPPED_STATUSES.includes(st || '') ? 'cancelled' : 'completed';
      await alert.save();
      continue;
    }
    // End time moved (extension) — stale time-anchored alerts are
    // superseded; the next sweep re-derives from the new end (spec §32).
    if (alert.endAtSnapshot && card.endAt && Math.abs(new Date(alert.endAtSnapshot).getTime() - new Date(card.endAt).getTime()) > 60000) {
      alert.status = 'resolved';
      alert.resolvedAt = now;
      alert.resolvedReason = 'superseded';
      await alert.save();
      continue;
    }
    if (alert.kind === 'end_time_pending' && !card.endTimePending) {
      alert.status = 'resolved';
      alert.resolvedAt = now;
      alert.resolvedReason = 'end_time_set';
      await alert.save();
      continue;
    }
    if (alert.kind === 'payment_due' && card.balance <= 0) {
      alert.status = 'resolved';
      alert.resolvedAt = now;
      alert.resolvedReason = 'paid';
      await alert.save();
      continue;
    }
    // Snooze expiry — alert surfaces again (critical state stays visible).
    if (alert.status === 'snoozed' && alert.snoozedUntil && alert.snoozedUntil <= now) {
      alert.status = 'active';
      alert.snoozedUntil = undefined;
      await alert.save();
      continue;
    }
    // OVERDUE re-arm (spec: acknowledge pauses, never dismisses — while the
    // vehicle is still out past its end, the alert must come back). The
    // bumped realertCount re-keys the client popup's seen-set so it pops
    // again rather than staying silently 'active'.
    if (
      alert.kind === 'overdue' && alert.status === 'acknowledged' && policy &&
      alert.acknowledgedAt && (now.getTime() - new Date(alert.acknowledgedAt).getTime()) >= policy.overdueRealertMinutes * 60000
    ) {
      alert.status = 'active';
      alert.realertCount = (alert.realertCount || 0) + 1;
      await alert.save();
    }
  }
}

// ---------- refund-pending sweep (spec §13-§15, §39) ----------

// SLA buckets: <6h normal, 6-24h attention, >24h urgent, >48h critical.
function refundSlaBucket(hours: number): { key: string; priority: 'info' | 'attention' | 'urgent' | 'critical' } {
  if (hours >= 48) return { key: '48h', priority: 'critical' };
  if (hours >= 24) return { key: '24h', priority: 'urgent' };
  if (hours >= 6) return { key: '6h', priority: 'attention' };
  return { key: 'new', priority: 'info' };
}

async function sweepRefunds(tenantId: string, policy: OperationsPolicy, now: Date): Promise<number> {
  let created = 0;
  const openTrips: any[] = await SelfDriveTrip.find({
    tenantId,
    'refund.status': { $in: ['pending', 'partially_refunded'] },
  })
    .sort({ 'refund.pendingSince': 1 })
    .limit(500)
    .populate('bookingId', 'bookingId customerName customerPhone')
    .lean();

  const openBookingIds = new Set(openTrips.map((t) => String((t.bookingId as any)?._id ?? t.bookingId)));

  // Resolve refund alerts whose case is settled/closed — and lower-bucket
  // alerts superseded by an escalation (one live alert per case).
  const openAlerts: any[] = await OperationsAlert.find({
    tenantId, kind: 'refund_pending', status: { $in: ['active', 'acknowledged', 'snoozed'] },
  });
  const desiredKeyByBooking = new Map<string, string>();
  for (const t of openTrips) {
    const bid = String((t.bookingId as any)?._id ?? t.bookingId);
    const hours = (now.getTime() - new Date(t.refund.pendingSince).getTime()) / 3600000;
    desiredKeyByBooking.set(bid, refundSlaBucket(hours).key);
  }
  for (const alert of openAlerts) {
    const bid = String(alert.bookingId);
    if (!openBookingIds.has(bid)) {
      alert.status = 'resolved';
      alert.resolvedAt = now;
      alert.resolvedReason = 'paid';
      await alert.save();
      continue;
    }
    const desired = desiredKeyByBooking.get(bid);
    if (desired && alert.stageKey && alert.stageKey !== `refund-${desired}`) {
      alert.status = 'resolved';
      alert.resolvedAt = now;
      alert.resolvedReason = 'superseded';
      await alert.save();
    }
  }

  for (const t of openTrips) {
    const booking: any = t.bookingId && typeof t.bookingId === 'object' ? t.bookingId : null;
    const bid = String(booking?._id ?? t.bookingId);
    const comp = computeRefund(t.refund);
    if (comp.balance <= 0) continue; // fully paid, waiting on close — no nag
    const hours = (now.getTime() - new Date(t.refund.pendingSince).getTime()) / 3600000;
    const bucket = refundSlaBucket(hours);
    const pendingLabel = hours >= 48 ? `${Math.floor(hours / 24)} days` : hours >= 1 ? `${Math.floor(hours)}h` : `${Math.round(hours * 60)} min`;
    const alert = await createAlertIfNew({
      tenantId, bookingId: bid,
      dedupeKey: `${tenantId}:${bid}:refund:${bucket.key}`,
      kind: 'refund_pending', stageKey: `refund-${bucket.key}`, serviceMode: 'self_drive',
      priority: bucket.priority,
      title: `REFUND PENDING ₹${comp.balance.toLocaleString('en-IN')} — ${booking?.bookingId || 'booking'}`,
      body: `${booking?.customerName || 'Customer'} is waiting for the security-deposit refund (deposit ₹${comp.depositAmount.toLocaleString('en-IN')}, deductions ₹${comp.totalDeduction.toLocaleString('en-IN')}, refunded ₹${comp.refunded.toLocaleString('en-IN')}). Pending ${pendingLabel}.`,
    });
    if (alert) { created++; await alert.save(); }
  }
  return created;
}

// ---------- per-tenant sweep ----------

export async function sweepTenant(tenantId: string, now: Date = new Date()): Promise<{ created: number }> {
  const tenant: any = await Tenant.findById(tenantId).lean();
  if (!tenant) return { created: 0 };
  const policy = resolvePolicy(tenant);
  const view = await buildLiveVehicles(tenantId, now);
  const cardsById = new Map(view.cards.map((c) => [c.id, c]));

  await reconcileOpenAlerts(tenantId, cardsById, now, policy);

  let created = 0;
  for (const card of view.cards) {
    created += await sweepCard(tenantId, card, policy, now);
  }
  created += await sweepRefunds(tenantId, policy, now);
  return { created };
}

async function sweepCard(tenantId: string, card: LiveVehicleCard, policy: OperationsPolicy, now: Date): Promise<number> {
  let created = 0;
  const endAtIso = card.endAt || 'none';
  const endAt = card.endAt ? new Date(card.endAt) : undefined;

  // END TIME PENDING — booking is out with no reliable scheduled end
  // (spec §8): flagged once, sits in Needs Attention until fixed.
  if (card.endTimePending) {
    const alert = await createAlertIfNew({
      tenantId, bookingId: card.id,
      dedupeKey: `${tenantId}:${card.id}:end_time_pending`,
      kind: 'end_time_pending', serviceMode: card.serviceMode, priority: 'attention',
      title: `END TIME PENDING — ${card.bookingCode}`,
      body: `${vehicleLabel(card)} is out with ${card.customerName} (${modeLabel(card)}) but has no expected ${card.serviceMode === 'self_drive' ? 'return' : 'trip end'} time. Set it so reminders can run.`,
    });
    if (alert) { created++; await alert.save(); }
    return created;
  }

  const remaining = card.timeRemainingMinutes!;

  if (remaining <= 0) {
    if (card.runtimeStatus === 'OVERDUE') {
      // OVERDUE — critical, stays until the return/completion workflow
      // moves the booking forward. Never auto-frees the vehicle (spec §21).
      const lateBy = humanizeMinutes(-remaining);
      const nextRisk = card.nextBooking?.atRisk ? ` NEXT BOOKING AT RISK: ${card.nextBooking.bookingCode} starts ${card.nextBooking.startAtLocal}.` : '';
      const alert = await createAlertIfNew({
        tenantId, bookingId: card.id,
        dedupeKey: `${tenantId}:${card.id}:overdue:${endAtIso}`,
        kind: 'overdue', serviceMode: card.serviceMode, priority: 'critical',
        title: `${card.serviceMode === 'self_drive' ? 'OVERDUE RETURN' : 'TRIP OVERDUE'} — ${card.bookingCode}`,
        body: `${vehicleLabel(card)} with ${card.customerName} is ${lateBy} past its scheduled ${card.serviceMode === 'self_drive' ? 'return' : 'trip end'} (${card.endAtLocal}).${nextRisk}`,
        endAtSnapshot: endAt,
      });
      if (alert) { created++; await alert.save(); }
    } else {
      // RETURN / TRIP END DUE — end time reached, inside grace.
      const alert = await createAlertIfNew({
        tenantId, bookingId: card.id,
        dedupeKey: `${tenantId}:${card.id}:end:${endAtIso}`,
        kind: 'return_due', stageKey: 'end', serviceMode: card.serviceMode, priority: 'urgent',
        title: `${card.serviceMode === 'self_drive' ? 'RETURN DUE' : 'TRIP END DUE'} — ${card.bookingCode}`,
        body: `${vehicleLabel(card)} with ${card.customerName} was due back at ${card.endAtLocal}${card.returnLocation ? ` (${card.returnLocation})` : ''}. Confirm return/completion or extend.`,
        endAtSnapshot: endAt,
      });
      if (alert) { created++; await alert.save(); }
    }
  } else {
    // Pre-end escalation ladder: fire ONLY the most imminent enabled stage
    // whose window has opened — controlled escalation, not a popup per
    // minute and no backfilled spam when a sweep starts late (spec §13).
    const stages = stagesFor(policy, card.serviceMode).filter((s) => s.enabled && s.minutesBefore >= remaining);
    if (stages.length > 0) {
      const stage: ReminderStage = stages[stages.length - 1]; // sorted desc → last = most imminent
      const alert = await createAlertIfNew({
        tenantId, bookingId: card.id,
        dedupeKey: `${tenantId}:${card.id}:t-${stage.minutesBefore}:${endAtIso}`,
        kind: 'ending_soon', stageKey: `t-${stage.minutesBefore}`, serviceMode: card.serviceMode,
        priority: priorityForStage(stage.minutesBefore),
        title: `${modeLabel(card)} ending in ${humanizeMinutes(remaining)} — ${card.bookingCode}`,
        body: `${vehicleLabel(card)} · ${card.customerName} · ${card.serviceMode === 'self_drive' ? 'return' : 'trip end'} at ${card.endAtLocal}${card.returnLocation ? ` · ${card.returnLocation}` : ''}${card.balance > 0 ? ` · Balance ₹${card.balance.toLocaleString('en-IN')}` : ''}.`,
        endAtSnapshot: endAt,
      });
      if (alert) {
        created++;
        if (stage.whatsappInternal) {
          await sendReminderWhatsApp({ tenantId, alert, card, target: 'internal', phone: policy.whatsappInternalPhone, text: internalReminderText(card, remaining) });
        }
        if (card.serviceMode === 'self_drive' && stage.whatsappCustomer) {
          await sendReminderWhatsApp({ tenantId, alert, card, target: 'customer', phone: card.customerPhone, text: customerReminderText(card) });
        }
        if (card.serviceMode === 'with_driver' && stage.whatsappDriver) {
          await sendReminderWhatsApp({ tenantId, alert, card, target: 'driver', phone: card.driver?.phone || card.vendorDriver?.phone, text: driverReminderText(card) });
        }
        await alert.save();
      }
    }
  }

  // PAYMENT DUE near trip end (spec §36) — rental balance only; the
  // security deposit is never part of this number.
  if (card.balance > 0 && remaining <= 60) {
    const alert = await createAlertIfNew({
      tenantId, bookingId: card.id,
      dedupeKey: `${tenantId}:${card.id}:payment_due:${endAtIso}`,
      kind: 'payment_due', serviceMode: card.serviceMode, priority: 'urgent',
      title: `PAYMENT DUE — ${card.bookingCode}`,
      body: `${card.serviceMode === 'self_drive' ? 'Booking' : 'Trip'} ${remaining > 0 ? `ends in ${humanizeMinutes(remaining)}` : 'has ended'}. Balance: ₹${card.balance.toLocaleString('en-IN')} from ${card.customerName}.`,
      endAtSnapshot: endAt,
    });
    if (alert) { created++; await alert.save(); }
  }

  // TURNAROUND CONFLICT / next booking at risk (spec §38-40).
  if (card.nextBooking && (card.nextBooking.turnaroundConflict || card.nextBooking.atRisk)) {
    const nb = card.nextBooking;
    const alert = await createAlertIfNew({
      tenantId, bookingId: card.id,
      dedupeKey: `${tenantId}:${card.id}:turnaround:${nb.bookingId}:${endAtIso}`,
      kind: 'turnaround_conflict', serviceMode: card.serviceMode,
      priority: nb.atRisk ? 'critical' : 'attention',
      title: `${nb.atRisk ? 'NEXT BOOKING AT RISK' : 'TURNAROUND CONFLICT'} — ${vehicleLabel(card)}`,
      body: `Current ${card.serviceMode === 'self_drive' ? 'return' : 'trip end'}: ${card.endAtLocal}. Next booking ${nb.bookingCode} (${nb.customerName}) starts ${nb.startAtLocal}${nb.gapMinutes !== null ? ` — gap ${humanizeMinutes(nb.gapMinutes)}, required buffer ${humanizeMinutes(nb.requiredBufferMinutes)}` : ''}.`,
      endAtSnapshot: endAt,
    });
    if (alert) { created++; await alert.save(); }
  }

  return created;
}

// Booking-scoped reconcile+resweep — called inline after an extension so
// stale reminders resolve and the fresh schedule takes effect atomically
// with the user's action, without waiting for the next periodic sweep.
export async function resweepBooking(tenantId: string, bookingId: string, now: Date = new Date()): Promise<void> {
  try {
    const tenant: any = await Tenant.findById(tenantId).lean();
    if (!tenant) return;
    const policy = resolvePolicy(tenant);
    const view = await buildLiveVehicles(tenantId, now);
    const cardsById = new Map(view.cards.map((c) => [c.id, c]));
    // Reconcile just this booking's open alerts, then re-derive its stages.
    const open: any[] = await OperationsAlert.find({ tenantId, bookingId, status: { $in: ['active', 'acknowledged', 'snoozed'] } });
    const card = cardsById.get(String(bookingId));
    for (const alert of open) {
      if (!card) {
        alert.status = 'resolved'; alert.resolvedAt = now; alert.resolvedReason = 'completed';
        await alert.save();
        continue;
      }
      if (alert.endAtSnapshot && card.endAt && Math.abs(new Date(alert.endAtSnapshot).getTime() - new Date(card.endAt).getTime()) > 60000) {
        alert.status = 'resolved'; alert.resolvedAt = now; alert.resolvedReason = 'superseded';
        await alert.save();
      }
    }
    if (card) await sweepCard(tenantId, card, policy, now);
  } catch (err: any) {
    console.error('[operations] resweepBooking failed:', err?.message || err);
  }
}

// ---------- full sweep + scheduler ----------

let sweeping = false;

export async function runReminderSweep(now: Date = new Date()): Promise<{ tenants: number; created: number }> {
  if (sweeping) return { tenants: 0, created: 0 };
  sweeping = true;
  try {
    // Only tenants that actually have active trips — bounded by the
    // {tenantId, status, scheduledEndDateTime} index, never a full scan.
    const tripTenants: mongoose.Types.ObjectId[] = await Booking.distinct('tenantId', {
      status: { $in: ACTIVE_TRIP_STATUSES as unknown as string[] },
    });
    const refundTenants: mongoose.Types.ObjectId[] = await SelfDriveTrip.distinct('tenantId', {
      'refund.status': { $in: ['pending', 'partially_refunded'] },
    });
    const tenantIds = Array.from(new Map([...tripTenants, ...refundTenants].map((t) => [String(t), t])).values());
    let created = 0;
    for (const tid of tenantIds) {
      try {
        const r = await sweepTenant(String(tid), now);
        created += r.created;
      } catch (err: any) {
        console.error(`[operations] sweep failed for tenant ${tid}:`, err?.message || err);
      }
    }
    return { tenants: tenantIds.length, created };
  } finally {
    sweeping = false;
  }
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;

export function startOperationsReminderScheduler(): void {
  if (sweepTimer) return;
  if (process.env.OPERATIONS_REMINDERS_DISABLED === 'true') {
    console.log('[operations] reminder scheduler disabled by env');
    return;
  }
  const interval = Number(process.env.OPERATIONS_SWEEP_INTERVAL_MS) || 60000;
  sweepTimer = setInterval(() => {
    runReminderSweep().catch((err) => console.error('[operations] sweep error:', err?.message || err));
  }, interval);
  // Don't keep the process alive just for the sweep.
  (sweepTimer as any).unref?.();
  console.log(`[operations] booking-end reminder scheduler started (every ${interval}ms)`);
}

export function stopOperationsReminderScheduler(): void {
  if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
}
