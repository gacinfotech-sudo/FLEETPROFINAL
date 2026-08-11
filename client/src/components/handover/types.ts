// Shared client-side types for the vehicle handover feature. Mirrors
// server/driver/handover/{types,serialization}.ts's response shapes.
export type HandoverDirection = 'handover' | 'return';
export type HandoverStatus = 'pending_driver_acceptance' | 'accepted' | 'disputed';
export type RemovableItemCondition = 'good' | 'damaged' | 'missing';

export interface RemovableItemInventoryEntry {
  item: string;
  present: boolean;
  condition: RemovableItemCondition;
  notes?: string;
}

export interface ConditionPhotoRef {
  documentId: string;
  angle: 'front' | 'rear' | 'left' | 'right' | 'interior' | 'odometer' | 'other';
  takenAt: string;
}

export interface DiscrepancyFlag {
  type: 'missing_item' | 'damaged_item' | 'new_damage' | 'odometer_discrepancy';
  description: string;
  itemName?: string;
  createdAt: string;
}

// Full staff-facing view (GET /api/vehicle-handovers/:id, /api/vehicles/:id/handovers).
export interface VehicleHandover {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string;
  bookingId?: string;
  direction: HandoverDirection;
  odometerReading: number;
  fuelLevel: number;
  conditionPhotos: ConditionPhotoRef[];
  removableItemInventory: RemovableItemInventoryEntry[];
  damageNoted?: string;
  flags: DiscrepancyFlag[];
  driverAcceptance: { accepted: boolean; acceptedAt?: string; signatureRef?: string };
  staffConductedBy: string;
  conductedAt: string;
  linkedReturnHandoverId?: string;
  status: HandoverStatus;
  isOpenForVehicle: boolean;
  createdAt: string;
  updatedAt: string;
}

// Smaller shape embedded in GET /api/driver-portal/me's pendingHandovers[].
export interface DriverPortalHandoverSummary {
  id: string;
  vehicleId: string;
  direction: HandoverDirection;
  odometerReading: number;
  fuelLevel: number;
  removableItemInventory: RemovableItemInventoryEntry[];
  damageNoted?: string;
  flagCount: number;
  status: HandoverStatus;
  conductedAt: string;
}

export const REMOVABLE_ITEM_PRESETS = ['Spare Tyre', 'Jack', 'Tool Kit', 'First Aid Kit', 'Fire Extinguisher', 'Seat Covers', 'Floor Mats'];

export const PHOTO_ANGLES: ConditionPhotoRef['angle'][] = ['front', 'rear', 'left', 'right', 'interior', 'odometer', 'other'];
