import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { X, Plus, Pencil, IndianRupee, Phone, MessageCircle, Car, UserRound, Eye, ReceiptText, CalendarClock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CustomerService from "./customer-service";
import CustomerTimeline from "./customer-timeline";
import CustomerConsent from "./customer-consent";
import CustomerRewardsPanel from "./customer-rewards-panel";
import CustomerMessageCenter from "./customer-message-center";
import CustomerRequirements from "./customer-requirements";

const CUSTOMER_TYPES = ['individual', 'corporate', 'vip', 'self_drive', 'religious_traveller', 'airport', 'outstation'];

function editFormFromCustomer(c: any) {
  return {
    name: c.name || "",
    primaryMobile: c.primaryMobile || "",
    alternateMobile: c.alternateMobile || "",
    whatsappNumber: c.whatsappNumber || "",
    email: c.email || "",
    dateOfBirth: c.dateOfBirth ? String(c.dateOfBirth).slice(0, 10) : "",
    anniversary: c.anniversary ? String(c.anniversary).slice(0, 10) : "",
    emergencyContact: c.emergencyContact || "",
    preferredLanguage: c.preferredLanguage || "",
    photoUrl: c.photoUrl || "",
    companyName: c.companyName || "",
    customerType: c.customerType || "individual",
    gstNumber: c.gstNumber || "",
    address: c.address || "",
    city: c.city || "",
    state: c.state || "",
    pinCode: c.pinCode || "",
    billing: {
      billingName: c.billing?.billingName || "", panNumber: c.billing?.panNumber || "",
      billingAddress: c.billing?.billingAddress || "", billingEmail: c.billing?.billingEmail || "",
      accountsContact: c.billing?.accountsContact || "", purchaseOrderRequired: !!c.billing?.purchaseOrderRequired,
      creditPeriodDays: c.billing?.creditPeriodDays ?? "", creditLimit: c.billing?.creditLimit ?? "",
      invoiceRequired: !!c.billing?.invoiceRequired, gstInvoiceRequired: !!c.billing?.gstInvoiceRequired,
      tdsInformation: c.billing?.tdsInformation || "", preferredInvoiceFormat: c.billing?.preferredInvoiceFormat || "",
      bankPaymentInstructions: c.billing?.bankPaymentInstructions || "", internalBillingNotes: c.billing?.internalBillingNotes || "",
    },
  };
}

const PAYMENT_TYPES = [
  { value: 'advance', label: 'Advance' },
  { value: 'partial_payment', label: 'Partial Payment' },
  { value: 'final_payment', label: 'Final Payment' },
];
const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'payment_gateway', label: 'Payment Gateway' },
];

function fmtMoney(n?: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-100 text-blue-800" },
  repeat: { label: "Repeat", className: "bg-green-100 text-green-800" },
  frequent: { label: "Frequent", className: "bg-purple-100 text-purple-800" },
  high_value: { label: "High Value", className: "bg-amber-100 text-amber-800" },
  inactive: { label: "Inactive", className: "bg-gray-100 text-gray-600" },
  at_risk: { label: "At Risk", className: "bg-red-100 text-red-800" },
};

interface Props {
  customerId: string;
  onEditBooking?: (booking: any) => void;
}

