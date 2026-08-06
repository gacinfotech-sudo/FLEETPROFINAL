import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Car, LogOut, MapPin, Phone, CheckCircle2, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Duty {
  _id: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  pickupLocation: string;
  dropoffLocation?: string;
  pickupDate: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  status: string;
  totalAmount?: number;
  advanceReceived?: number;
  dutyAcceptedAt?: string;
}

function fmtMoney(n?: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function DriverPortalPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [checkedAuth, setCheckedAuth] = useState(false);

  const meQuery = useQuery<any>({
    queryKey: ["/api/driver-portal/me"],
    retry: false,
  });

  useEffect(() => {
    if (meQuery.isError) setLocation("/driver-login");
    if (meQuery.data || meQuery.isError) setCheckedAuth(true);
  }, [meQuery.data, meQuery.isError, setLocation]);

  const dutiesQuery = useQuery<Duty[]>({
    queryKey: ["/api/driver-portal/my-duties"],
    enabled: !!meQuery.data,
  });

  const acceptMutation = useMutation({
    mutationFn: async (bookingId: string) => (await apiRequest("POST", `/api/driver-portal/bookings/${bookingId}/accept-duty`, {})).json(),
    onSuccess: () => {
      toast({ title: "Duty accepted" });
      queryClient.invalidateQueries({ queryKey: ["/api/driver-portal/my-duties"] });
    },
    onError: (err: any) => toast({ title: "Could not accept duty", description: err.message, variant: "destructive" }),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/driver-auth/logout", {})).json(),
    onSuccess: () => setLocation("/driver-login"),
  });

  if (!checkedAuth || (meQuery.isLoading && !meQuery.isError)) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }
  if (!meQuery.data) return null; // redirecting to /driver-login

  const duties = dutiesQuery.data || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5" />
          <div>
            <p className="font-semibold leading-tight">{meQuery.data.name}</p>
            <p className="text-xs text-blue-100 leading-tight">{meQuery.data.phone}</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => logoutMutation.mutate()}>
          <LogOut className="h-4 w-4 mr-1" /> Logout
        </Button>
      </div>

      <div className="p-4 space-y-3 max-w-lg mx-auto">
        <h1 className="text-lg font-semibold text-gray-900">My Duties</h1>
        {dutiesQuery.isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : duties.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-gray-500">No duties assigned right now.</CardContent></Card>
        ) : (
          duties.map((d) => (
            <Card key={d._id} data-testid={`duty-${d.bookingId}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{d.bookingId}</CardTitle>
                  <Badge variant="outline" className="capitalize">{d.status.replace(/_/g, ' ')}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <span>{d.pickupLocation} → {d.dropoffLocation || '-'}</span>
                </div>
                <div className="text-gray-600">
                  Pickup: {new Date(d.pickupDate).toLocaleDateString('en-IN')} {d.pickupTime || ''}
                  {d.returnDate ? ` · Return: ${new Date(d.returnDate).toLocaleDateString('en-IN')} ${d.returnTime || ''}` : ''}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4 text-gray-400" /> {d.customerName} · {d.customerPhone}
                </div>
                {(d.totalAmount || 0) - (d.advanceReceived || 0) > 0 && (
                  <div className="flex items-center gap-2 text-amber-700 font-medium">
                    <IndianRupee className="h-4 w-4" /> Collect {fmtMoney((d.totalAmount || 0) - (d.advanceReceived || 0))}
                  </div>
                )}
                {d.dutyAcceptedAt ? (
                  <div className="flex items-center gap-1.5 text-green-700 text-sm pt-1">
                    <CheckCircle2 className="h-4 w-4" /> Accepted {new Date(d.dutyAcceptedAt).toLocaleString('en-IN')}
                  </div>
                ) : (
                  <Button size="sm" className="w-full mt-1" disabled={acceptMutation.isPending} onClick={() => acceptMutation.mutate(d._id)}>
                    Accept Duty
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
