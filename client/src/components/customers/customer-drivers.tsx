import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, CheckCircle2, Star, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function rating(value?: number | null) {
  return value == null ? 'Not rated' : `${value.toFixed(1)} / 5`;
}

export default function CustomerDrivers({ customerId }: { customerId: string }) {
  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: [`/api/customers/${customerId}/drivers`] });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><UserRound className="h-5 w-5 text-indigo-600" /> Drivers Who Served This Customer</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-gray-500">Loading driver history...</p> : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No assigned Driver Master record is linked to this customer's bookings yet.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row: any) => (
              <div key={row.driver._id} className="rounded-lg border p-4 space-y-4">
                <div className="flex justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-base">{row.driver.name}</p>
                    <p className="text-sm text-gray-500">{row.driver.phone}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">{row.totalTripsServed} trip{row.totalTripsServed === 1 ? '' : 's'}</Badge>
                    <Badge variant="outline"><Star className="h-3.5 w-3.5 mr-1 fill-amber-400 text-amber-400" /> {rating(row.averageRating)}</Badge>
                    {row.appreciationCount > 0 && <Badge className="bg-green-100 text-green-800">{row.appreciationCount} appreciation</Badge>}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                  {[
                    ['Punctuality', row.punctualityRating], ['Behaviour', row.behaviourRating],
                    ['Driving Safety', row.drivingSafetyRating], ['Route Knowledge', row.routeKnowledgeRating],
                    ['Payment Handling', row.paymentHandlingRating],
                  ].map(([label, value]) => <div key={String(label)} className="rounded-md bg-gray-50 border p-2"><p className="text-xs text-gray-500">{label}</p><p className="font-medium">{rating(value as number | null)}</p></div>)}
                </div>

                <div className="grid sm:grid-cols-3 gap-2 text-sm">
                  <div className="flex items-center gap-2 rounded-md border p-2"><CheckCircle2 className="h-4 w-4 text-green-600" /><span>{row.resolvedComplaints} resolved complaint{row.resolvedComplaints === 1 ? '' : 's'}</span></div>
                  <div className="flex items-center gap-2 rounded-md border p-2"><AlertTriangle className="h-4 w-4 text-red-600" /><span>{row.unresolvedComplaints} unresolved</span></div>
                  <div className="flex items-center gap-2 rounded-md border p-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><span>{row.awaitingResponsibilityCount} awaiting responsibility</span></div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Trip History</p>
                  <div className="flex gap-2 flex-wrap">
                    {row.tripDates.map((trip: any) => <Badge key={trip.bookingRecordId} variant="secondary">{trip.bookingId} · {new Date(trip.pickupDate).toLocaleDateString('en-IN')} · {trip.pickupLocation} → {trip.dropoffLocation || '-'}</Badge>)}
                  </div>
                </div>

                {row.feedback.length > 0 && <div className="space-y-1"><p className="text-xs font-medium text-gray-500">Feedback</p>{row.feedback.map((item: any) => <p key={item._id} className="text-sm rounded-md bg-green-50 p-2">{item.type === 'appreciation' ? 'Appreciation' : 'Feedback'}: {item.comments || `Driver rating ${item.driverRating || '-'} / 5`}</p>)}</div>}
                {row.complaints.length > 0 && <div className="space-y-1"><p className="text-xs font-medium text-gray-500">Driver-linked Complaints</p>{row.complaints.map((item: any) => <p key={item._id} className="text-sm rounded-md bg-red-50 p-2 capitalize">{item.category.replace(/_/g, ' ')} · responsibility: {item.responsibleParty || 'unclear'} · {item.status.replace(/_/g, ' ')}</p>)}</div>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
