import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Heart, ShieldCheck, Star, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function display(value?: number | null, suffix = '') {
  return value == null ? 'No data' : `${value.toFixed(1)}${suffix}`;
}

export default function DriverFeedbackProfile({ driverId, onOpenBooking }: { driverId: string; onOpenBooking?: (booking: any) => void }) {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: [`/api/drivers/${driverId}/customer-feedback-profile`] });
  if (isLoading) return <p className="text-sm text-gray-500">Loading customer service analytics...</p>;
  if (isError || !data) return <p className="text-sm text-red-600">Could not load customer feedback analytics.</p>;

  return (
    <div className="space-y-4 border-t pt-5">
      <div>
        <h3 className="text-lg font-semibold">Customer Feedback & Service Analytics</h3>
        <p className="text-xs text-gray-500">Computed from linked bookings, original feedback and verified complaint responsibility.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {[
          ['Customers Served', data.totalCustomersServed], ['Total Trips', data.totalTrips],
          ['Completed Trips', data.completedTrips], ['No-shows', data.noShowCount],
          ['Average Rating', display(data.averageRating, ' / 5')], ['Appreciations', data.appreciationCount],
          ['Resolved Complaints', data.resolvedComplaints], ['Unresolved Complaints', data.unresolvedComplaints],
        ].map(([label, value]) => <div key={String(label)} className="rounded-md bg-gray-50 border p-2"><p className="text-xs text-gray-500">{label}</p><p className="font-semibold">{value}</p></div>)}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
        {[
          ['Punctuality', data.punctualityRating], ['Behaviour', data.behaviourRating],
          ['Driving Safety', data.drivingSafetyRating], ['Route Knowledge', data.routeKnowledgeRating],
          ['Payment Handling', data.paymentHandlingRating],
        ].map(([label, value]) => <div key={String(label)} className="rounded-md border p-2"><p className="text-xs text-gray-500">{label}</p><p className="font-medium flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {display(value as number | null, ' / 5')}</p></div>)}
      </div>

      <div className="grid sm:grid-cols-3 gap-2 text-sm">
        <div className="rounded-md bg-red-50 border border-red-100 p-3 flex gap-2"><AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" /><div><p className="font-semibold">{data.verifiedDriverFaultComplaints} verified driver-fault</p><p className="text-xs text-gray-600">{data.verifiedLateArrivalCount} late · {data.behaviourComplaintCount} behaviour · {data.drivingSafetyComplaintCount} safety</p></div></div>
        <div className="rounded-md bg-amber-50 border border-amber-100 p-3 flex gap-2"><ShieldCheck className="h-4 w-4 text-amber-700 mt-0.5" /><div><p className="font-semibold">{data.awaitingResponsibilityCount} awaiting classification</p><p className="text-xs text-gray-600">Not counted as driver fault.</p></div></div>
        <div className="rounded-md bg-green-50 border border-green-100 p-3 flex gap-2"><Heart className="h-4 w-4 text-green-700 mt-0.5" /><div><p className="font-semibold">{data.appreciationCount} customer appreciations</p><p className="text-xs text-gray-600">From preserved feedback records.</p></div></div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2 flex items-center gap-1"><Users className="h-4 w-4" /> Related Trips and Customers</p>
        {data.serviceHistory.length === 0 ? <p className="text-sm text-gray-500">No linked trips.</p> : <div className="overflow-x-auto border rounded-lg"><Table><TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Feedback</TableHead><TableHead>Complaints</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{data.serviceHistory.map((row: any) => <TableRow key={row.booking._id}><TableCell className="font-medium">{row.booking.bookingId}</TableCell><TableCell>{row.customer?.name || row.booking.customerName}</TableCell><TableCell>{new Date(row.booking.pickupDate).toLocaleDateString('en-IN')}</TableCell><TableCell>{[row.vehicle?.make, row.vehicle?.vehicleModel].filter(Boolean).join(' ') || '-'} {row.vehicle?.licensePlate || ''}</TableCell><TableCell>{row.feedback.length}</TableCell><TableCell>{row.complaints.length}</TableCell><TableCell>{onOpenBooking && <Button size="sm" variant="ghost" onClick={() => onOpenBooking(row.booking)}>Open Booking</Button>}</TableCell></TableRow>)}</TableBody></Table></div>}
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Customer Feedback Timeline</p>
        {data.timeline.length === 0 ? <p className="text-sm text-gray-500">No feedback or complaints yet.</p> : <div className="space-y-2 max-h-72 overflow-y-auto">{data.timeline.map((event: any) => <div key={`${event.type}-${event.recordId}`} className="border rounded-md p-3 text-sm"><div className="flex justify-between gap-2"><p className="font-medium capitalize">{event.type.replace(/_/g, ' ')} · {event.customer?.name || 'Customer'}</p><Badge variant="outline" className="capitalize">{event.responsibleParty || event.booking?.bookingId || ''}</Badge></div><p className="text-gray-700 mt-1">{event.description}</p>{event.responsibilityReason && <p className="text-xs text-gray-500 mt-1">Responsibility evidence: {event.responsibilityReason}</p>}<p className="text-xs text-gray-400 mt-1">{new Date(event.date).toLocaleString('en-IN')}</p></div>)}</div>}
      </div>
    </div>
  );
}
