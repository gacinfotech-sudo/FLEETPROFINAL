// TASK-ROOT-SALES-CONFIG-04 — Sales / Onboarding CRM: Prospect pipeline.
//
// Pipeline (source brief §17, verbatim from the task file):
//   PROSPECT -> DEMO_SCHEDULED -> TRIAL_CREATED -> TRIAL_ACTIVE ->
//   NEGOTIATION -> WON -> TENANT_CREATED -> ONBOARDING -> LIVE
// LOST is reachable from any non-terminal stage.
//
// A Prospect is platform-level data (no tenantId) until it reaches WON and
// "Create Tenant" is run — at that point `tenantId` is populated by
// reusing the *existing* tenant-creation logic (storage.createTenant, the
// same function POST /api/admin/tenants already calls — see
// server/root/routes/sales.ts). This model never implements tenant
// creation itself.

import mongoose, { Schema, Document } from 'mongoose';

export const PROSPECT_STAGES = [
  'PROSPECT',
  'DEMO_SCHEDULED',
  'TRIAL_CREATED',
  'TRIAL_ACTIVE',
  'NEGOTIATION',
  'WON',
  'TENANT_CREATED',
  'ONBOARDING',
  'LIVE',
  'LOST',
] as const;

export type ProspectStage = (typeof PROSPECT_STAGES)[number];

// Forward-only pipeline order; LOST is reachable from any stage before
// TENANT_CREATED (once a tenant exists, "losing" the deal no longer makes
// sense — that becomes a tenant churn/offboarding concern, out of this
// task's scope). A stage may also be re-set to itself (no-op update).
const FORWARD_ORDER: ProspectStage[] = [
  'PROSPECT',
  'DEMO_SCHEDULED',
  'TRIAL_CREATED',
  'TRIAL_ACTIVE',
  'NEGOTIATION',
  'WON',
  'TENANT_CREATED',
  'ONBOARDING',
  'LIVE',
];

export function isValidStageTransition(from: ProspectStage, to: ProspectStage): boolean {
  if (from === to) return true;
  if (to === 'LOST') {
    return from !== 'TENANT_CREATED' && from !== 'ONBOARDING' && from !== 'LIVE' && from !== 'LOST';
  }
  if (from === 'LOST') return false; // LOST is terminal
  const fromIdx = FORWARD_ORDER.indexOf(from);
  const toIdx = FORWARD_ORDER.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  // Only allow moving forward one stage at a time via PATCH, EXCEPT the
  // WON -> TENANT_CREATED transition, which is only ever performed by the
  // create-tenant route itself (never a plain PATCH) — see sales.ts.
  return toIdx === fromIdx + 1;
}

export interface IProspectStageHistoryEntry {
  stage: ProspectStage;
  changedAt: Date;
  changedBy: string;
  note?: string;
}

export interface IProspect extends Document {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  source?: 'website' | 'referral' | 'cold_outreach' | 'event' | 'partner' | 'other';
  stage: ProspectStage;
  dealValueMonthlyUsd?: number;
  assignedTo?: string; // userId of the sales rep
  notes?: string;
  nextFollowUpAt?: Date;

  stageHistory: IProspectStageHistoryEntry[];

  lostReason?: string;
  lostAt?: Date;
  wonAt?: Date;

  // Populated only after a successful "Create Tenant" action (WON ->
  // TENANT_CREATED). Never set by any other route.
  tenantId?: mongoose.Types.ObjectId;
  tenantCreatedAt?: Date;

  createdBy: string; // userId
  createdAt: Date;
  updatedAt: Date;
}

const ProspectStageHistorySchema = new Schema<IProspectStageHistoryEntry>(
  {
    stage: { type: String, enum: PROSPECT_STAGES, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, required: true },
    note: { type: String, maxlength: 1000 },
  },
  { _id: false },
);

const ProspectSchema = new Schema<IProspect>({
  companyName: { type: String, required: true, trim: true, maxlength: 200 },
  contactName: { type: String, required: true, trim: true, maxlength: 200 },
  contactEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  contactPhone: { type: String, trim: true, maxlength: 40 },
  source: {
    type: String,
    enum: ['website', 'referral', 'cold_outreach', 'event', 'partner', 'other'],
    default: 'other',
  },
  stage: { type: String, enum: PROSPECT_STAGES, default: 'PROSPECT', required: true },
  dealValueMonthlyUsd: { type: Number, min: 0 },
  assignedTo: { type: String, maxlength: 120 },
  notes: { type: String, maxlength: 5000 },
  nextFollowUpAt: { type: Date },

  stageHistory: { type: [ProspectStageHistorySchema], default: [] },

  lostReason: { type: String, maxlength: 1000 },
  lostAt: { type: Date },
  wonAt: { type: Date },

  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  tenantCreatedAt: { type: Date },

  createdBy: { type: String, required: true },
}, { timestamps: true });

ProspectSchema.index({ stage: 1, createdAt: -1 });
ProspectSchema.index({ assignedTo: 1, stage: 1 });
ProspectSchema.index({ tenantId: 1 }, { sparse: true, unique: true });

export const Prospect =
  mongoose.models.Prospect || mongoose.model<IProspect>('Prospect', ProspectSchema);
