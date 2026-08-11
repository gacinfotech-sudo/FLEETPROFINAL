// TASK-DRIVER-OPERATIONS-06 — training-event records, consuming
// TASK-DRIVER-DOCUMENTS-03's document registry for the certificate itself.
//
// This module does NOT store certificate files or re-implement document
// upload/verification — DriverTraining.certificateDocumentId is a pointer
// into Documents-03's DriverDocument collection (documentType
// 'training_completion_certificate'), verified here at write time to
// belong to the same tenant+driver and be the right document type. The
// actual file (Google-Drive-backed), its version history, and its
// verification workflow all remain Documents-03's exclusive territory —
// see server/driver/documents/services/documentService.ts.
//
// Cross-module import note: this file imports from '../documents/index',
// which does not exist on this branch yet (TASK-DRIVER-DOCUMENTS-03 is a
// sibling task, not yet merged) — same situation as
// server/driver/domain/eligibility.ts being designed for
// server/services/availability.ts to import. See this task's report for
// how the integration was verified (temporary local copy, then reverted).
import { DriverDocument } from '../documents/index';
import { DriverTraining, type IDriverTraining } from './models';
import { TRAINING_STATUSES, type ActorRef, type TrainingStatus, type TrainingType } from './types';

export class CertificateDocumentMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CertificateDocumentMismatchError';
  }
}

export interface CreateTrainingInput {
  tenantId: string;
  driverId: string;
  actor: ActorRef;
  trainingType: TrainingType;
  title?: string;
  trainingDate: Date | string;
  provider?: string;
  durationHours?: number;
  status?: TrainingStatus;
  certificateDocumentId?: string;
  expiryDate?: Date | string;
  notes?: string;
}

export async function createDriverTraining(input: CreateTrainingInput): Promise<IDriverTraining> {
  let certificateDocumentId: string | undefined;
  if (input.certificateDocumentId) {
    const doc = await DriverDocument.findOne({
      _id: input.certificateDocumentId,
      tenantId: input.tenantId,
      driverId: input.driverId,
    });
    if (!doc) {
      throw new CertificateDocumentMismatchError('certificateDocumentId does not reference a document belonging to this driver/tenant.');
    }
    if (doc.documentType !== 'training_completion_certificate') {
      throw new CertificateDocumentMismatchError(
        `certificateDocumentId must reference a 'training_completion_certificate' document (got '${doc.documentType}').`,
      );
    }
    certificateDocumentId = input.certificateDocumentId;
  }

  return DriverTraining.create({
    tenantId: input.tenantId,
    driverId: input.driverId,
    trainingType: input.trainingType,
    title: input.title,
    trainingDate: new Date(input.trainingDate),
    provider: input.provider,
    durationHours: input.durationHours,
    status: input.status || 'completed',
    certificateDocumentId,
    expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
    conductedBy: { userId: input.actor.userId, role: input.actor.role },
    notes: input.notes,
  });
}

export async function listDriverTraining(tenantId: string, driverId: string): Promise<IDriverTraining[]> {
  return DriverTraining.find({ tenantId, driverId }).sort({ trainingDate: -1 }).lean() as any;
}

export interface UpdateTrainingStatusInput {
  tenantId: string;
  driverId: string;
  trainingId: string;
  status: TrainingStatus;
}

// Status transitions only — never a delete.
export async function updateDriverTrainingStatus(input: UpdateTrainingStatusInput): Promise<IDriverTraining | null> {
  if (!TRAINING_STATUSES.includes(input.status)) {
    throw new Error(`Invalid training status: '${input.status}'.`);
  }
  const training = await DriverTraining.findOne({ _id: input.trainingId, tenantId: input.tenantId, driverId: input.driverId });
  if (!training) return null;
  training.status = input.status;
  await training.save();
  return training;
}