export default function CustomerDashboard({ customerId, onEditBooking }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTag, setNewTag] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(editFormFromCustomer({}));
  const [payingBooking, setPayingBooking] = useState<any>(null);
  const [viewingBooking, setViewingBooking] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentType: "advance", paymentMode: "cash", transactionReference: "", receivedBy: "", notes: "" });

  const { data: customer, isLoading: loadingCustomer } = useQuery<any>({
    queryKey: [`/api/customers/${customerId}`],
  });

  const invalidateCustomer = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/customers/tags"] });
    queryClient.invalidateQueries({ queryKey: ["/api/customers/segments"] });
  };

  const addTagMutation = useMutation({
    mutationFn: async (tag: string) => (await apiRequest("POST", `/api/customers/${customerId}/tags`, { tag })).json(),
    onSuccess: () => { setNewTag(""); invalidateCustomer(); },
  });
  const removeTagMutation = useMutation({
    mutationFn: async (tag: string) => (await apiRequest("DELETE", `/api/customers/${customerId}/tags/${encodeURIComponent(tag)}`)).json(),
    onSuccess: invalidateCustomer,
  });
  const { data: bookings, isLoading: loadingBookings } = useQuery<any[]>({
    queryKey: [`/api/customers/${customerId}/bookings`],
  });
  const { data: rewards } = useQuery<any>({
    queryKey: [`/api/customers/${customerId}/rewards`],
  });
  const { data: payments = [] } = useQuery<any[]>({
    queryKey: [`/api/customers/${customerId}/payments`],
  });

  // Profile fields (name, contact, address, company, GST) are directly
  // editable here — they're plain data, not derived from bookings.
  // Financial figures (advance/due) are NOT edited this way; see
  // recordPaymentMutation below, which always creates a real ledger
  // transaction instead of overwriting a cached balance.
  const editCustomerMutation = useMutation({
    mutationFn: async () => (await apiRequest("PUT", `/api/customers/${customerId}`, editForm)).json(),
    onSuccess: () => { toast({ title: "Customer updated" }); setShowEdit(false); invalidateCustomer(); },
    onError: (err: any) => toast({ title: "Could not update customer", description: err.message, variant: "destructive" }),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(paymentForm.amount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      return (await apiRequest("POST", `/api/bookings/${payingBooking._id}/payments`, {
        ...paymentForm, amount,
      })).json();
    },
    onSuccess: () => {
      toast({ title: "Payment recorded" });
      setPayingBooking(null);
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/bookings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/payments`] });
      invalidateCustomer();
    },
    onError: (err: any) => toast({ title: "Could not record payment", description: err.message, variant: "destructive" }),
  });

  if (loadingCustomer || !customer) {
    return <p className="text-sm text-gray-500 py-8 text-center">Loading...</p>;
  }

  const badge = STATUS_BADGE[customer.customerStatus] || STATUS_BADGE.new;
  const rows = bookings || [];
  const upcoming = rows.filter((b: any) => ['confirmed', 'vehicle_assigned', 'driver_assigned', 'ready_for_dispatch'].includes(b.status)).length;
  const live = rows.filter((b: any) => ['trip_started', 'ongoing', 'extended', 'return_pending'].includes(b.status)).length;
  const activeStatuses = ['confirmed', 'vehicle_assigned', 'driver_assigned', 'ready_for_dispatch', 'trip_started', 'ongoing', 'extended', 'return_pending'];
  const currentBooking = rows.find((b: any) => activeStatuses.includes(b.status)) || rows[0];
  const totalDue = rows
    .filter((b: any) => !['cancelled', 'no_show'].includes(b.status))
    .reduce((sum: number, b: any) => sum + Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0)), 0);

  return (
    <div className="space-y-6">
      {/* Customer summary — tap the pencil to edit profile fields. */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">{customer.name}</h2>
            <button
              onClick={() => { setEditForm(editFormFromCustomer(customer)); setShowEdit(true); }}
              className="text-gray-400 hover:text-blue-600"
              title="Edit customer details"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-gray-500">{customer.primaryMobile?.replace(/^91/, '')} {customer.email ? `· ${customer.email}` : ""}</p>
          <p className="text-xs text-gray-400 mt-0.5">Customer ID: {customer.customerCode || customer._id}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <a href={`tel:${customer.primaryMobile || ''}`}><Button size="sm" variant="outline"><Phone className="h-4 w-4 mr-1" /> Call</Button></a>
          <a href="#customer-whatsapp"><Button size="sm" className="bg-green-600 hover:bg-green-700"><MessageCircle className="h-4 w-4 mr-1" /> Message</Button></a>
          <Badge variant="outline" className="border-purple-300 text-purple-700">{customer.loyaltyTier || "Regular"} Tier</Badge>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Primary Mobile</Label>
              <Input value={editForm.primaryMobile} onChange={(e) => setEditForm({ ...editForm, primaryMobile: e.target.value })} />
            </div>
            <div>
              <Label>Alternate Mobile</Label>
              <Input value={editForm.alternateMobile} onChange={(e) => setEditForm({ ...editForm, alternateMobile: e.target.value })} />
            </div>
            <div>
              <Label>WhatsApp Number</Label>
              <Input value={editForm.whatsappNumber} onChange={(e) => setEditForm({ ...editForm, whatsappNumber: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div><Label>Date of Birth</Label><Input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} /></div>
            <div><Label>Anniversary</Label><Input type="date" value={editForm.anniversary} onChange={(e) => setEditForm({ ...editForm, anniversary: e.target.value })} /></div>
            <div><Label>Emergency Contact</Label><Input value={editForm.emergencyContact} onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })} /></div>
            <div><Label>Preferred Language</Label><Input value={editForm.preferredLanguage} onChange={(e) => setEditForm({ ...editForm, preferredLanguage: e.target.value })} /></div>
            <div className="col-span-2"><Label>Customer Photo URL</Label><Input value={editForm.photoUrl} onChange={(e) => setEditForm({ ...editForm, photoUrl: e.target.value })} /></div>
            <div>
              <Label>Customer Type</Label>
              <Select value={editForm.customerType} onValueChange={(v) => setEditForm({ ...editForm, customerType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CUSTOMER_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Company Name</Label>
              <Input value={editForm.companyName} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>GST Number</Label>
              <Input value={editForm.gstNumber} onChange={(e) => setEditForm({ ...editForm, gstNumber: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
            </div>
            <div>
              <Label>PIN Code</Label>
              <Input value={editForm.pinCode} onChange={(e) => setEditForm({ ...editForm, pinCode: e.target.value })} />
            </div>
            <details className="col-span-2 rounded-lg border p-3">
              <summary className="font-medium cursor-pointer">Business & Billing Information</summary>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {[
                  ['billingName', 'Billing Name'], ['panNumber', 'PAN'], ['billingEmail', 'Billing Email'],
                  ['accountsContact', 'Accounts Contact'], ['creditPeriodDays', 'Credit Period (days)'],
                  ['creditLimit', 'Credit Limit'], ['preferredInvoiceFormat', 'Preferred Invoice Format'],
                  ['tdsInformation', 'TDS Information'], ['bankPaymentInstructions', 'Bank / Payment Instructions'],
                  ['internalBillingNotes', 'Internal Billing Notes'],
                ].map(([key, label]) => (
                  <div key={key} className={['bankPaymentInstructions', 'internalBillingNotes'].includes(key) ? 'col-span-2' : ''}>
                    <Label>{label}</Label>
                    <Input
                      type={['creditPeriodDays', 'creditLimit'].includes(key) ? 'number' : 'text'}
                      value={(editForm.billing as any)[key]}
                      onChange={(e) => setEditForm({ ...editForm, billing: { ...editForm.billing, [key]: e.target.value } })}
                    />
                  </div>
                ))}
                <div className="col-span-2"><Label>Billing Address</Label><Input value={editForm.billing.billingAddress} onChange={(e) => setEditForm({ ...editForm, billing: { ...editForm.billing, billingAddress: e.target.value } })} /></div>
                <div className="col-span-2 flex flex-wrap gap-4 rounded-lg bg-gray-50 p-3">
                  {[
                    ['purchaseOrderRequired', 'Purchase order required'], ['invoiceRequired', 'Invoice required'],
                    ['gstInvoiceRequired', 'GST invoice required'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!(editForm.billing as any)[key]} onChange={(e) => setEditForm({ ...editForm, billing: { ...editForm.billing, [key]: e.target.checked } })} /> {label}
                    </label>
                  ))}
                </div>
              </div>
            </details>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button disabled={editCustomerMutation.isPending || !editForm.name.trim()} onClick={() => editCustomerMutation.mutate()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tags — tenant-configurable, multiple per customer; add/remove is
          logged to CustomerTagEvent server-side for the audit history. */}
      <div className="flex flex-wrap items-center gap-2">
        {(customer.tags || []).map((tag: string) => (
          <Badge key={tag} variant="outline" className="border-purple-200 text-purple-700 gap-1 pr-1">
            #{tag}
            <button onClick={() => removeTagMutation.mutate(tag)} className="hover:text-red-600">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            placeholder="Add tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newTag.trim()) addTagMutation.mutate(newTag.trim()); }}
            className="h-7 text-xs w-28"
          />
          <Button size="sm" variant="ghost" className="h-7 px-2" disabled={!newTag.trim()} onClick={() => addTagMutation.mutate(newTag.trim())}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Consent / contact preferences — gates future campaign sends;
          transactional booking messages are unaffected. */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Contact Preferences</Label>
        <CustomerConsent customerId={customerId} customer={customer} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <Label className="text-xs text-gray-500">Total Bookings</Label>
          <p className="text-lg font-semibold">{customer.totalBookings || 0}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <Label className="text-xs text-gray-500">Completed</Label>
          <p className="text-lg font-semibold text-green-600">{customer.completedBookings || 0}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <Label className="text-xs text-gray-500">Cancelled</Label>
          <p className="text-lg font-semibold text-red-600">{customer.cancelledBookings || 0}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <Label className="text-xs text-gray-500">Upcoming / Live</Label>
          <p className="text-lg font-semibold">{upcoming} / {live}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <Label className="text-xs text-gray-500">Lifetime Spend</Label>
          <p className="text-lg font-semibold">{fmtMoney(customer.totalSpending)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <Label className="text-xs text-gray-500">Pending Due</Label>
          <p className="text-lg font-semibold text-red-600">{fmtMoney(totalDue)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <Label className="text-xs text-gray-500">Last Booking</Label>
          <p className="text-sm font-medium">{customer.lastBookingDate ? new Date(customer.lastBookingDate).toLocaleDateString('en-IN') : "-"}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <Label className="text-xs text-gray-500">Preferred Route</Label>
          <p className="text-sm font-medium truncate">{customer.preferredRoute || "-"}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <Label className="text-xs text-gray-500">Reward Points</Label>
          <p className="text-lg font-semibold text-green-700">{customer.rewardPointsBalance || 0}</p>
        </div>
      </div>

      <CustomerRequirements customerId={customerId} bookings={rows} />

      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-5 w-5 text-blue-600" /> Current / Latest Service</CardTitle>
            {currentBooking && <Badge variant="outline" className="capitalize">{currentBooking.status?.replace(/_/g, ' ')}</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {!currentBooking ? <p className="text-sm text-gray-500">No booking available.</p> : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg bg-white border p-3">
                  <p className="text-xs text-gray-500">Booking & Route</p>
                  <p className="font-semibold">{currentBooking.bookingId}</p>
                  <p className="text-sm mt-1">{currentBooking.pickupLocation} → {currentBooking.dropoffLocation || '-'}</p>
                </div>
                <div className="rounded-lg bg-white border p-3">
                  <p className="text-xs text-gray-500">Schedule</p>
                  <p className="font-semibold">{new Date(currentBooking.pickupDate).toLocaleDateString('en-IN')}</p>
                  <p className="text-sm mt-1">{currentBooking.pickupTime || '-'} → {currentBooking.returnTime || '-'}</p>
                </div>
                <div className="rounded-lg bg-white border p-3">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> Driver</p>
                  <p className="font-semibold">{currentBooking.driverId?.name || 'Not assigned'}</p>
                  <p className="text-sm mt-1">{currentBooking.driverId?.phone?.replace(/^91/, '') || '-'}</p>
                </div>
                <div className="rounded-lg bg-white border p-3">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Car className="h-3.5 w-3.5" /> Vehicle</p>
                  <p className="font-semibold">{[currentBooking.vehicleId?.make, currentBooking.vehicleId?.vehicleModel].filter(Boolean).join(' ') || 'Not assigned'}</p>
                  <p className="text-sm mt-1">{currentBooking.vehicleId?.licensePlate || '-'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg bg-white border p-3">
                <div className="flex gap-5 text-sm">
                  <span>Total <strong>{fmtMoney(currentBooking.totalAmount)}</strong></span>
                  <span className="text-green-700">Paid <strong>{fmtMoney(currentBooking.advanceReceived)}</strong></span>
                  <span className="text-red-700">Due <strong>{fmtMoney(Math.max(0, currentBooking.totalAmount - (currentBooking.advanceReceived || 0)))}</strong></span>
                </div>
                <div className="flex gap-2">
                  {Math.max(0, currentBooking.totalAmount - (currentBooking.advanceReceived || 0)) > 0 && (
                    <Button size="sm" onClick={() => {
                      const due = Math.max(0, currentBooking.totalAmount - (currentBooking.advanceReceived || 0));
                      setPayingBooking(currentBooking);
                      setPaymentForm({ amount: String(due), paymentType: currentBooking.advanceReceived ? 'final_payment' : 'advance', paymentMode: 'cash', transactionReference: '', receivedBy: '', notes: '' });
                    }}><IndianRupee className="h-4 w-4 mr-1" /> Record Payment</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setViewingBooking(currentBooking)}><Eye className="h-4 w-4 mr-1" /> Full Details</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking history — Due is never a raw editable number (that would
          let it silently disagree with the real payment ledger); tapping
          it opens Record Payment, which always writes a new
          PaymentTransaction (server/services/paymentLedger.ts) and the
          Advance/Due shown here are then just the recomputed result. */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Booking History</Label>
        {loadingBookings ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Advance</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b: any) => {
                  const due = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0));
                  return (
                    <TableRow key={b._id}>
                      <TableCell className="font-medium">{b.bookingId}</TableCell>
                      <TableCell>{b.pickupLocation} → {b.dropoffLocation || "-"}</TableCell>
                      <TableCell>{new Date(b.pickupDate).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>
                        <p className="text-sm">{b.driverId?.name || 'Driver pending'}</p>
                        <p className="text-xs text-gray-500">{b.vehicleId?.licensePlate || [b.vehicleId?.make, b.vehicleId?.vehicleModel].filter(Boolean).join(' ') || 'Vehicle pending'}</p>
                      </TableCell>
                      <TableCell>{fmtMoney(b.totalAmount)}</TableCell>
                      <TableCell className="text-green-600">{fmtMoney(b.advanceReceived)}</TableCell>
                      <TableCell>
                        {due > 0 ? (
                          <button
                            onClick={() => { setPayingBooking(b); setPaymentForm({ amount: String(due), paymentType: b.advanceReceived ? 'final_payment' : 'advance', paymentMode: 'cash', transactionReference: '', receivedBy: '', notes: '' }); }}
                            className="flex items-center gap-1 text-red-600 hover:underline font-medium"
                            title="Tap to record a payment"
                          >
                            <IndianRupee className="w-3 h-3" />{fmtMoney(due).replace('₹', '')}
                          </button>
                        ) : (
                          <span className="text-gray-400">₹0</span>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{b.status?.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => setViewingBooking(b)}><Eye className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={!!viewingBooking} onOpenChange={(open) => !open && setViewingBooking(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Complete Booking Details — {viewingBooking?.bookingId}</DialogTitle></DialogHeader>
          {viewingBooking && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><Label className="text-xs text-gray-500">Status</Label><p className="capitalize font-medium">{viewingBooking.status?.replace(/_/g, ' ')}</p></div>
                <div><Label className="text-xs text-gray-500">Booking Type</Label><p className="capitalize font-medium">{viewingBooking.bookingType?.replace(/_/g, ' ')}</p></div>
                <div><Label className="text-xs text-gray-500">Source</Label><p className="capitalize font-medium">{viewingBooking.bookingSource?.replace(/_/g, ' ') || 'Direct customer'}</p></div>
                <div><Label className="text-xs text-gray-500">Fulfilment</Label><p className="capitalize font-medium">{viewingBooking.fulfilmentType || 'Own fleet'}</p></div>
                <div className="col-span-2"><Label className="text-xs text-gray-500">Route</Label><p className="font-medium">{viewingBooking.pickupLocation} → {viewingBooking.dropoffLocation || '-'}</p></div>
                <div><Label className="text-xs text-gray-500">Pickup</Label><p className="font-medium">{new Date(viewingBooking.pickupDate).toLocaleDateString('en-IN')} {viewingBooking.pickupTime || ''}</p></div>
                <div><Label className="text-xs text-gray-500">Return</Label><p className="font-medium">{viewingBooking.returnDate ? new Date(viewingBooking.returnDate).toLocaleDateString('en-IN') : '-'} {viewingBooking.returnTime || ''}</p></div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-lg border p-4">
                  <p className="font-semibold flex items-center gap-2 mb-2"><UserRound className="h-4 w-4" /> Driver Service</p>
                  <p>{viewingBooking.driverId?.name || viewingBooking.thirdPartyDriverName || viewingBooking.vendorDriverName || 'Not assigned'}</p>
                  <p className="text-sm text-gray-500">{viewingBooking.driverId?.phone || viewingBooking.thirdPartyDriverPhone || viewingBooking.vendorDriverPhone || '-'}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-semibold flex items-center gap-2 mb-2"><Car className="h-4 w-4" /> Vehicle Service</p>
                  <p>{[viewingBooking.vehicleId?.make, viewingBooking.vehicleId?.vehicleModel].filter(Boolean).join(' ') || viewingBooking.vendorVehicleDetails || 'Not assigned'}</p>
                  <p className="text-sm text-gray-500">{viewingBooking.vehicleId?.licensePlate || '-'}</p>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="font-semibold flex items-center gap-2 mb-3"><ReceiptText className="h-4 w-4" /> Financial Summary</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><Label className="text-xs text-gray-500">Total</Label><p className="font-semibold">{fmtMoney(viewingBooking.totalAmount)}</p></div>
                  <div><Label className="text-xs text-gray-500">Paid</Label><p className="font-semibold text-green-700">{fmtMoney(viewingBooking.advanceReceived)}</p></div>
                  <div><Label className="text-xs text-gray-500">Due</Label><p className="font-semibold text-red-700">{fmtMoney(Math.max(0, viewingBooking.totalAmount - (viewingBooking.advanceReceived || 0)))}</p></div>
                </div>
              </div>

              {(viewingBooking.notes || viewingBooking.customerDiscussionSummary) && (
                <div className="rounded-lg border p-4 text-sm">
                  <p className="font-semibold mb-2">Notes & Customer Discussion</p>
                  <p className="whitespace-pre-wrap text-gray-700">{viewingBooking.customerDiscussionSummary || viewingBooking.notes}</p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewingBooking(null)}>Close</Button>
                {onEditBooking && <Button onClick={() => { const booking = viewingBooking; setViewingBooking(null); onEditBooking(booking); }}><Pencil className="h-4 w-4 mr-1" /> Edit Booking</Button>}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!payingBooking} onOpenChange={(open) => !open && setPayingBooking(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment — {payingBooking?.bookingId}</DialogTitle></DialogHeader>
          {payingBooking && (
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 border p-3 text-sm">
              <div><p className="text-xs text-gray-500">Total</p><p className="font-semibold">{fmtMoney(payingBooking.totalAmount)}</p></div>
              <div><p className="text-xs text-gray-500">Already Paid</p><p className="font-semibold text-green-700">{fmtMoney(payingBooking.advanceReceived)}</p></div>
              <div><p className="text-xs text-gray-500">Outstanding</p><p className="font-semibold text-red-700">{fmtMoney(Math.max(0, payingBooking.totalAmount - (payingBooking.advanceReceived || 0)))}</p></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount</Label>
              <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
            </div>
            <div>
              <Label>Payment Type</Label>
              <Select value={paymentForm.paymentType} onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select value={paymentForm.paymentMode} onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Transaction Reference</Label>
              <Input value={paymentForm.transactionReference} onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Received By</Label>
              <Input value={paymentForm.receivedBy} onChange={(e) => setPaymentForm({ ...paymentForm, receivedBy: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Input placeholder="Optional payment note" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingBooking(null)}>Cancel</Button>
            <Button disabled={recordPaymentMutation.isPending || Number(paymentForm.amount) <= 0} onClick={() => recordPaymentMutation.mutate()}>{recordPaymentMutation.isPending ? 'Saving...' : 'Record Payment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ReceiptText className="h-5 w-5 text-green-600" /> Complete Payment Ledger</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? <p className="text-sm text-gray-500">No payment transactions yet.</p> : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Booking</TableHead><TableHead>Type</TableHead><TableHead>Mode</TableHead><TableHead>Reference</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments.map((payment: any) => (
                    <TableRow key={payment._id}>
                      <TableCell>{new Date(payment.receivedAt || payment.createdAt).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell className="font-medium">{payment.bookingId?.bookingId || '-'}</TableCell>
                      <TableCell className="capitalize">{payment.paymentType?.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="capitalize">{payment.paymentMode?.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{payment.transactionReference || '-'}</TableCell>
                      <TableCell className={payment.amount < 0 || payment.paymentType === 'refund' ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'}>{fmtMoney(payment.amount)}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{payment.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerRewardsPanel customerId={customerId} rewards={rewards} />

      <div id="customer-whatsapp" className="scroll-mt-4">
        <CustomerMessageCenter customerId={customerId} bookings={rows} />
      </div>

      <CustomerService customerId={customerId} bookings={rows} />

      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Timeline</Label>
        <CustomerTimeline customerId={customerId} />
      </div>
    </div>
  );
}
