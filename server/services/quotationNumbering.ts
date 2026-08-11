// Atomic, collision-free Quotation numbering — same Counter pattern as
// inquiryNumbering.ts / leadNumbering.ts. Assigned at creation (unlike
// Invoice numbers, which are deliberately deferred to finalization — a
// Quotation number is a working reference from the moment it's drafted,
// not a GST-relevant sequential financial document, so there's no
// gap-free requirement to protect here).
import { Counter } from '../models/index';

export async function nextQuotationNumber(tenantId: string): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, name: 'quotation_number' },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `QUO-${String(counter.value).padStart(4, '0')}`;
}
