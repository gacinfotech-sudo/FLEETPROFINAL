import { VehicleInventoryItem, type IVehicleInventoryItem } from './models';
import type { InventoryItemCategory } from './types';

export interface CreateInventoryItemInput {
  tenantId: string;
  vehicleId: string;
  category: InventoryItemCategory;
  name: string;
  purchaseDate?: Date;
  purchaseCost?: number;
  warrantyExpiryDate?: Date;
  createdBy: { userId: string; role: string };
}

export async function createInventoryItem(input: CreateInventoryItemInput): Promise<IVehicleInventoryItem> {
  return VehicleInventoryItem.create({
    tenantId: input.tenantId,
    vehicleId: input.vehicleId,
    category: input.category,
    name: input.name,
    purchaseDate: input.purchaseDate,
    purchaseCost: input.purchaseCost,
    warrantyExpiryDate: input.warrantyExpiryDate,
    status: 'PRESENT',
    createdBy: input.createdBy,
  });
}

export async function listInventoryForVehicle(tenantId: string, vehicleId: string): Promise<IVehicleInventoryItem[]> {
  return VehicleInventoryItem.find({ tenantId, vehicleId }).sort({ category: 1, name: 1 });
}

export class InventoryItemNotFoundError extends Error {}

export async function updateInventoryItemStatus(
  tenantId: string,
  itemId: string,
  status: 'PRESENT' | 'MISSING' | 'DAMAGED' | 'REPLACED',
): Promise<IVehicleInventoryItem> {
  const item = await VehicleInventoryItem.findOne({ _id: itemId, tenantId });
  if (!item) throw new InventoryItemNotFoundError(`Inventory item ${itemId} not found`);
  item.status = status;
  await item.save();
  return item;
}
