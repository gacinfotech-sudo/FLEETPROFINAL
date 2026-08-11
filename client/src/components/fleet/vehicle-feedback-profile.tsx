import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Car, Gauge, ShieldCheck, Snowflake, Sparkles, Star, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function display(value?: number | null, suffix = '') {
  return value == null ? 'No data' : `${value.toFixed(1)}${suffix}`;
}

function odometer(value?: number | null) {
  return value == null ? '-' : Number(value).toLocaleString('en-IN');
}

export default function VehicleFeedbackProfile({ vehicleId, onOpenBooking }: { vehicleId: string; onOpenBooking?: (booking: any) => void }) {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: [`/api/vehicles/${vehicleId}/customer-feedback-profile`] });
  if (isLoading) return <p className="text-sm text-gray-500">Loading customer and trip analytics...</p>;
  if (isError || !data) return <p className="text-sm text-red-600">Could not load vehicle feedback analytics.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Customer Feedback & Fleet Performance</h3>
        <p className="text-xs text-gray-500">Computed from linked Fleet bookings, odometers, preserved feedback, and verified complaint responsibility.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {[
          ['Customers Served', data.totalCustomersServed], ['Total Trips', data.totalTrips],
          ['Completed Trips', data.completedTrips], ['Total Kilometres', `${data.totalKilometers.toLocaleString('en-IN')} km`],
          ['Average Rating', display(data.averageVehicleRating, ' / 5')], ['Feedback Records', data.feedbackCount],
          ['Resolved Complaints', data.resolvedComplaints], ['Unresolved Complaints', data.unresolvedComplaints],
        ].map(([label, value]) => <div key={String(label)} className="rounded-md bg-gray-50 border p-2"><p className="text-xs text-gray-500">{label}</p><p className="font-semibold">{value}</p></div>)}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {[
          ['Cleanliness', data.cleanlinessRating, Sparkles], ['Comfort', data.comfortRating, Star],
          ['AC Performance', data.acRating, Snowflake], ['Vehicle Condition', data.conditionRating, Car],
        ].map(([label, value, Icon]: any) => <div key={label} className="rounded-md border p-2"><p className="text-xs text-gray-500 flex items-center gap-1"><Icon className="h-3.5 w-3.5" /> {label}</p><p className="font-medium">{display(value, ' / 5')}</p></div>)}
      </div>

      <div className="grid sm:grid-cols-3 gap-2 text-sm">
        <div className="rounded-md bg-red-50 border border-red-100 p-3 flex gap-2"><AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" /><div><p className="font-semibold">{data.verifiedVehicleFaultComplaints} verified vehicle-fault</p><p className="text-xs text-gray-600">{data.cleanlinessComplaintCount} cleanliness · {data.acComplaintCount} AC · {data.breakdownComplaintCount} breakdown</p></div></div>
        <div className="rounded-md bg-amber-50 border border-amber-100 p-3 flex gap-2"><ShieldCheck className="h-4 w-4 text-amber-700 mt-0.5" /><div><p className="font-semibold">{data.awaitingResponsibilityCount} awaiting classification</p><p className="text-xs text-gray-600">Not counted as vehicle fault.</p></div></div>
        <div className="rounded-md bg-blue-50 border border-blue-100 p-3 flex gap-2"><Gauge className="h-4 w-4 text-blue-700 mt-0.5" /><div><p className="font-semibold">{data.feedbackIssueCount + data.verifiedVehicleIssueCount} issue reports</p><p className="text-xs text-gray-600">{data.feedbackBreakdownCount + data.breakdownComplaintCount} breakdown reports.</p></div></div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2 flex items-center gap-1"><Users className="h-4 w-4" /> Related Trips, Customers and Drivers</p>
        {data.serviceHistory.length === 0 ? <p className="text-sm text-gray-500">No linked trips.</p> : <div className="overflow-x-auto border rounded-lg"><Table><TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Driver</TableHead><TableHead>Odometer</TableHead><TableHead>Km</TableHead><TableHead>Feedback</TableHead><TableHead>Complaints</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{data.serviceHistory.map((row: any) => <TableRow key={row.booking._id}><TableCell className="font-medium">{row.booking.bookingId}</TableCell><TableCell>{row.customer?.name || row.booking.customerName}</TableCell><TableCell>{new Date(row.booking.pickupDate).toLocaleDateString('en-IN')}</TableCell><TableCell>{row.driver?.name || '-'}</TableCell><TableCell>{odometer(row.booking.startOdometer)} → {odometer(row.booking.endOdometer)}</TableCell><TableCell>{row.kilometers.toLocaleString('en-IN')}</TableCell><TableCell>{row.feedback.length}</TableCell><TableCell>{row.complaints.length}</TableCell><TableCell>{onOpenBooking && <Button size="sm" variant="ghost" onClick={() => onOpenBooking(row.booking)}>Open Booking</Button>}</TableCell></TableRow>)}</TableBody></Table></div>}
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Vehicle Feedback Timeline</p>
        {data.timeline.length === 0 ? <p className="text-sm text-gray-500">No vehicle feedback or complaints yet.</p> : <div className="space-y-2 max-h-72 overflow-y-auto">{data.timeline.map((event: any) => <div key={`${event.type}-${event.recordId}`} className="border rounded-md p-3 text-sm"><div className="flex justify-between gap-2"><p className="font-medium capitalize">{event.type.replace(/_/g, ' ')} · {event.customer?.name || 'Customer'}</p><Badge variant="outline" className="capitalize">{event.responsibleParty || event.booking?.bookingId || ''}</Badge></div><p className="text-gray-700 mt-1">{event.description}</p>{event.responsibilityReason && <p className="text-xs text-gray-500 mt-1">Responsibility evidence: {event.responsibilityReason}</p>}{event.resolution && <p className="text-xs text-green-700 mt-1">Resolution: {event.resolution}</p>}<p className="text-xs text-gray-400 mt-1">{new Date(event.date).toLocaleString('en-IN')}</p></div>)}</div>}
      </div>
    </div>
  );
}
