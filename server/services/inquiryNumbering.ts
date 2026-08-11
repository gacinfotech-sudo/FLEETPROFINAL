// Atomic, collision-free Inquiry numbering — reuses the same Counter
// collection + findOneAndUpdate($inc) pattern already proven for Vendor
// codes and Invoice numbers (see invoiceSettingsService.ts:nextInvoiceNumber).
import { Counter } from '../models/index';

export async function nextInquiryNumber(tenantId: string): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, name: 'inquiry_number' },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `INQ-${String(counter.value).padStart(4, '0')}`;
}
