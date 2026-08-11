import { Plus, Clock, DollarSign, Users, Car, Paperclip, Send, CheckSquare, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  link?: string;
  onClick?: () => void;
  badge?: string;
}

interface QuickActionsProps {
  actions?: QuickAction[];
  onActionClick?: (actionId: string) => void;
}

const defaultActions: QuickAction[] = [
  {
    id: "create-booking",
    title: "Create Booking",
    description: "New booking from customer",
    icon: <Plus className="h-5 w-5" />,
    color: "bg-blue-50 hover:bg-blue-100 border-blue-200",
    link: "/bookings/create",
  },
  {
    id: "assign-vehicle",
    title: "Assign Vehicle",
    description: "Assign to pending booking",
    icon: <Car className="h-5 w-5" />,
    color: "bg-green-50 hover:bg-green-100 border-green-200",
    link: "/bookings/pending",
  },
  {
    id: "collect-payment",
    title: "Collect Payment",
    description: "Send payment reminder",
    icon: <DollarSign className="h-5 w-5" />,
    color: "bg-amber-50 hover:bg-amber-100 border-amber-200",
    link: "/bookings/payments",
  },
  {
    id: "onboard-driver",
    title: "Onboard Driver",
    description: "Add new driver to fleet",
    icon: <Users className="h-5 w-5" />,
    color: "bg-purple-50 hover:bg-purple-100 border-purple-200",
    link: "/drivers/onboard",
  },
  {
    id: "schedule-maintenance",
    title: "Schedule Maintenance",
    description: "Vehicle maintenance schedule",
    icon: <Clock className="h-5 w-5" />,
    color: "bg-orange-50 hover:bg-orange-100 border-orange-200",
    link: "/maintenance/schedule",
  },
  {
    id: "send-update",
    title: "Send Update",
    description: "Message to customer/driver",
    icon: <Send className="h-5 w-5" />,
    color: "bg-cyan-50 hover:bg-cyan-100 border-cyan-200",
    link: "/messages",
  },
  {
    id: "upload-documents",
    title: "Upload Docs",
    description: "Driver/vehicle documents",
    icon: <Paperclip className="h-5 w-5" />,
    color: "bg-red-50 hover:bg-red-100 border-red-200",
    link: "/documents/upload",
  },
  {
    id: "review-analytics",
    title: "Analytics",
    description: "Performance metrics & insights",
    icon: <CheckSquare className="h-5 w-5" />,
    color: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200",
    link: "/analytics",
  },
];

export default function QuickActions({ actions = defaultActions, onActionClick }: QuickActionsProps) {
  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-600" />
          Quick Actions
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              onClick={() => {
                onActionClick?.(action.id);
                if (action.link) {
                  window.location.href = action.link;
                }
                action.onClick?.();
              }}
              className={`h-auto flex flex-col items-center justify-center gap-2 p-4 text-center border ${action.color}`}
            >
              <div className="text-2xl">{action.icon}</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                <p className="text-xs text-gray-600">{action.description}</p>
              </div>
              {action.badge && (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full mt-1">
                  {action.badge}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-4 pt-4 border-t text-xs text-gray-600">
          <p className="font-medium mb-2">💡 Tip: Use keyboard shortcuts for faster workflow</p>
          <div className="grid grid-cols-2 gap-2">
            <div>Press <kbd className="px-2 py-1 bg-gray-100 rounded">B</kbd> for Booking</div>
            <div>Press <kbd className="px-2 py-1 bg-gray-100 rounded">P</kbd> for Payment</div>
            <div>Press <kbd className="px-2 py-1 bg-gray-100 rounded">D</kbd> for Driver</div>
            <div>Press <kbd className="px-2 py-1 bg-gray-100 rounded">V</kbd> for Vehicle</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
