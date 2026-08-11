import { Counter, Vendor, IVendor } from '../models/index';
import { normalizeIndianPhone } from '../whatsapp/phone';

// Atomic increment on a per-tenant counter document — `$inc` inside
// findOneAndUpdate is a single atomic Mongo write, so two concurrent
// vendor creations for the same tenant can never be handed the same
// number (the failure mode a plain `Vendor.countDocuments() + 1` has).
export async function nextVendorCode(tenantId: string): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, name: 'vendor_code' },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `VND-${String(counter.value).padStart(4, '0')}`;
}

export interface CreateVendorInput {
  tenantId: string;
  companyName: string;
  contactPerson: string;
  primaryMobile: string;
  alternateMobile?: string;
  whatsappNumber?: string;
  email?: string;
  address?: IVendor['address'];
  vendorTypes?: string[];
  roles?: string[];
  serviceAreas?: string[];
  businessDetails?: IVendor['businessDetails'];
  bankDetails?: IVendor['bankDetails'];
  defaultCommercialTerms?: IVendor['defaultCommercialTerms'];
  internalNotes?: string;
  createdBy: { userId: string; role: string };
}

export async function createVendor(input: CreateVendorInput) {
  const normalizedMobile = normalizeIndianPhone(input.primaryMobile);
  if (!normalizedMobile) {
    throw new Error(`Invalid mobile number: "${input.primaryMobile}"`);
  }
  const vendorCode = await nextVendorCode(input.tenantId);
  try {
    return await Vendor.create({
      tenantId: input.tenantId,
      vendorCode,
      companyName: input.companyName,
      contactPerson: input.contactPerson,
      primaryMobile: normalizedMobile,
      normalizedMobile,
      alternateMobile: input.alternateMobile,
      whatsappNumber: input.whatsappNumber,
      email: input.email,
      address: input.address,
      vendorTypes: input.vendorTypes || [],
      roles: input.roles || [],
      serviceAreas: input.serviceAreas || [],
      businessDetails: input.businessDetails,
      bankDetails: input.bankDetails,
      defaultCommercialTerms: input.defaultCommercialTerms,
      internalNotes: input.internalNotes,
      status: 'active',
      createdBy: input.createdBy,
    });
  } catch (error: any) {
    // The unique (tenantId, vendorCode) index is the real backstop against
    // a duplicate code slipping through under a race; surface it as a
    // clean, retryable error rather than a raw Mongo duplicate-key throw.
    if (error?.code === 11000 && error?.keyPattern?.vendorCode) {
      throw new Error('Vendor code collision — please retry.');
    }
    throw error;
  }
}
