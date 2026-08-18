import { useState, useEffect } from "react";
import { Bell, X, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: string;
  title: string;
  message: string;
  priority: "critical" | "high" | "medium" | "low";
  actionUrl?: string;
  actionLabel?: string;
  read: boolean;
  channels: string[];
  createdAt: Date;
  sentAt?: Date;
}

interface NotificationCenterProps {
  notifications?: Notification[];
  onMarkAsRead?: (notificationId: string) => void;
  onDismiss?: (notificationId: string) => void;
}

export default function NotificationCenter({
  notifications = [],
  onMarkAsRead,
  onDismiss,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleNotifications = notifications.filter(
    (n) => !dismissedIds.has(n.id)
  );
  const unreadCount = visibleNotifications.filter((n) => !n.read).length;
  const criticalCount = visibleNotifications.filter(
    (n) => n.priority === "critical"
  ).length;
  const highCount = visibleNotifications.filter(
    (n) => n.priority === "high"
  ).length;

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
    onDismiss?.(id);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "text-red-600";
      case "high":
        return "text-orange-600";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-50";
      case "high":
        return "bg-orange-50";
      case "medium":
        return "bg-yellow-50";
      case "low":
        return "bg-gray-50";
      default:
        return "bg-gray-50";
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <>
      {/* Notification Bell Button */}
      <div className="fixed top-20 right-6 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="relative rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow"
        >
          <Bell className="h-5 w-5 text-gray-700" />
          {unreadCount > 0 && (
            <>
              <span className="absolute top-1 right-1 h-3 w-3 bg-red-600 rounded-full animate-pulse" />
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            </>
          )}
        </Button>
      </div>

      {/* Notification Panel */}
      {isOpen && (
        <div className="fixed top-20 right-6 z-50 w-96 max-h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <p className="text-xs text-gray-600">
                {criticalCount > 0 && (
                  <>
                    <span className="font-bold text-red-600">{criticalCount} critical</span>
                    {highCount > 0 && <span>, </span>}
                  </>
                )}
                {highCount > 0 && (
                  <span className="font-bold text-orange-600">{highCount} urgent</span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Notifications List */}
          {visibleNotifications.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-gray-900">All caught up!</p>
                <p className="text-xs text-gray-600 mt-1">
                  No new notifications
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y">
              {visibleNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notification.read ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Priority Indicator */}
                    <div
                      className={`h-2 w-2 rounded-full mt-1 flex-shrink-0 ${
                        notification.priority === "critical"
                          ? "bg-red-600 animate-pulse"
                          : notification.priority === "high"
                          ? "bg-orange-600"
                          : notification.priority === "medium"
                          ? "bg-yellow-600"
                          : "bg-gray-400"
                      }`}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <Badge
                              variant="outline"
                              className="mt-1 text-xs"
                            >
                              New
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                        {notification.message}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-gray-500">
                          {formatTime(notification.createdAt)}
                        </p>
                        {notification.channels && (
                          <div className="flex gap-1">
                            {notification.channels.map((ch) => (
                              <span
                                key={ch}
                                className="text-xs text-gray-400"
                              >
                                {ch === "in-app" && "📱"}
                                {ch === "email" && "📧"}
                                {ch === "push" && "🔔"}
                                {ch === "sms" && "💬"}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {notification.actionUrl && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => {
                              window.location.href = notification.actionUrl!;
                              onMarkAsRead?.(notification.id);
                            }}
                          >
                            {notification.actionLabel || "View"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => handleDismiss(notification.id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Close */}
                    {!notification.actionUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(notification.id)}
                        className="h-6 w-6 p-0 flex-shrink-0"
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {visibleNotifications.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50 p-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => {
                  visibleNotifications.forEach((n) => {
                    if (!n.read) onMarkAsRead?.(n.id);
                  });
                }}
              >
                Mark all as read
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 text-xs"
                onClick={() => {
                  visibleNotifications.forEach((n) =>
                    handleDismiss(n.id)
                  );
                }}
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Critical Alert Toast (for critical priority) */}
      {criticalCount > 0 && (
        <div className="fixed top-24 right-6 z-40 max-w-sm bg-red-50 border-l-4 border-red-600 rounded-lg p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-900">
                {criticalCount} Critical Alert{criticalCount > 1 ? "s" : ""}
              </h4>
              <p className="text-sm text-red-700 mt-1">
                {visibleNotifications
                  .filter((n) => n.priority === "critical")
                  .slice(0, 1)[0]?.message.substring(0, 100)}
                ...
              </p>
              <Button
                size="sm"
                className="mt-2 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setIsOpen(true)}
              >
                View Alerts
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
