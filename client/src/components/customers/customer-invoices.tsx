import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Download, FilePenLine, FileText, Mail, MessageCircle, Plus, Printer, ReceiptText, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_PROFILE: Record<string, any> = {
  label: '', customerKind: 'individual', billingName: '', companyName: '', gstNumber: '', panNumber: '',
  billingAddress: '', billingEmail: '', accountsContact: '', purchaseOrderNumber: '', paymentTerms: '',
  creditPeriodDays: '', tdsInformation: '', isDefault: false,
};

const EMPTY_INVOICE: Record<string, any> = {
  bookingId: '', billingProfileId: 'default', documentType: 'tax_invoice', invoiceDate: new Date().toISOString().slice(0, 10),
  serviceDescription: '', gstRate: '18', discount: '0', tollParkingTreatment: 'included', paymentTerms: '',
  bankDetails: '', upiId: '', termsAndConditions: 'Payment is subject to the agreed booking terms and cancellation policy.',
};

const money = (value?: number) => `₹${(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const settledReceived = (invoice: any) => invoice.currentAmountReceived ?? invoice.amountReceived ?? 0;
const settledBalance = (invoice: any) => invoice.currentBalanceDue ?? invoice.balanceDue ?? 0;
const safe = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char));
// A draft no longer gets a real invoiceNumber until it's finalized (the
// number is only issued at that point, so a discarded draft never burns
// a sequence number) — show this placeholder anywhere a number would
// otherwise render as the literal string "undefined".
const docNumber = (invoice: any) => invoice?.invoiceNumber || 'DRAFT (not yet numbered)';

function invoiceFormFrom(invoice: any) {
  return {
    bookingId: invoice.bookingId?._id || invoice.bookingId || '', billingProfileId: invoice.billingProfileId || 'default',
    documentType: invoice.documentType, invoiceDate: String(invoice.invoiceDate).slice(0, 10),
    invoiceNumber: invoice.invoiceNumber, serviceDescription: invoice.serviceDescription, gstRate: String(invoice.gstRate || 0),
    discount: String(invoice.discount || 0), tollParkingTreatment: invoice.tollParkingTreatment,
    paymentTerms: invoice.paymentTerms || '', bankDetails: invoice.bankDetails || '', upiId: invoice.upiId || '',
    termsAndConditions: invoice.termsAndConditions || '',
  };
}

function InvoiceDocument({ invoice }: { invoice: any }) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    if (!invoice?.upiId) return setQr('');
    const uri = `upi://pay?pa=${encodeURIComponent(invoice.upiId)}&pn=${encodeURIComponent(invoice.businessSnapshot?.businessName || '')}&am=${settledBalance(invoice)}&cu=INR`;
    QRCode.toDataURL(uri, { width: 150, margin: 1 }).then(setQr).catch(() => setQr(''));
  }, [invoice]);
  if (!invoice) return null;
  return (
    <div className="bg-white border rounded-lg p-6 space-y-5 text-sm" id={`invoice-${invoice._id}`}>
      <div className="flex justify-between gap-4">
        <div><h3 className="text-xl font-bold">{invoice.businessSnapshot?.businessName}</h3><p>{invoice.businessSnapshot?.address}</p><p>{invoice.businessSnapshot?.gstNumber ? `GST: ${invoice.businessSnapshot.gstNumber}` : ''}</p></div>
        <div className="text-right"><p className="font-bold text-lg capitalize">{invoice.documentType.replace(/_/g, ' ')}</p><p>{docNumber(invoice)}</p><p>{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</p><Badge className="mt-1 capitalize" variant={invoice.status === 'finalized' ? 'outline' : 'secondary'}>{invoice.status}</Badge></div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-y py-4">
        <div><p className="text-gray-500">Bill To</p><p className="font-semibold">{invoice.billingSnapshot?.billingName}</p><p>{invoice.billingSnapshot?.companyName}</p><p>{invoice.billingSnapshot?.billingAddress}</p><p>{invoice.billingSnapshot?.billingEmail}</p><p>{invoice.billingSnapshot?.gstNumber ? `GST: ${invoice.billingSnapshot.gstNumber}` : ''}</p></div>
        <div><p className="text-gray-500">Booking</p><p className="font-semibold">{invoice.bookingSnapshot?.bookingNumber}{invoice.bookingSnapshot?.bookingCode ? ` (${invoice.bookingSnapshot.bookingCode})` : ''}</p><p>{invoice.bookingSnapshot?.pickupLocation} → {invoice.bookingSnapshot?.dropoffLocation || '-'}</p><p>{invoice.bookingSnapshot?.vehicle?.name} {invoice.bookingSnapshot?.vehicle?.registration}</p><p>{invoice.bookingSnapshot?.pickupDate ? new Date(invoice.bookingSnapshot.pickupDate).toLocaleDateString('en-IN') : ''}</p></div>
      </div>
      <div><p className="text-gray-500">Service</p><p className="font-medium">{invoice.serviceDescription}</p></div>
      <div className="ml-auto max-w-sm space-y-2">
        <div className="flex justify-between"><span>Taxable amount</span><strong>{money(invoice.taxableAmount)}</strong></div>
        {invoice.gstAmount > 0 && <div className="flex justify-between"><span>GST ({invoice.gstRate}%)</span><strong>{money(invoice.gstAmount)}</strong></div>}
        {invoice.tollParkingTreatment === 'separate_non_taxable' && <><div className="flex justify-between"><span>Toll</span><strong>{money(invoice.tollAmount)}</strong></div><div className="flex justify-between"><span>Parking</span><strong>{money(invoice.parkingAmount)}</strong></div></>}
        {invoice.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><strong>-{money(invoice.discount)}</strong></div>}
        <div className="flex justify-between border-t pt-2 text-lg"><span>Total</span><strong>{money(invoice.totalAmount)}</strong></div>
        <div className="flex justify-between"><span>Received</span><strong>{money(settledReceived(invoice))}</strong></div>
        <div className="flex justify-between text-red-700"><span>Balance</span><strong>{money(settledBalance(invoice))}</strong></div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-4 items-end border-t pt-4">
        <div><p><strong>Payment terms:</strong> {invoice.paymentTerms || '-'}</p><p className="whitespace-pre-wrap"><strong>Bank details:</strong> {invoice.bankDetails || '-'}</p><p><strong>UPI:</strong> {invoice.upiId || '-'}</p><p className="mt-2 whitespace-pre-wrap text-xs text-gray-500">{invoice.termsAndConditions}</p>{invoice.adjustmentReason && <p className="mt-2"><strong>Adjustment reason:</strong> {invoice.adjustmentReason}</p>}</div>
        {qr && <img src={qr} alt="UPI payment QR" className="h-28 w-28" />}
      </div>
    </div>
  );
}

