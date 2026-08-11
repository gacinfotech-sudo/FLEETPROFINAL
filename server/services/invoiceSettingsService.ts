import { Counter, InvoiceSettings, IInvoiceSettings } from '../models/index';

const DEFAULTS = {
  taxInvoicePrefix: 'INV', nonGstInvoicePrefix: 'INV', proformaPrefix: 'PI',
  creditNotePrefix: 'CN', debitNotePrefix: 'DN', receiptPrefix: 'RCT', statementPrefix: 'STMT',
  financialYearStartMonth: 4, defaultGstRate: 18,
};

// Plain (non-Document) shape every caller gets back, whether or not the
// tenant has ever saved a real InvoiceSettings row — every optional field
// from the model plus the always-present numbering/GST defaults, so call
// sites never need to branch on "did this tenant configure settings yet."
export type InvoiceSettingsView = Partial<Omit<IInvoiceSettings, keyof import('mongoose').Document>> & typeof DEFAULTS & { tenantId: string };

// Read-only accessor — does NOT create a row on first read. A tenant that
// never opened Invoice Settings still gets sensible defaults everywhere
// (numbering, GST rate); PATCH /api/invoice-settings is the only thing
// that actually persists a row.
export async function getInvoiceSettings(tenantId: string): Promise<InvoiceSettingsView> {
  const existing = await InvoiceSettings.findOne({ tenantId }).lean();
  return { ...DEFAULTS, ...(existing || {}), tenantId } as InvoiceSettingsView;
}

export async function upsertInvoiceSettings(tenantId: string, changes: Record<string, any>, actor: { userId: string; role: string }) {
  const allowlist = [
    'legalCompanyName', 'brandName', 'logoUrl', 'gstNumber', 'panNumber', 'registeredAddress', 'branchAddress',
    'mobile', 'email', 'website', 'taxInvoicePrefix', 'nonGstInvoicePrefix', 'proformaPrefix', 'creditNotePrefix',
    'debitNotePrefix', 'receiptPrefix', 'statementPrefix', 'financialYearStartMonth', 'defaultGstRate',
    'defaultPaymentTerms', 'defaultTermsAndConditions', 'authorizedSignatoryName', 'signatureUrl',
    'bankAccountName', 'bankName', 'bankAccountNumber', 'bankIfsc', 'bankBranch', 'upiId', 'paymentQrUrl',
    'invoiceFooterMessage',
  ];
  const update: Record<string, any> = { updatedBy: actor };
  for (const key of allowlist) {
    if (changes[key] !== undefined) update[key] = changes[key];
  }
  return InvoiceSettings.findOneAndUpdate(
    { tenantId },
    { $set: update, $setOnInsert: { tenantId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

// Indian financial year: April(4)-March by default, configurable per
// tenant. "2026-27" for any date from 2026-04-01 to 2027-03-31 when
// startMonth=4.
export function currentFinancialYear(startMonth: number = 4, at: Date = new Date()): string {
  const month = at.getMonth() + 1; // 1-12
  const year = at.getFullYear();
  const fyStartYear = month >= startMonth ? year : year - 1;
  const shortEnd = String((fyStartYear + 1) % 100).padStart(2, '0');
  return `${fyStartYear}-${shortEnd}`;
}

const PREFIX_FIELD: Record<string, keyof typeof DEFAULTS> = {
  tax_invoice: 'taxInvoicePrefix', non_gst_invoice: 'nonGstInvoicePrefix', proforma_invoice: 'proformaPrefix',
  credit_note: 'creditNotePrefix', debit_note: 'debitNotePrefix', payment_receipt: 'receiptPrefix',
  customer_statement: 'statementPrefix',
};

// Atomic, financial-year-aware, per-document-type sequential numbering —
// "INV/2026-27/0001". Each (tenant, documentType, financialYear) combo
// gets its own counter, so a Credit Note series never shares numbers with
// a Tax Invoice series, and next year's invoices restart at 0001 without
// colliding with this year's. Never reused after cancellation — a
// cancelled/voided invoice keeps the number it was issued, it's simply
// never issued to anyone else since the counter only moves forward.
export async function nextInvoiceNumber(tenantId: string, documentType: string): Promise<string> {
  const settings = await getInvoiceSettings(tenantId);
  const fy = currentFinancialYear(settings.financialYearStartMonth ?? DEFAULTS.financialYearStartMonth);
  const prefixField = PREFIX_FIELD[documentType] || 'taxInvoicePrefix';
  const prefix = (settings as any)[prefixField] || DEFAULTS[prefixField];
  const counterName = `invoice_number_${documentType}_${fy}`;
  const counter = await Counter.findOneAndUpdate(
    { tenantId, name: counterName },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `${prefix}/${fy}/${String(counter.value).padStart(4, '0')}`;
}
