import mongoose from 'mongoose';
import { computeEfficiency, flagAbnormalConsumption } from '../analytics';
import { FuelTransaction, type IFuelTransaction } from '../models/fuelTransaction';
import type { AbnormalConsumptionOptions, FuelTransactionInput } from '../types';

/**
 * Records a fill-up, computing and caching its efficiency against the most
 * recent prior full-tank fill-up for the same vehicle (partial fill-ups are
 * excluded from the "previous odometer" search — mixing partial and full
 * fills into one KM/L number is exactly the kind of misleading average this
 * task's analytics must not produce). Flags abnormal consumption using the
 * caller-supplied, tenant-configurable threshold.
 */
export async function recordFuelTransaction(
  input: FuelTransactionInput,
  actor: string,
  abnormalOptions: AbnormalConsumptionOptions,
): Promise<IFuelTransaction> {
  if (!mongoose.isValidObjectId(input.vehicleId)) {
    throw new Error('recordFuelTransaction requires a valid vehicleId.');
  }

  const previousFullTank = await FuelTransaction.findOne({
    tenantId: input.tenantId,
    vehicleId: input.vehicleId,
    isFullTank: true,
    odometer: { $lt: input.odometer },
  }).sort({ odometer: -1 });

  const doc = await FuelTransaction.create({
    tenantId: input.tenantId,
    vehicleId: input.vehicleId,
    fuelType: input.fuelType,
    odometer: input.odometer,
    quantity: input.quantity,
    amount: input.amount,
    isFullTank: input.isFullTank,
    station: input.station,
    date: input.date,
    createdBy: actor,
  });

  // Efficiency (and therefore abnormal-consumption flagging) is only
  // meaningful between two full-tank fills — a partial fill-up, or the
  // vehicle's very first recorded fill-up, has no valid "previous full
  // reading" to measure against, and is recorded without a computed value
  // rather than a misleading placeholder.
  if (input.isFullTank && previousFullTank) {
    const efficiency = computeEfficiency(input, previousFullTank.odometer);
    doc.computedKmPerLitre = efficiency.kmPerLitre;
    doc.computedKmPerKg = efficiency.kmPerKg;
    doc.computedKmPerKwh = efficiency.kmPerKwh;
    doc.computedCostPerKm = efficiency.costPerKm;

    const priorFullTanks = await FuelTransaction.find({
      tenantId: input.tenantId,
      vehicleId: input.vehicleId,
      isFullTank: true,
      odometer: { $lt: input.odometer },
      $or: [{ computedKmPerLitre: { $exists: true } }, { computedKmPerKg: { $exists: true } }, { computedKmPerKwh: { $exists: true } }],
    }).sort({ odometer: -1 }).limit(12);

    const abnormal = flagAbnormalConsumption(
      efficiency,
      priorFullTanks.map((t) => ({
        distanceKm: 0, // not needed by flagAbnormalConsumption's comparison
        kmPerLitre: t.computedKmPerLitre,
        kmPerKg: t.computedKmPerKg,
        kmPerKwh: t.computedKmPerKwh,
      })),
      abnormalOptions,
    );
    doc.flaggedAbnormal = abnormal.isAbnormal;
    await doc.save();
  }

  return doc;
}

export async function listFuelTransactions(tenantId: string, vehicleId: string): Promise<IFuelTransaction[]> {
  return FuelTransaction.find({ tenantId, vehicleId }).sort({ date: -1 });
}