export default function CustomerInvoices({ customerId, customer, bookings, requestedBookingId, onRequestHandled }: {
  customerId: string; customer: any; bookings: any[]; requestedBookingId?: string | null; onRequestHandled?: () => void;
}) {
  const { toast } = useToast();
  const { canGenerateInvoice } = usePermissions();
  const queryClient = useQueryClient();
  const [profileDialog, setProfileDialog] = useState(false);
  const [profileForm, setProfileForm] = useState({ ...EMPTY_PROFILE });
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ ...EMPTY_INVOICE });
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [adjustment, setAdjustment] = useState<any>(null);
  const [adjustmentForm, setAdjustmentForm] = useState({ amount: '', reason: '' });

  const { data: profiles = [] } = useQuery<any[]>({ queryKey: [`/api/customers/${customerId}/billing-profiles`] });
  const { data: invoices = [] } = useQuery<any[]>({ queryKey: [`/api/customers/${customerId}/invoices`] });
  const eligibleBookings = bookings.filter((booking) => !['cancelled', 'no_show'].includes(booking.status));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/billing-profiles`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/invoices`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/timeline`] });
  };

  const openNewInvoice = (bookingId?: string) => {
    const defaultProfile = profiles.find((profile: any) => profile.isDefault);
    setEditingInvoice(null); setPreview(null);
    setInvoiceForm({ ...EMPTY_INVOICE, bookingId: bookingId || eligibleBookings[0]?._id || '', billingProfileId: defaultProfile?._id || 'default' });
    setInvoiceDialog(true);
  };
  useEffect(() => {
    if (requestedBookingId) { openNewInvoice(requestedBookingId); onRequestHandled?.(); }
  }, [requestedBookingId]);

  // Auto-save forms
  const { save: autoSaveProfile } = useFormAutoSave('billing-profile-form', profileForm, 2000);
  const { save: autoSaveInvoice } = useFormAutoSave('invoice-form', invoiceForm, 2000);
  const { save: autoSaveAdjustment } = useFormAutoSave('adjustment-form', adjustmentForm, 2000);

  useEffect(() => {
    if (profileDialog) autoSaveProfile();
  }, [profileForm, profileDialog, autoSaveProfile]);

  useEffect(() => {
    if (invoiceDialog) autoSaveInvoice();
  }, [invoiceForm, invoiceDialog, autoSaveInvoice]);

  useEffect(() => {
    if (adjustment) autoSaveAdjustment();
  }, [adjustmentForm, adjustment, autoSaveAdjustment]);

  const profileMutation = useMutation({
    mutationFn: async () => {
      const url = editingProfile ? `/api/customers/${customerId}/billing-profiles/${editingProfile._id}` : `/api/customers/${customerId}/billing-profiles`;
      return (await apiRequest(editingProfile ? 'PUT' : 'POST', url, { ...profileForm, creditPeriodDays: profileForm.creditPeriodDays ? Number(profileForm.creditPeriodDays) : undefined })).json();
    },
    onSuccess: () => { toast({ title: 'Billing profile saved' }); setProfileDialog(false); setEditingProfile(null); invalidate(); },
    onError: (error: any) => toast({ title: 'Could not save billing profile', description: error.message, variant: 'destructive' }),
  });
  const defaultMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest('POST', `/api/customers/${customerId}/billing-profiles/${id}/set-default`, {})).json(),
    onSuccess: invalidate,
  });
  const previewMutation = useMutation({
    mutationFn: async () => (await apiRequest('POST', `/api/customers/${customerId}/invoices/preview`, {
      ...invoiceForm, billingProfileId: invoiceForm.billingProfileId === 'default' ? undefined : invoiceForm.billingProfileId,
      gstRate: Number(invoiceForm.gstRate), discount: Number(invoiceForm.discount),
    })).json(),
    onSuccess: setPreview,
    onError: (error: any) => toast({ title: 'Preview failed', description: error.message, variant: 'destructive' }),
  });
  const saveInvoiceMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...invoiceForm, billingProfileId: invoiceForm.billingProfileId === 'default' ? undefined : invoiceForm.billingProfileId, gstRate: Number(invoiceForm.gstRate), discount: Number(invoiceForm.discount) };
      return editingInvoice
        ? (await apiRequest('PUT', `/api/invoices/${editingInvoice._id}`, payload)).json()
        : (await apiRequest('POST', `/api/customers/${customerId}/invoices`, payload)).json();
    },
    onSuccess: (result: any) => { toast({ title: editingInvoice ? 'Draft updated' : result.alreadyExists ? 'Existing draft opened' : 'Invoice draft saved' }); setInvoiceDialog(false); setPreview(null); setViewingInvoice(result.invoice || result); invalidate(); },
    onError: (error: any) => toast({ title: 'Could not save invoice', description: error.message, variant: 'destructive' }),
  });
  const finalizeMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest('POST', `/api/invoices/${id}/finalize`, {})).json(),
    onSuccess: (invoice: any) => { toast({ title: 'Invoice finalized and locked' }); setViewingInvoice(invoice); invalidate(); },
  });
  const reviseMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest('POST', `/api/invoices/${id}/revise`, {})).json(),
    onSuccess: (invoice: any) => { toast({ title: 'Revision draft created' }); setViewingInvoice(null); setEditingInvoice(invoice); setInvoiceForm(invoiceFormFrom(invoice)); setPreview(invoice); setInvoiceDialog(true); invalidate(); },
  });
  const adjustmentMutation = useMutation({
    mutationFn: async () => (await apiRequest('POST', `/api/invoices/${adjustment.invoice._id}/adjustment-note`, { noteType: adjustment.type, amount: Number(adjustmentForm.amount), reason: adjustmentForm.reason })).json(),
    onSuccess: (invoice: any) => { toast({ title: `${adjustment.type === 'credit_note' ? 'Credit' : 'Debit'} note draft created` }); setAdjustment(null); setViewingInvoice(invoice); invalidate(); },
  });

  const downloadPdf = async (invoice: any) => {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    pdf.setFontSize(18); pdf.text(invoice.businessSnapshot?.businessName || 'Invoice', 18, 18);
    pdf.setFontSize(13); pdf.text(invoice.documentType.replace(/_/g, ' ').toUpperCase(), 18, 29);
    pdf.setFontSize(10);
    const lines = [
      `Document: ${docNumber(invoice)}`, `Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}`,
      `Bill to: ${invoice.billingSnapshot?.billingName}`, `Company: ${invoice.billingSnapshot?.companyName || '-'}`,
      `GST: ${invoice.billingSnapshot?.gstNumber || '-'}`, `Booking: ${invoice.bookingSnapshot?.bookingNumber || '-'}`,
      `Route: ${invoice.bookingSnapshot?.pickupLocation || '-'} to ${invoice.bookingSnapshot?.dropoffLocation || '-'}`,
      `Service: ${invoice.serviceDescription}`, `Taxable: INR ${invoice.taxableAmount}`, `GST: INR ${invoice.gstAmount}`,
      `Total: INR ${invoice.totalAmount}`, `Received: INR ${settledReceived(invoice)}`, `Balance: INR ${settledBalance(invoice)}`,
      `Payment terms: ${invoice.paymentTerms || '-'}`, `Bank: ${invoice.bankDetails || '-'}`, `UPI: ${invoice.upiId || '-'}`,
      `Status: ${invoice.status}`,
    ];
    lines.forEach((line, index) => pdf.text(line, 18, 42 + index * 8));
    pdf.save(`${docNumber(invoice).replace(/[^a-z0-9]+/gi, '-')}.pdf`);
  };
  const printInvoice = (invoice: any) => {
    const win = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900'); if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${safe(docNumber(invoice))}</title><style>body{font-family:Arial;padding:40px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:8px 0}.total{font-size:22px;font-weight:bold}</style></head><body><h1>${safe(invoice.businessSnapshot?.businessName)}</h1><h2>${safe(invoice.documentType.replace(/_/g, ' '))}</h2><div class="row"><span>Document</span><b>${safe(docNumber(invoice))}</b></div><div class="row"><span>Bill to</span><b>${safe(invoice.billingSnapshot?.billingName)}</b></div><div class="row"><span>Booking</span><b>${safe(invoice.bookingSnapshot?.bookingNumber)}</b></div><div class="row total"><span>Total</span><b>${safe(money(invoice.totalAmount))}</b></div><div class="row"><span>Received</span><b>${safe(money(settledReceived(invoice)))}</b></div><div class="row"><span>Balance</span><b>${safe(money(settledBalance(invoice)))}</b></div><script>window.print();window.close();</script></body></html>`); win.document.close();
  };

  return (
    <Card>
      <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3 flex-wrap"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5 text-violet-600" /> Invoices & Billing Profiles</CardTitle><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setProfileDialog(true)}>Billing Profiles ({profiles.length})</Button><Button size="sm" disabled={!eligibleBookings.length} onClick={() => openNewInvoice()}><Plus className="h-4 w-4 mr-1" /> Create Invoice</Button></div></div></CardHeader>
      <CardContent>
        {invoices.length === 0 ? <p className="text-sm text-gray-500">No saved invoices yet.</p> : <div className="overflow-x-auto border rounded-lg"><Table><TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Booking</TableHead><TableHead>Total</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{invoices.map((invoice: any) => <TableRow key={invoice._id}><TableCell className="font-medium">{docNumber(invoice)}</TableCell><TableCell className="capitalize">{invoice.documentType.replace(/_/g, ' ')}</TableCell><TableCell>{invoice.bookingId?.bookingId || invoice.bookingSnapshot?.bookingNumber || '-'}{(invoice.bookingId?.bookingCode || invoice.bookingSnapshot?.bookingCode) ? ` (${invoice.bookingId?.bookingCode || invoice.bookingSnapshot?.bookingCode})` : ''}</TableCell><TableCell>{money(invoice.totalAmount)}</TableCell><TableCell>{money(settledBalance(invoice))}</TableCell><TableCell><Badge variant="outline" className="capitalize">{invoice.status}</Badge></TableCell><TableCell className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setViewingInvoice(invoice)}>View</Button>{invoice.status === 'draft' && <Button size="sm" variant="ghost" onClick={() => { setEditingInvoice(invoice); setInvoiceForm(invoiceFormFrom(invoice)); setPreview(invoice); setInvoiceDialog(true); }}><FilePenLine className="h-4 w-4" /></Button>}</TableCell></TableRow>)}</TableBody></Table></div>}
      </CardContent>

      <Dialog open={profileDialog} onOpenChange={(open) => { setProfileDialog(open); if (!open) { setEditingProfile(null); setProfileForm({ ...EMPTY_PROFILE }); } }}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Billing Profiles</DialogTitle></DialogHeader><div className="space-y-3">{profiles.map((profile: any) => <div key={profile._id} className="border rounded-lg p-3 flex justify-between gap-3"><div><p className="font-semibold">{profile.label} {profile.isDefault && <Badge className="ml-1">Default</Badge>}</p><p className="text-sm">{profile.billingName} {profile.companyName ? `· ${profile.companyName}` : ''}</p><p className="text-xs text-gray-500">{profile.gstNumber ? `GST ${profile.gstNumber} · ` : ''}{profile.billingAddress}</p></div><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => { setEditingProfile(profile); setProfileForm({ ...EMPTY_PROFILE, ...profile, creditPeriodDays: profile.creditPeriodDays ?? '' }); }}>Edit</Button>{!profile.isDefault && <Button size="sm" variant="ghost" onClick={() => defaultMutation.mutate(profile._id)}><Star className="h-4 w-4 mr-1" /> Default</Button>}</div></div>)}</div><div className="border-t pt-4"><p className="font-semibold mb-3">{editingProfile ? 'Edit Profile' : 'Add Profile'}</p><div className="grid grid-cols-2 gap-3">{[['label','Profile Label'],['billingName','Billing Name'],['companyName','Company Name'],['gstNumber','GST Number'],['panNumber','PAN'],['billingEmail','Billing Email'],['accountsContact','Accounts Contact'],['purchaseOrderNumber','Purchase Order'],['creditPeriodDays','Credit Period Days'],['tdsInformation','TDS Information'],['paymentTerms','Payment Terms']].map(([key,label]) => <div key={key}><Label>{label}</Label><Input value={profileForm[key]} type={key === 'creditPeriodDays' ? 'number' : 'text'} onChange={(event) => setProfileForm({ ...profileForm, [key]: event.target.value })} /></div>)}<div className="col-span-2"><Label>Billing Address</Label><Textarea value={profileForm.billingAddress} onChange={(event) => setProfileForm({ ...profileForm, billingAddress: event.target.value })} /></div></div></div><FormSubmitStatus status={profileMutation.isPending ? 'loading' : profileMutation.isSuccess ? 'success' : 'idle'} successMessage="Profile saved" />
          <DialogFooter><Button variant="outline" onClick={() => { setEditingProfile(null); setProfileForm({ ...EMPTY_PROFILE }); }}>Clear</Button><Button disabled={!profileForm.label.trim() || !profileForm.billingName.trim() || profileMutation.isPending} onClick={() => profileMutation.mutate()}>Save Profile</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={invoiceDialog} onOpenChange={setInvoiceDialog}><DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingInvoice ? `Edit Draft ${docNumber(editingInvoice)}` : 'Create Invoice'}</DialogTitle></DialogHeader><div className="grid lg:grid-cols-[380px_1fr] gap-5"><div className="space-y-3"><div><Label>Booking</Label><Select disabled={!!editingInvoice} value={invoiceForm.bookingId} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, bookingId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{eligibleBookings.map((booking) => <SelectItem key={booking._id} value={booking._id}>{booking.bookingId} · {booking.pickupLocation} → {booking.dropoffLocation || '-'}</SelectItem>)}</SelectContent></Select></div><div><Label>Document Type</Label><Select disabled={!!editingInvoice} value={invoiceForm.documentType} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, documentType: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tax_invoice">Tax Invoice</SelectItem><SelectItem value="non_gst_invoice">Non-GST Invoice</SelectItem><SelectItem value="proforma_invoice">Proforma Invoice</SelectItem><SelectItem value="payment_receipt">Payment Receipt</SelectItem><SelectItem value="customer_statement">Customer Statement</SelectItem></SelectContent></Select></div><div><Label>Billing Profile</Label><Select value={invoiceForm.billingProfileId} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, billingProfileId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Customer Default</SelectItem>{profiles.map((profile: any) => <SelectItem key={profile._id} value={profile._id}>{profile.label}{profile.isDefault ? ' (Default)' : ''}</SelectItem>)}</SelectContent></Select></div>{editingInvoice && <div><Label>Invoice Number</Label><Input value={invoiceForm.invoiceNumber || ''} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceNumber: event.target.value })} /></div>}<div><Label>Invoice Date</Label><Input type="date" value={invoiceForm.invoiceDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceDate: event.target.value })} /></div><div><Label>Service Description</Label><Textarea value={invoiceForm.serviceDescription} onChange={(event) => setInvoiceForm({ ...invoiceForm, serviceDescription: event.target.value })} /></div><div className="grid grid-cols-2 gap-2"><div><Label>GST Rate %</Label><Input type="number" value={invoiceForm.gstRate} disabled={invoiceForm.documentType !== 'tax_invoice'} onChange={(event) => setInvoiceForm({ ...invoiceForm, gstRate: event.target.value })} /></div><div><Label>Discount</Label><Input type="number" value={invoiceForm.discount} onChange={(event) => setInvoiceForm({ ...invoiceForm, discount: event.target.value })} /></div></div><div><Label>Toll/Parking</Label><Select value={invoiceForm.tollParkingTreatment} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, tollParkingTreatment: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="included">Included in taxable value</SelectItem><SelectItem value="separate_non_taxable">Separate non-taxable</SelectItem></SelectContent></Select></div><div><Label>Payment Terms</Label><Input value={invoiceForm.paymentTerms} onChange={(event) => setInvoiceForm({ ...invoiceForm, paymentTerms: event.target.value })} /></div><div><Label>Bank Details</Label><Textarea value={invoiceForm.bankDetails} onChange={(event) => setInvoiceForm({ ...invoiceForm, bankDetails: event.target.value })} /></div><div><Label>UPI ID</Label><Input value={invoiceForm.upiId} onChange={(event) => setInvoiceForm({ ...invoiceForm, upiId: event.target.value })} /></div><div><Label>Terms & Conditions</Label><Textarea value={invoiceForm.termsAndConditions} onChange={(event) => setInvoiceForm({ ...invoiceForm, termsAndConditions: event.target.value })} /></div><div className="flex gap-2"><Button variant="outline" disabled={!invoiceForm.bookingId || previewMutation.isPending} onClick={() => previewMutation.mutate()}>Preview</Button><Button disabled={!invoiceForm.bookingId || saveInvoiceMutation.isPending} onClick={() => saveInvoiceMutation.mutate()}>{editingInvoice ? 'Save Changes' : 'Save Draft'}</Button></div><FormSubmitStatus status={saveInvoiceMutation.isPending ? 'loading' : saveInvoiceMutation.isSuccess ? 'success' : 'idle'} successMessage={editingInvoice ? 'Draft updated' : 'Invoice draft saved'} /></div><div>{preview ? <InvoiceDocument invoice={{ ...preview, _id: editingInvoice?._id || 'preview', invoiceNumber: editingInvoice?.invoiceNumber || 'PREVIEW', status: 'draft' }} /> : <div className="h-full min-h-96 border rounded-lg grid place-items-center text-gray-500">Select booking and click Preview</div>}</div></div></DialogContent></Dialog>

      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}><DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto"><DialogHeader><DialogTitle>Invoice Document</DialogTitle></DialogHeader>{viewingInvoice && <><InvoiceDocument invoice={viewingInvoice} /><DialogFooter className="flex-wrap"><Button variant="outline" onClick={() => printInvoice(viewingInvoice)}><Printer className="h-4 w-4 mr-1" /> Print</Button><Button variant="outline" onClick={() => downloadPdf(viewingInvoice)}><Download className="h-4 w-4 mr-1" /> PDF</Button>{viewingInvoice.status === 'draft' ? (<><Button variant="outline" disabled title="Finalize this invoice before emailing it to the customer"><Mail className="h-4 w-4 mr-1" /> Email</Button><Button className="bg-green-600" disabled title="Finalize this invoice before sending it on WhatsApp"><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</Button></>) : (<><a href={`mailto:${encodeURIComponent(viewingInvoice.billingSnapshot?.billingEmail || customer.email || '')}?subject=${encodeURIComponent(`Invoice ${docNumber(viewingInvoice)}`)}&body=${encodeURIComponent(`Your ${viewingInvoice.documentType.replace(/_/g, ' ')} ${docNumber(viewingInvoice)} for ${money(viewingInvoice.totalAmount)} is ready.`)}`}><Button variant="outline"><Mail className="h-4 w-4 mr-1" /> Email</Button></a><a target="_blank" rel="noreferrer" href={`https://wa.me/${String(customer.primaryMobile || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Your invoice ${docNumber(viewingInvoice)} is ready. Total ${money(viewingInvoice.totalAmount)}, balance ${money(settledBalance(viewingInvoice))}.`)}`}><Button className="bg-green-600 hover:bg-green-700"><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</Button></a></>)}{viewingInvoice.status === 'draft' ? (canGenerateInvoice() ? <Button onClick={() => finalizeMutation.mutate(viewingInvoice._id)}>Finalize & Lock</Button> : <Button disabled title="You don't have permission to finalize invoices. Contact an admin or the account owner.">Finalize & Lock</Button>) : <><Button variant="outline" onClick={() => reviseMutation.mutate(viewingInvoice._id)}>Create Revision</Button><Button variant="outline" onClick={() => { setViewingInvoice(null); setAdjustment({ invoice: viewingInvoice, type: 'credit_note' }); setAdjustmentForm({ amount: '', reason: '' }); }}>Credit Note</Button><Button variant="outline" onClick={() => { setViewingInvoice(null); setAdjustment({ invoice: viewingInvoice, type: 'debit_note' }); setAdjustmentForm({ amount: '', reason: '' }); }}>Debit Note</Button></>}</DialogFooter></>}</DialogContent></Dialog>

      <Dialog open={!!adjustment} onOpenChange={(open) => !open && setAdjustment(null)}><DialogContent><DialogHeader><DialogTitle>Create {adjustment?.type === 'credit_note' ? 'Credit' : 'Debit'} Note</DialogTitle></DialogHeader><p className="text-sm text-gray-600">Against finalized invoice {adjustment?.invoice?.invoiceNumber}. The original document will not change.</p><div><Label>Amount</Label><Input type="number" value={adjustmentForm.amount} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, amount: event.target.value })} /></div><div><Label>Reason</Label><Textarea value={adjustmentForm.reason} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, reason: event.target.value })} /></div><FormSubmitStatus status={adjustmentMutation.isPending ? 'loading' : adjustmentMutation.isSuccess ? 'success' : 'idle'} successMessage={`${adjustment?.type === 'credit_note' ? 'Credit' : 'Debit'} note created`} /><DialogFooter><Button disabled={Number(adjustmentForm.amount) <= 0 || !adjustmentForm.reason.trim() || adjustmentMutation.isPending} onClick={() => adjustmentMutation.mutate()}>Create Draft Note</Button></DialogFooter></DialogContent></Dialog>
    </Card>
  );
}
