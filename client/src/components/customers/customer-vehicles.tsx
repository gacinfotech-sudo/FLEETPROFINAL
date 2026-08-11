import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Car, Gauge, Snowflake, Sparkles, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function rating(value?: number | null) {
  return value == null ? 'Not rated' : `${value.toFixed(1)} / 5`;
}

function odometer(value?: number | null) {
  return value == null ? '-' : Number(value).toLocaleString('en-IN');
}

export default function CustomerVehicles({ customerId }: { customerId: string }) {
  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: [`/api/customers/${customerId}/vehicles`] });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Car className="h-5 w-5 text-blue-600" /> Vehicles Used by This Customer</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-gray-500">Loading vehicle history...</p> : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No Fleet Master vehicle is linked to this customer's bookings yet.</p>
        ) : <div className="space-y-4">{rows.map((row: any) => (
          <div key={row.vehicle._id} className="rounded-lg border p-4 space-y-4">
            <div className="flex justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-base capitalize">{[row.vehicle.make, row.vehicle.vehicleModel].filter(Boolean).join(' ')}</p>
                <p className="text-sm text-gray-500">{row.vehicle.licensePlate || 'No registration'} · {row.vehicle.type || 'Uncategorised'}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{row.totalTrips} trip{row.totalTrips === 1 ? '' : 's'}</Badge>
                <Badge variant="outline"><Gauge className="h-3.5 w-3.5 mr-1" /> {row.totalKilometers.toLocaleString('en-IN')} km</Badge>
                <Badge variant="outline"><Star className="h-3.5 w-3.5 mr-1 fill-amber-400 text-amber-400" /> {rating(row.averageVehicleRating)}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {[
                ['Cleanliness', row.cleanlinessRating, Sparkles], ['Comfort', row.comfortRating, Star],
                ['AC', row.acRating, Snowflake], ['Condition', row.conditionRating, Car],
              ].map(([label, value, Icon]: any) => <div key={label} className="rounded-md bg-gray-50 border p-2"><p className="text-xs text-gray-500 flex items-center gap-1"><Icon className="h-3.5 w-3.5" /> {label}</p><p className="font-medium">{rating(value)}</p></div>)}
            </div>

            <div className="grid sm:grid-cols-4 gap-2 text-sm">
              <div className="rounded-md border p-2">{row.verifiedVehicleFaultComplaints} verified vehicle-fault</div>
              <div className="rounded-md border p-2 text-red-700">{row.verifiedVehicleIssueCount + row.feedbackIssueCount} issue report{row.verifiedVehicleIssueCount + row.feedbackIssueCount === 1 ? '' : 's'}</div>
              <div className="rounded-md border p-2 text-red-700">{row.breakdownComplaintCount + row.feedbackBreakdownCount} breakdown report{row.breakdownComplaintCount + row.feedbackBreakdownCount === 1 ? '' : 's'}</div>
              <div className="rounded-md border p-2 text-amber-700">{row.awaitingResponsibilityCount} awaiting responsibility</div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Trip and Odometer History</p>
              <div className="space-y-1">{row.tripHistory.map((trip: any) => <p key={trip.bookingRecordId} className="text-sm rounded-md bg-gray-50 p-2">{trip.bookingId} · {new Date(trip.pickupDate).toLocaleDateString('en-IN')} · {trip.pickupLocation} → {trip.dropoffLocation || '-'} · {odometer(trip.startOdometer)} → {odometer(trip.endOdometer)} ({trip.kilometers.toLocaleString('en-IN')} km){trip.driver?.name ? ` · ${trip.driver.name}` : ''}</p>)}</div>
            </div>

            {row.feedback.length > 0 && <div className="space-y-1"><p className="text-xs font-medium text-gray-500">Vehicle Feedback</p>{row.feedback.map((item: any) => <p key={item._id} className="text-sm rounded-md bg-green-50 p-2">{item.comments || item.vehicleIssueDescription || `Vehicle rating ${item.vehicleRating || '-'} / 5`}</p>)}</div>}
            {row.complaints.length > 0 && <div className="space-y-1"><p className="text-xs font-medium text-gray-500">Vehicle-linked Complaints</p>{row.complaints.map((item: any) => <p key={item._id} className="text-sm rounded-md bg-red-50 p-2 capitalize"><AlertTriangle className="inline h-3.5 w-3.5 mr-1" />{item.category.replace(/_/g, ' ')} · responsibility: {item.responsibleParty || 'unclear'} · {item.status.replace(/_/g, ' ')}</p>)}</div>}
          </div>
        ))}</div>}
      </CardContent>
    </Card>
  );
}
