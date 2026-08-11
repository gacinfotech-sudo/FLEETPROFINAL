// Atomic, collision-free Lead numbering — same Counter pattern as
// inquiryNumbering.ts / invoiceSettingsService.ts:nextInvoiceNumber.
import { Counter } from '../models/index';

export async function nextLeadNumber(tenantId: string): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, name: 'lead_number' },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `LEAD-${String(counter.value).padStart(4, '0')}`;
}
