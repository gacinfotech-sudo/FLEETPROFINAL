import { useState } from "react";
import { AlertTriangle, AlertCircle, XCircle, Bell, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Alert {
  id: string;
  type: "critical" | "warning" | "error";
  title: string;
  description: string;
  affectedItems: number;
  actionRequired: boolean;
  resolveAction?: string;
  timestamp: Date;
}

interface CriticalAlertsProps {
  alerts?: Alert[];
  onDismiss?: (alertId: string) => void;
  onAction?: (alertId: string) => void;
}

export default function CriticalAlerts({ alerts = [], onDismiss, onAction }: CriticalAlertsProps) {
  const [expanded, setExpanded] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id));
  const criticalCount = visibleAlerts.filter((a) => a.type === "critical").length;
  const warningCount = visibleAlerts.filter((a) => a.type === "warning").length;

  if (visibleAlerts.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissedAlerts((prev) => new Set([...prev, id]));
    onDismiss?.(id);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case "error":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-red-50 border-l-4 border-red-500";
      case "warning":
        return "bg-orange-50 border-l-4 border-orange-500";
      case "error":
        return "bg-yellow-50 border-l-4 border-yellow-500";
      default:
        return "bg-gray-50 border-l-4 border-gray-500";
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-orange-100 text-orange-800";
      case "error":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="mb-6 space-y-2">
      {/* Alert Header Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div>
            <h3 className="font-semibold text-gray-900">System Alerts</h3>
            <p className="text-sm text-gray-600">
              {criticalCount > 0 && (
                <>
                  <span className="font-bold text-red-600">{criticalCount} critical</span>
                  {warningCount > 0 && <span>, </span>}
                </>
              )}
              {warningCount > 0 && (
                <span className="font-bold text-orange-600">{warningCount} warnings</span>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="gap-2"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Alert Items */}
      {expanded && (
        <div className="space-y-2">
          {visibleAlerts.map((alert) => (
            <div key={alert.id} className={`rounded-lg p-4 ${getBgColor(alert.type)}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-1">{getIcon(alert.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{alert.title}</h4>
                      <Badge className={getBadgeColor(alert.type)}>
                        {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}
                      </Badge>
                      {alert.affectedItems > 0 && (
                        <Badge variant="outline">
                          {alert.affectedItems} affected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{alert.description}</p>
                    {alert.timestamp && (
                      <p className="text-xs text-gray-500 mt-1">
                        {alert.timestamp.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {alert.actionRequired && alert.resolveAction && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAction?.(alert.id)}
                      className="text-xs"
                    >
                      {alert.resolveAction}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismiss(alert.id)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Auto-resolve tips */}
      {criticalCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <p className="font-medium mb-1">⚡ Priority: Resolve critical alerts immediately</p>
          <p>Critical alerts impact your revenue and customer satisfaction.</p>
        </div>
      )}
    </div>
  );
}
