import { nanoid } from 'nanoid';
import {
  Booking, Customer, CustomerBillingProfile, Invoice, PaymentTransaction, Tenant, User,
} from '../models/index';
import { computePaymentSummary } from './paymentLedger';
import { nextInvoiceNumber, getInvoiceSettings } from './invoiceSettingsService';

export const INVOICE_TYPES = [
  'tax_invoice', 'non_gst_invoice', 'proforma_invoice', 'payment_receipt',
  'credit_note', 'debit_note', 'customer_statement',
] as const;

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function error(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function loadContext(input: {
  tenantId: string; customerId: string; bookingId: string; billingProfileId?: string;
  documentType: string; gstRate?: number; discount?: number; tollParkingTreatment?: string;
  serviceDescription?: string; invoiceDate?: string; paymentTerms?: string; bankDetails?: string;
  upiId?: string; termsAndConditions?: string;
}) {
  if (!INVOICE_TYPES.includes(input.documentType as any) || ['credit_note', 'debit_note'].includes(input.documentType)) {
    throw error('Invalid invoice document type. Credit/debit notes must be created from a finalized invoice.');
  }
  const [customer, booking, tenant, owner, invoiceSettings] = await Promise.all([
    Customer.findOne({ _id: input.customerId, tenantId: input.tenantId, isDeleted: { $ne: true } }).lean(),
    Booking.findOne({ _id: input.bookingId, tenantId: input.tenantId, customerId: input.customerId })
      .populate('vehicleId', 'make vehicleModel licensePlate type').lean(),
    Tenant.findById(input.tenantId).lean(),
    User.findOne({ tenantId: input.tenantId, role: 'client' }).select('businessDetails').lean(),
    getInvoiceSettings(input.tenantId),
  ]);
  if (!customer || !booking || !tenant) throw error('Customer or booking not found.', 404);
  if (['cancelled', 'no_show'].includes((booking as any).status)) throw error('Cancelled or no-show bookings are not eligible for an invoice.');

  const billingProfile = input.billingProfileId
    ? await CustomerBillingProfile.findOne({ _id: input.billingProfileId, tenantId: input.tenantId, customerId: input.customerId, isActive: true }).lean()
    : await CustomerBillingProfile.findOne({ tenantId: input.tenantId, customerId: input.customerId, isDefault: true, isActive: true }).lean();
  if (input.billingProfileId && !billingProfile) throw error('Billing profile not found.', 404);

  const paymentRows = await PaymentTransaction.find({ tenantId: input.tenantId, bookingId: input.bookingId }).lean();
  const payment = computePaymentSummary((booking as any).totalAmount || 0, paymentRows);
  const documentType = input.documentType;
  const discount = Math.max(0, Number(input.discount) || 0);
  const gstRate = documentType === 'tax_invoice' ? Math.min(100, Math.max(0, Number(input.gstRate) || invoiceSettings.defaultGstRate || 18)) : 0;
  const tollParkingTreatment = input.tollParkingTreatment === 'separate_non_taxable' ? 'separate_non_taxable' : 'included';
  const tollAmount = Math.max(0, Number((booking as any).tollCharges) || 0);
  const parkingAmount = Math.max(0, Number((booking as any).parkingCharges) || 0);
  const bookingGrossAfterDiscount = Math.max(0, Number((booking as any).totalAmount || 0) - discount);
  const nonTaxable = tollParkingTreatment === 'separate_non_taxable' ? Math.min(bookingGrossAfterDiscount, tollAmount + parkingAmount) : 0;
  const taxableGross = Math.max(0, bookingGrossAfterDiscount - nonTaxable);
  const taxableAmount = gstRate ? roundMoney(taxableGross / (1 + gstRate / 100)) : roundMoney(taxableGross);
  const gstAmount = roundMoney(taxableGross - taxableAmount);
  const totalAmount = roundMoney(taxableGross + nonTaxable);
  const amountReceived = roundMoney(payment.totalReceived);

  const fallbackBilling = (customer as any).billing || {};
  const billingSnapshot = billingProfile ? {
    profileId: billingProfile._id, label: billingProfile.label, customerKind: billingProfile.customerKind,
    billingName: billingProfile.billingName, companyName: billingProfile.companyName,
    gstNumber: billingProfile.gstNumber, panNumber: billingProfile.panNumber,
    billingAddress: billingProfile.billingAddress, billingEmail: billingProfile.billingEmail,
    accountsContact: billingProfile.accountsContact, purchaseOrderNumber: billingProfile.purchaseOrderNumber,
  } : {
    label: 'Customer default', customerKind: (customer as any).customerType === 'corporate' ? 'company' : 'individual',
    billingName: fallbackBilling.billingName || (customer as any).name,
    companyName: (customer as any).companyName, gstNumber: (customer as any).gstNumber,
    panNumber: fallbackBilling.panNumber, billingAddress: fallbackBilling.billingAddress || (customer as any).address,
    billingEmail: fallbackBilling.billingEmail || (customer as any).email,
    accountsContact: fallbackBilling.accountsContact,
  };
  const business = (owner as any)?.businessDetails || {};

  return {
    tenantId: input.tenantId,
    customerId: (customer as any)._id,
    bookingId: (booking as any)._id,
    billingProfileId: billingProfile?._id,
    documentType,
    invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
    customerSnapshot: {
      customerId: (customer as any).customerCode || (customer as any)._id,
      name: (customer as any).name, mobile: (customer as any).primaryMobile, email: (customer as any).email,
      customerType: (customer as any).customerType,
    },
    billingSnapshot,
    // InvoiceSettings (once a tenant has configured it) wins over the
    // older, more generic User.businessDetails — that field stays exactly
    // as-is and remains the fallback for any tenant that never opened
    // Invoice Settings.
    businessSnapshot: {
      businessName: invoiceSettings.legalCompanyName || business.businessName || (tenant as any).businessName || (tenant as any).name,
      brandName: invoiceSettings.brandName,
      ownerName: business.ownerName,
      address: invoiceSettings.registeredAddress || business.businessAddress || (tenant as any).address,
      branchAddress: invoiceSettings.branchAddress,
      gstNumber: invoiceSettings.gstNumber || business.gstNumber,
      panNumber: invoiceSettings.panNumber,
      email: invoiceSettings.email || business.businessEmail || (tenant as any).email,
      phone: invoiceSettings.mobile || business.businessPhone || (tenant as any).phone,
      website: invoiceSettings.website,
      logoUrl: invoiceSettings.logoUrl || business.logoUrl,
      signatureUrl: invoiceSettings.signatureUrl || business.signatureUrl,
      authorizedSignatoryName: invoiceSettings.authorizedSignatoryName,
      bankAccountName: invoiceSettings.bankAccountName, bankName: invoiceSettings.bankName,
      bankAccountNumber: invoiceSettings.bankAccountNumber, bankIfsc: invoiceSettings.bankIfsc,
      bankBranch: invoiceSettings.bankBranch, paymentQrUrl: invoiceSettings.paymentQrUrl,
      invoiceFooterMessage: invoiceSettings.invoiceFooterMessage,
    },
    bookingSnapshot: {
      bookingNumber: (booking as any).bookingId, bookingCode: (booking as any).bookingCode, pickupDate: (booking as any).pickupDate,
      returnDate: (booking as any).returnDate, pickupTime: (booking as any).pickupTime, returnTime: (booking as any).returnTime,
      pickupLocation: (booking as any).pickupLocation, dropoffLocation: (booking as any).dropoffLocation,
      bookingType: (booking as any).bookingType, tripType: (booking as any).tripType,
      vehicle: (booking as any).vehicleId ? {
        name: [(booking as any).vehicleId.make, (booking as any).vehicleId.vehicleModel].filter(Boolean).join(' '),
        registration: (booking as any).vehicleId.licensePlate, category: (booking as any).vehicleId.type,
      } : undefined,
      bookingTotal: (booking as any).totalAmount || 0,
    },
    serviceDescription: input.serviceDescription?.trim() || `Transport service: ${(booking as any).pickupLocation} to ${(booking as any).dropoffLocation || '-'}`,
    gstRate, discount, tollParkingTreatment, taxableAmount, gstAmount,
    tollAmount, parkingAmount, adjustmentAmount: 0, totalAmount,
    amountReceived, balanceDue: roundMoney(Math.max(0, totalAmount - amountReceived)),
    paymentTerms: input.paymentTerms || billingProfile?.paymentTerms
      || (fallbackBilling.creditPeriodDays ? `Net ${fallbackBilling.creditPeriodDays} days` : undefined)
      || invoiceSettings.defaultPaymentTerms,
    bankDetails: input.bankDetails || fallbackBilling.bankPaymentInstructions
      || (invoiceSettings.bankAccountNumber ? [invoiceSettings.bankAccountName, invoiceSettings.bankName, invoiceSettings.bankAccountNumber && `A/C ${invoiceSettings.bankAccountNumber}`, invoiceSettings.bankIfsc && `IFSC ${invoiceSettings.bankIfsc}`].filter(Boolean).join(', ') : undefined),
    upiId: input.upiId || invoiceSettings.upiId,
    termsAndConditions: input.termsAndConditions || invoiceSettings.defaultTermsAndConditions
      || 'Payment is subject to the agreed booking terms and cancellation policy.',
  };
}

export async function previewInvoice(input: Parameters<typeof loadContext>[0]) {
  return loadContext(input);
}

function bookingReference(value: any) {
  const booking = value?.bookingId;
  return booking?._id?.toString?.() || booking?.toString?.();
}

export async function addCurrentInvoiceSettlements(invoices: any[]) {
  const rows = invoices.map((invoice) => invoice?.toObject ? invoice.toObject() : invoice);
  const bookingIds = [...new Set(rows.map(bookingReference).filter(Boolean))];
  if (!bookingIds.length) return rows.map((invoice) => ({
    ...invoice, currentAmountReceived: invoice.amountReceived, currentBalanceDue: invoice.balanceDue,
  }));
  const tenantIds = [...new Set(rows.map((invoice) => invoice.tenantId?.toString?.()).filter(Boolean))];
  const payments = await PaymentTransaction.find({ tenantId: { $in: tenantIds }, bookingId: { $in: bookingIds } }).lean();
  const byBooking = new Map<string, any[]>();
  for (const payment of payments as any[]) {
    const key = payment.bookingId.toString();
    byBooking.set(key, [...(byBooking.get(key) || []), payment]);
  }
  return rows.map((invoice) => {
    if (['credit_note', 'debit_note'].includes(invoice.documentType)) {
      return { ...invoice, currentAmountReceived: invoice.amountReceived, currentBalanceDue: invoice.balanceDue };
    }
    const key = bookingReference(invoice);
    const settlement = computePaymentSummary(invoice.totalAmount || 0, key ? byBooking.get(key) || [] : []);
    return {
      ...invoice,
      currentAmountReceived: roundMoney(settlement.totalReceived),
      currentBalanceDue: roundMoney(Math.max(0, (invoice.totalAmount || 0) - settlement.totalReceived)),
    };
  });
}

export async function createInvoiceDraft(input: Parameters<typeof loadContext>[0] & {
  invoiceNumber?: string; actor: { userId: string; role: string };
}) {
  const sourceKey = `${input.tenantId}_${input.bookingId}_${input.documentType}_initial`;
  const existing = await Invoice.findOne({ tenantId: input.tenantId, sourceKey });
  if (existing) return { invoice: existing, alreadyExists: true };
  const context = await loadContext(input);
  try {
    // No number assigned here on purpose — a draft that's discarded or
    // never finalized must never have consumed a real sequence number
    // (the whole point of an atomic, gap-free financial-year series).
    // A caller MAY still pass an explicit invoiceNumber (e.g. importing a
    // pre-numbered legacy document); that manual value is honored as-is.
    const invoice = await Invoice.create({
      ...context, sourceKey, invoiceNumber: input.invoiceNumber?.trim() || undefined,
      status: 'draft', revisionNumber: 1, createdBy: input.actor,
    });
    return { invoice, alreadyExists: false };
  } catch (cause: any) {
    if (cause?.code === 11000) {
      const winner = await Invoice.findOne({ tenantId: input.tenantId, sourceKey });
      if (winner) return { invoice: winner, alreadyExists: true };
      throw error('Invoice number already exists.', 409);
    }
    throw cause;
  }
}

export async function updateInvoiceDraft(tenantId: string, invoiceId: string, changes: any, actor: { userId: string; role: string }) {
  const invoice = await Invoice.findOne({ _id: invoiceId, tenantId });
  if (!invoice) throw error('Invoice not found.', 404);
  if (invoice.status !== 'draft') throw error('Finalized invoices cannot be edited. Create a revision, credit note, or debit note.', 409);
  if (invoice.relatedInvoiceId) {
    for (const key of ['invoiceDate', 'adjustmentAmount', 'adjustmentReason', 'paymentTerms', 'bankDetails', 'upiId', 'termsAndConditions']) {
      if (changes[key] !== undefined) (invoice as any)[key] = changes[key];
    }
  } else {
    const context = await loadContext({
      tenantId, customerId: invoice.customerId.toString(), bookingId: invoice.bookingId!.toString(),
      billingProfileId: changes.billingProfileId || invoice.billingProfileId?.toString(),
      documentType: invoice.documentType, gstRate: changes.gstRate ?? invoice.gstRate,
      discount: changes.discount ?? invoice.discount, tollParkingTreatment: changes.tollParkingTreatment || invoice.tollParkingTreatment,
      serviceDescription: changes.serviceDescription ?? invoice.serviceDescription,
      invoiceDate: changes.invoiceDate || invoice.invoiceDate.toISOString(), paymentTerms: changes.paymentTerms ?? invoice.paymentTerms,
      bankDetails: changes.bankDetails ?? invoice.bankDetails, upiId: changes.upiId ?? invoice.upiId,
      termsAndConditions: changes.termsAndConditions ?? invoice.termsAndConditions,
    });
    Object.assign(invoice, context);
  }
  if (changes.invoiceNumber && changes.invoiceNumber.trim() !== invoice.invoiceNumber) invoice.invoiceNumber = changes.invoiceNumber.trim();
  invoice.updatedBy = actor;
  invoice.updatedAt = new Date();
  try { await invoice.save(); } catch (cause: any) { if (cause?.code === 11000) throw error('Invoice number already exists.', 409); throw cause; }
  return invoice;
}

export async function finalizeInvoice(tenantId: string, invoiceId: string, actor: { userId: string; role: string }) {
  const invoice = await Invoice.findOne({ _id: invoiceId, tenantId });
  if (!invoice) throw error('Invoice not found.', 404);
  if (invoice.status === 'finalized') return invoice;
  if (invoice.status !== 'draft') throw error('Only a draft invoice can be finalized.', 409);
  if (invoice.totalAmount < 0) throw error('Invoice is incomplete.');
  // The real, sequential, financial-year-aware number is issued HERE —
  // the one moment an invoice becomes a real, immutable financial
  // document — not at draft creation. A manually-assigned number (set
  // via createInvoiceDraft's explicit override, or updateInvoiceDraft)
  // is honored as-is and not replaced.
  if (!invoice.invoiceNumber) {
    invoice.invoiceNumber = await nextInvoiceNumber(tenantId, invoice.documentType);
  }
  invoice.status = 'finalized';
  invoice.finalizedBy = actor;
  invoice.finalizedAt = new Date();
  invoice.updatedAt = new Date();
  try {
    await invoice.save();
  } catch (cause: any) {
    if (cause?.code === 11000) throw error('Invoice number already exists.', 409);
    throw cause;
  }
  return invoice;
}

export async function reviseInvoice(tenantId: string, invoiceId: string, actor: { userId: string; role: string }) {
  const original = await Invoice.findOne({ _id: invoiceId, tenantId }).lean();
  if (!original) throw error('Invoice not found.', 404);
  if (original.status !== 'finalized') throw error('Only finalized invoices can be revised.', 409);
  const revisionNumber = (await Invoice.countDocuments({ tenantId, parentInvoiceId: original._id })) + 2;
  const copy: any = { ...original };
  delete copy._id; delete copy.__v; delete copy.sourceKey; delete copy.finalizedAt; delete copy.finalizedBy;
  return Invoice.create({
    ...copy, invoiceNumber: `${original.invoiceNumber}-R${revisionNumber}`, status: 'draft',
    sourceKey: `${tenantId}_${original._id}_revision_${revisionNumber}_${nanoid(6)}`,
    revisionNumber, parentInvoiceId: original._id, createdBy: actor, updatedBy: undefined,
    createdAt: new Date(), updatedAt: new Date(),
  });
}

export async function createAdjustmentNote(input: {
  tenantId: string; invoiceId: string; noteType: 'credit_note' | 'debit_note';
  amount: number; reason: string; actor: { userId: string; role: string };
}) {
  if (!['credit_note', 'debit_note'].includes(input.noteType)) throw error('noteType must be credit_note or debit_note.');
  const original = await Invoice.findOne({ _id: input.invoiceId, tenantId: input.tenantId }).lean();
  if (!original) throw error('Invoice not found.', 404);
  if (original.status !== 'finalized') throw error('Adjustment notes require a finalized invoice.', 409);
  const amount = roundMoney(Number(input.amount));
  if (!amount || amount <= 0) throw error('A positive adjustment amount is required.');
  if (input.noteType === 'credit_note' && amount > original.totalAmount) throw error('Credit note cannot exceed the original invoice total.');
  if (!input.reason?.trim()) throw error('Adjustment reason is required.');
  // Same deferred-numbering rule as createInvoiceDraft — a credit/debit
  // note draft gets its real number only when IT is finalized, not when
  // it's first created here.
  return Invoice.create({
    tenantId: input.tenantId, customerId: original.customerId, bookingId: original.bookingId,
    billingProfileId: original.billingProfileId,
    sourceKey: `${input.tenantId}_${original._id}_${input.noteType}_${nanoid(8)}`,
    documentType: input.noteType, status: 'draft', revisionNumber: 1, relatedInvoiceId: original._id,
    invoiceDate: new Date(), customerSnapshot: original.customerSnapshot, billingSnapshot: original.billingSnapshot,
    businessSnapshot: original.businessSnapshot, bookingSnapshot: original.bookingSnapshot,
    serviceDescription: `${input.noteType === 'credit_note' ? 'Credit' : 'Debit'} adjustment against ${original.invoiceNumber}`,
    gstRate: 0, discount: 0, tollParkingTreatment: 'included', taxableAmount: amount, gstAmount: 0,
    tollAmount: 0, parkingAmount: 0, adjustmentAmount: amount, totalAmount: amount,
    amountReceived: 0, balanceDue: input.noteType === 'debit_note' ? amount : 0,
    paymentTerms: original.paymentTerms, bankDetails: original.bankDetails, upiId: original.upiId,
    termsAndConditions: original.termsAndConditions, adjustmentReason: input.reason.trim(), createdBy: input.actor,
  });
}
