import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ClipboardList } from "lucide-react";

const STATUS_CLASS: Record<string, string> = {
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
};

function fmtMoney(n?: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function VendorDuties({ vendorId }: { vendorId: string }) {
  const { data: duties, isLoading } = useQuery<any[]>({ queryKey: [`/api/vendors/${vendorId}/duties`] });

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-gray-700">{(duties || []).length} duty/duties</Label>

      {isLoading ? (
        <p className="text-sm text-gray-500 py-4 text-center">Loading...</p>
      ) : !duties || duties.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <ClipboardList className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm">No duties yet — created automatically when this vendor is assigned to a booking.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Duty</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duties.map((d: any) => (
                <TableRow key={d._id}>
                  <TableCell className="font-mono text-xs">{d.dutyNumber}</TableCell>
                  <TableCell>{d.bookingId?.bookingId} — {d.bookingId?.customerName}</TableCell>
                  <TableCell>{d.vendorDriverId?.name || "-"}</TableCell>
                  <TableCell>{d.vendorVehicleId?.registrationNumber || "-"}</TableCell>
                  <TableCell className="text-xs">{new Date(d.scheduledStartDateTime).toLocaleString('en-IN')}</TableCell>
                  <TableCell>{fmtMoney(d.vendorAgreedRate)}</TableCell>
                  <TableCell><Badge className={STATUS_CLASS[d.status] || "bg-gray-100 text-gray-600"}>{d.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
