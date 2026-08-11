import type { Express, NextFunction, Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { fileTypeFromBuffer } from 'file-type';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import {
  createHandover, getTenantScopedHandover, listHandoversForVehicle, getOpenHandoverForVehicle,
  HandoverNotFoundError, HandoverConflictError, DriverNotEligibleError,
} from './handoverService';
import { createReturn } from './returnService';
import { uploadHandoverConditionPhoto, DriveConnectionNotConfiguredError } from './documentIntegration';
import { publicVehicleHandover } from './serialization';
import { ALLOWED_DOCUMENT_MIME_TYPES } from '../documents/services/documentService';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 12 },
});

const handoverRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many handover changes. Please try again later.' },
});

const removableItemSchema = z.object({
  item: z.string().trim().min(1).max(200),
  present: z.boolean(),
  condition: z.enum(['good', 'damaged', 'missing']),
  notes: z.string().trim().max(500).optional(),
}).strict();

const handoverBodySchema = z.object({
  driverId: z.string().min(1),
  bookingId: z.string().min(1).optional(),
  odometerReading: z.coerce.number().min(0),
  fuelLevel: z.coerce.number().min(0).max(100),
  removableItemInventory: z.union([z.string(), z.array(removableItemSchema)]).optional(),
  damageNoted: z.string().trim().max(2000).optional(),
});

const returnBodySchema = z.object({
  odometerReading: z.coerce.number().min(0),
  fuelLevel: z.coerce.number().min(0).max(100),
  removableItemInventory: z.union([z.string(), z.array(removableItemSchema)]).optional(),
  damageNoted: z.string().trim().max(2000).optional(),
  expectedTripDistanceKm: z.coerce.number().min(0).optional(),
});

function parseInventory(raw: unknown): z.infer<typeof removableItemSchema>[] {
  if (!raw) return [];
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return z.array(removableItemSchema).parse(value);
}

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function tenantContext(req: AuthRequest, res: Response): string | null {
  if (!req.tenantId) {
    res.status(403).json({ message: 'Tenant context is required.' });
    return null;
  }
  return req.tenantId;
}

async function sniffAllowedMimeType(buffer: Buffer): Promise<string | null> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_DOCUMENT_MIME_TYPES.includes(detected.mime)) return null;
  return detected.mime;
}

function handoverError(error: unknown, res: Response) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: error.issues.map((issue) => issue.message).join('; ') });
  }
  if (error instanceof HandoverNotFoundError) return res.status(404).json({ message: error.message });
  if (error instanceof HandoverConflictError) return res.status(409).json({ code: 'HANDOVER_CONFLICT', message: error.message });
  if (error instanceof DriverNotEligibleError) return res.status(409).json({ code: 'DRIVER_NOT_ELIGIBLE', message: error.message });
  throw error;
}

/** Uploads any multer-attached photo files (field name 'photos', optional,
 * angle per-file communicated via a parallel 'angles' string[] field) through
 * the document registry. Missing/unconfigured Drive connection is tolerated —
 * a handover is not blocked on photo upload succeeding (photos can be
 * attached later); this mirrors the "flags never block" philosophy applied
 * to a different failure mode (infra, not data). */
async function uploadPhotosIfAny(req: AuthRequest, res: Response, tenantId: string, driverId: string, handoverId: string) {
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  if (files.length === 0) return [];
  const angles = ([] as string[]).concat((req.body?.angles as any) || []);
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const sniffed = await sniffAllowedMimeType(file.buffer);
    if (!sniffed) continue; // skip unrecognized files rather than failing the whole handover
    try {
      const photo = await uploadHandoverConditionPhoto({
        tenantId, driverId, handoverId,
        angle: (angles[i] as any) || 'other',
        index: i,
        fileBuffer: file.buffer,
        mimeType: sniffed,
        uploadedBy: req.userId!,
      });
      results.push(photo);
    } catch (error) {
      if (error instanceof DriveConnectionNotConfiguredError) continue; // tolerated, see doc comment
      throw error;
    }
  }
  return results;
}

export function registerVehicleHandoverRoutes(app: Express): void {
  app.post(
    '/api/vehicles/:id/handover',
    handoverRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.MANAGE_VEHICLES),
    upload.array('photos', 12),
    safeAsync(async (req, res) => {
      const tenantId = tenantContext(req, res);
      if (!tenantId) return;
      try {
        const body = handoverBodySchema.parse(req.body);
        const inventory = parseInventory(body.removableItemInventory);

        const handover = await createHandover({
          tenantId,
          vehicleId: req.params.id,
          driverId: body.driverId,
          bookingId: body.bookingId,
          odometerReading: body.odometerReading,
          fuelLevel: body.fuelLevel,
          removableItemInventory: inventory,
          damageNoted: body.damageNoted,
          staffConductedBy: req.userId!,
        });

        const photos = await uploadPhotosIfAny(req, res, tenantId, body.driverId, handover.id);
        if (photos.length > 0) {
          handover.conditionPhotos = photos as any;
          await handover.save();
        }

        res.status(201).json(publicVehicleHandover(handover));
      } catch (error) {
        handoverError(error, res);
      }
    }),
  );

  app.post(
    '/api/vehicles/:id/return',
    handoverRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.MANAGE_VEHICLES),
    upload.array('photos', 12),
    safeAsync(async (req, res) => {
      const tenantId = tenantContext(req, res);
      if (!tenantId) return;
      try {
        const body = returnBodySchema.parse(req.body);
        const inventory = parseInventory(body.removableItemInventory);

        const openHandover = await getOpenHandoverForVehicle(tenantId, req.params.id);
        if (!openHandover) {
          return res.status(404).json({ message: 'No open handover exists for this vehicle to return against.' });
        }

        const returnRecord = await createReturn({
          tenantId,
          vehicleId: req.params.id,
          odometerReading: body.odometerReading,
          fuelLevel: body.fuelLevel,
          removableItemInventory: inventory,
          damageNoted: body.damageNoted,
          expectedTripDistanceKm: body.expectedTripDistanceKm,
          staffConductedBy: req.userId!,
        });

        const photos = await uploadPhotosIfAny(req, res, tenantId, String(openHandover.driverId), returnRecord.id);
        if (photos.length > 0) {
          returnRecord.conditionPhotos = photos as any;
          await returnRecord.save();
        }

        // Always 201 — a flagged return is still a successfully created
        // record (status: 'disputed'), never a rejection. See
        // returnService.ts / this task's acceptance criteria.
        res.status(201).json(publicVehicleHandover(returnRecord));
      } catch (error) {
        handoverError(error, res);
      }
    }),
  );

  app.get(
    '/api/vehicles/:id/handovers',
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.MANAGE_VEHICLES),
    safeAsync(async (req, res) => {
      const tenantId = tenantContext(req, res);
      if (!tenantId) return;
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Vehicle not found.' });
      const handovers = await listHandoversForVehicle(tenantId, req.params.id);
      res.json(handovers.map(publicVehicleHandover));
    }),
  );

  app.get(
    '/api/vehicle-handovers/:id',
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.MANAGE_VEHICLES),
    safeAsync(async (req, res) => {
      const tenantId = tenantContext(req, res);
      if (!tenantId) return;
      const handover = await getTenantScopedHandover(tenantId, req.params.id);
      if (!handover) return res.status(404).json({ message: 'Handover not found.' });
      res.json(publicVehicleHandover(handover));
    }),
  );
}
