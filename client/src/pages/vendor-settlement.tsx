import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ChevronDown, ChevronRight } from "lucide-react";

function fmtMoney(n?: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

interface VendorSummary {
  vendorName: string;
  vendorContactPhone?: string;
  totalAgreed: number;
  totalPaid: number;
  outstanding: number;
  bookingCount: number;
  bookings: Array<{
    bookingId: string; pickupDate: string; pickupLocation: string; dropoffLocation?: string;
    status: string; vendorAgreedRate: number; vendorAdvancePaid: number; outstanding: number;
  }>;
}

// Read-only reporting on the existing plain vendor fields on Booking
// (fulfilmentType/vendorName/vendorAgreedRate/vendorAdvancePaid) — no
// separate Vendor model exists, and this view doesn't add one. Outstanding
// = sum(vendorAgreedRate) - sum(vendorAdvancePaid) across every booking
// outsourced to that vendor name. No payment-recording here (that would
// need a real ledger); this is visibility only.
export default function VendorSettlementPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery<{ vendors: VendorSummary[]; totalOutstanding: number }>({
    queryKey: ["/api/vendors/settlement"],
  });

  const vendors = data?.vendors || [];

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="gradient-header bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">🏢 Vendor Settlement</h1>
        <p className="text-blue-100 mt-1">Outstanding payments owed to vendors • Outsourced bookings tracked</p>
      </div>

      {/* Summary Card */}
      {!isLoading && !isError && data && (
        <Card className="stat-card card-hover bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardContent className="py-4 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Total Outstanding to {vendors.length} Vendor{vendors.length === 1 ? "" : "s"}</span>
            <span className="text-3xl font-bold text-red-600">{fmtMoney(data?.totalOutstanding)}</span>
          </CardContent>
        </Card>
      )}

      {isError ? (
        <p className="text-sm text-red-600">Could not load vendor settlement data.</p>
      ) : isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : vendors.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-gray-500">No bookings have been outsourced to a vendor yet.</CardContent></Card>
      ) : (
        <>
          <Card className="bg-gray-50">
            <CardContent className="py-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">Total outstanding across {vendors.length} vendor{vendors.length === 1 ? "" : "s"}</span>
              <span className="text-xl font-bold text-red-700">{fmtMoney(data?.totalOutstanding)}</span>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {vendors.map((v) => (
              <Card key={v.vendorName}>
                <CardHeader className="pb-3 cursor-pointer" onClick={() => toggle(v.vendorName)}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {expanded.has(v.vendorName) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      <div>
                        <CardTitle className="text-base">{v.vendorName}</CardTitle>
                        {v.vendorContactPhone && <p className="text-xs text-gray-500">{v.vendorContactPhone}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">{v.bookingCount} booking{v.bookingCount === 1 ? "" : "s"}</span>
                      <span className="text-gray-500">Agreed {fmtMoney(v.totalAgreed)}</span>
                      <span className="text-gray-500">Paid {fmtMoney(v.totalPaid)}</span>
                      <Badge variant={v.outstanding > 0 ? "destructive" : "default"} className="text-sm">{fmtMoney(v.outstanding)} due</Badge>
                    </div>
                  </div>
                </CardHeader>
                {expanded.has(v.vendorName) && (
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Booking</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Route</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Agreed</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right">Outstanding</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {v.bookings.map((b) => (
                            <TableRow key={b.bookingId}>
                              <TableCell className="font-medium">{b.bookingId}</TableCell>
                              <TableCell>{b.pickupDate ? new Date(b.pickupDate).toLocaleDateString('en-IN') : '-'}</TableCell>
                              <TableCell>{b.pickupLocation} → {b.dropoffLocation || '-'}</TableCell>
                              <TableCell><Badge variant="outline" className="capitalize">{b.status.replace(/_/g, ' ')}</Badge></TableCell>
                              <TableCell className="text-right">{fmtMoney(b.vendorAgreedRate)}</TableCell>
                              <TableCell className="text-right">{fmtMoney(b.vendorAdvancePaid)}</TableCell>
                              <TableCell className="text-right font-medium">{fmtMoney(b.outstanding)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
