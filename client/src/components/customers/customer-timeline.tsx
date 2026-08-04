import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Calendar, CreditCard, Gift, Tag, Star, AlertTriangle, CheckCircle2, ClipboardCheck, UserPlus,
} from "lucide-react";

interface Props {
  customerId: string;
}

const TYPE_ICON: Record<string, any> = {
  customer_created: UserPlus,
  booking_created: Calendar,
  booking_status: Calendar,
  payment: CreditCard,
  reward: Gift,
  tag: Tag,
  feedback: Star,
  complaint: AlertTriangle,
  complaint_resolved: CheckCircle2,
  follow_up: ClipboardCheck,
};

const TYPE_COLOR: Record<string, string> = {
  customer_created: "text-blue-600 bg-blue-50",
  booking_created: "text-indigo-600 bg-indigo-50",
  booking_status: "text-gray-600 bg-gray-50",
  payment: "text-green-600 bg-green-50",
  reward: "text-amber-600 bg-amber-50",
  tag: "text-purple-600 bg-purple-50",
  feedback: "text-yellow-600 bg-yellow-50",
  complaint: "text-red-600 bg-red-50",
  complaint_resolved: "text-green-600 bg-green-50",
  follow_up: "text-cyan-600 bg-cyan-50",
};

// Assembled server-side on read from every collection this customer
// touches (bookings, payments, rewards, tags, feedback, complaints,
// follow-ups) — not a separately stored/maintained log.
export default function CustomerTimeline({ customerId }: Props) {
  const { data: events, isLoading } = useQuery<any[]>({
    queryKey: [`/api/customers/${customerId}/timeline`],
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!events || events.length === 0) return <p className="text-sm text-gray-500">No activity yet.</p>;

  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {events.map((e: any, i: number) => {
        const Icon = TYPE_ICON[e.type] || Calendar;
        const color = TYPE_COLOR[e.type] || "text-gray-600 bg-gray-50";
        return (
          <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{e.description}</p>
              <p className="text-xs text-gray-400">
                {new Date(e.date).toLocaleString('en-IN')}
                {e.bookingId ? ` · ${e.bookingId}` : ""}
                {e.employee ? ` · ${e.employee}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
