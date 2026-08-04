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
import { Textarea } from "@/components/ui/textarea";
import { Building2, Plus, Search, ShieldOff, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import VendorDrivers from "@/components/vendors/vendor-drivers";
import VendorVehicles from "@/components/vendors/vendor-vehicles";

const VENDOR_TYPES = [
  'taxi_vendor', 'fleet_owner', 'travel_agent', 'booking_agent', 'tour_operator',
  'vehicle_owner', 'driver_cum_owner', 'corporate_transport_vendor', 'hotel_partner',
  'religious_tour_partner', 'self_drive_vendor', 'attached_vehicle_partner',
  'online_booking_partner', 'other',
];
const VENDOR_ROLES = ['booking_source', 'vehicle_provider', 'driver_provider', 'complete_duty_provider', 'commission_partner'];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  verification_pending: { label: "Verification Pending", className: "bg-amber-100 text-amber-800" },
  active: { label: "Active", className: "bg-green-100 text-green-800" },
  temporarily_blocked: { label: "Blocked", className: "bg-red-100 text-red-800" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800" },
  inactive: { label: "Inactive", className: "bg-gray-100 text-gray-600" },
  blacklisted: { label: "Blacklisted", className: "bg-red-200 text-red-900" },
  agreement_expired: { label: "Agreement Expired", className: "bg-amber-100 text-amber-800" },
};

function emptyForm() {
  return {
    companyName: "", contactPerson: "", primaryMobile: "", alternateMobile: "", email: "",
    vendorTypes: [] as string[], roles: [] as string[],
  };
}

export default function VendorsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [viewingId, setViewingId] = useState<string | null>(null);

  const { data: vendors, isLoading } = useQuery<any[]>({
    queryKey: ["/api/vendors", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/vendors?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.companyName.trim()) throw new Error("Company name is required");
      if (!form.contactPerson.trim()) throw new Error("Contact person is required");
      if (!form.primaryMobile.trim()) throw new Error("Primary mobile is required");
      return (await apiRequest("POST", "/api/vendors", form)).json();
    },
    onSuccess: (vendor: any) => {
      toast({ title: `Vendor created: ${vendor.vendorCode}` });
      setShowCreate(false);
      setForm(emptyForm());
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
    },
    onError: (err: any) => toast({ title: "Could not create vendor", description: err.message, variant: "destructive" }),
  });

  const toggleType = (t: string) => setForm((f) => ({
    ...f, vendorTypes: f.vendorTypes.includes(t) ? f.vendorTypes.filter((x) => x !== t) : [...f.vendorTypes, t],
  }));
  const toggleRole = (r: string) => setForm((f) => ({
    ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Database</h1>
          <p className="text-sm text-gray-500">Taxi vendors, fleet owners, travel agents — booking source and/or fulfilment partners.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" />New Vendor</Button>
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search company, contact, code, or mobile" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{(vendors || []).length} vendor{(vendors || []).length === 1 ? "" : "s"}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-500 py-8 text-center">Loading...</p>
          ) : !vendors || vendors.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p>No vendors yet</p>
              <p className="text-sm">Add a vendor to use them as a booking source or fulfilment partner.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Types</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((v: any) => {
                    const badge = STATUS_BADGE[v.status] || STATUS_BADGE.draft;
                    return (
                      <TableRow key={v._id} className="cursor-pointer hover:bg-gray-50" onClick={() => setViewingId(v._id)}>
                        <TableCell className="font-mono text-sm">{v.vendorCode}</TableCell>
                        <TableCell className="font-medium">{v.companyName}</TableCell>
                        <TableCell>{v.contactPerson}</TableCell>
                        <TableCell>{v.primaryMobile?.replace(/^91/, '')}</TableCell>
                        <TableCell className="capitalize text-xs text-gray-500">{(v.vendorTypes || []).map((t: string) => t.replace(/_/g, ' ')).join(', ') || '-'}</TableCell>
                        <TableCell><Badge className={badge.className}>{badge.label}</Badge></TableCell>
                        <TableCell />
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Vendor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Company Name</Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="e.g. Shree Travels" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact Person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div>
                <Label>Primary Mobile</Label>
                <Input value={form.primaryMobile} onChange={(e) => setForm({ ...form, primaryMobile: e.target.value })} />
              </div>
              <div>
                <Label>Alternate Mobile</Label>
                <Input value={form.alternateMobile} onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Vendor Type</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {VENDOR_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => toggleType(t)}
                    className={`px-2 py-1 rounded-full text-xs border capitalize ${form.vendorTypes.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                    {t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Vendor Role</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {VENDOR_ROLES.map((r) => (
                  <button key={r} type="button" onClick={() => toggleRole(r)}
                    className={`px-2 py-1 rounded-full text-xs border capitalize ${form.roles.includes(r) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                    {r.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>Create Vendor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewingId && <VendorDetail vendorId={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  );
}

const VENDOR_TABS = ['overview', 'drivers', 'vehicles'] as const;

function VendorDetail({ vendorId, onClose }: { vendorId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [tab, setTab] = useState<typeof VENDOR_TABS[number]>('overview');

  const { data: vendor } = useQuery<any>({ queryKey: [`/api/vendors/${vendorId}`] });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/vendors/${vendorId}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
  };

  const blockMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/vendors/${vendorId}/block`, { reason })).json(),
    onSuccess: () => { toast({ title: "Vendor blocked" }); setReason(""); invalidate(); },
    onError: (err: any) => toast({ title: "Could not block vendor", description: err.message, variant: "destructive" }),
  });
  const activateMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/vendors/${vendorId}/activate`, {})).json(),
    onSuccess: () => { toast({ title: "Vendor activated" }); invalidate(); },
    onError: (err: any) => toast({ title: "Could not activate vendor", description: err.message, variant: "destructive" }),
  });

  if (!vendor) return null;
  const badge = STATUS_BADGE[vendor.status] || STATUS_BADGE.draft;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {vendor.companyName} <span className="text-xs font-mono text-gray-400">{vendor.vendorCode}</span>
            <Badge className={badge.className}>{badge.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b">
          {VENDOR_TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm capitalize border-b-2 -mb-px ${tab === t ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Contact:</span> {vendor.contactPerson}</p>
              <p><span className="text-gray-500">Mobile:</span> {vendor.primaryMobile}</p>
              {vendor.email && <p><span className="text-gray-500">Email:</span> {vendor.email}</p>}
              <p className="capitalize"><span className="text-gray-500">Types:</span> {(vendor.vendorTypes || []).map((t: string) => t.replace(/_/g, ' ')).join(', ') || '-'}</p>
              <p className="capitalize"><span className="text-gray-500">Roles:</span> {(vendor.roles || []).map((r: string) => r.replace(/_/g, ' ')).join(', ') || '-'}</p>
            </div>

            {vendor.status !== 'temporarily_blocked' && vendor.status !== 'blacklisted' ? (
              <div className="border-t pt-3 space-y-2">
                <Label>Block Vendor</Label>
                <Textarea placeholder="Reason for blocking" value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button variant="destructive" size="sm" disabled={blockMutation.isPending} onClick={() => blockMutation.mutate()}>
                  <ShieldOff className="w-3.5 h-3.5 mr-1.5" />Block
                </Button>
              </div>
            ) : (
              <div className="border-t pt-3">
                <Button variant="outline" size="sm" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate()}>
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />Reactivate
                </Button>
              </div>
            )}
          </>
        )}

        {tab === 'drivers' && <VendorDrivers vendorId={vendorId} />}
        {tab === 'vehicles' && <VendorVehicles vendorId={vendorId} />}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
