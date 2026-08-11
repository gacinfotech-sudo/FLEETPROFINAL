import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, AlertCircle, CheckCircle, MessageSquare, Bug, Info, Trash2 } from "lucide-react";

// Mock notifications - in production, fetch from API
const mockNotifications = [
  {
    id: "1",
    type: "bug" as const,
    title: "🐛 Bug Report Received",
    message: "Your bug report about the booking page total calculation has been received and assigned to our team.",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    read: false,
    action: { label: "View Report", href: "/settings/bug-reports" },
  },
  {
    id: "2",
    type: "ticket" as const,
    title: "💬 Support Response",
    message: "Our support team has replied to your ticket about payment gateway integration issues.",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    read: false,
    action: { label: "View Ticket", href: "/settings/support" },
  },
  {
    id: "3",
    type: "success" as const,
    title: "✅ Bug Fixed",
    message: "The booking history filter bug you reported has been fixed and is available in the latest version.",
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    read: true,
  },
  {
    id: "4",
    type: "info" as const,
    title: "ℹ️ System Update",
    message: "FleetPro platform will undergo scheduled maintenance on Friday from 2-4 AM IST.",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    read: true,
  },
  {
    id: "5",
    type: "warning" as const,
    title: "⚠️ Payment Due",
    message: "Your subscription payment of ₹4,999 is due tomorrow. Please update your payment method.",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    read: true,
    action: { label: "Pay Now", href: "/settings/billing" },
  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case "error":
      case "warning":
        return <AlertCircle className="w-6 h-6 text-orange-600" />;
      case "bug":
        return <Bug className="w-6 h-6 text-red-600" />;
      case "ticket":
        return <MessageSquare className="w-6 h-6 text-blue-600" />;
      default:
        return <Info className="w-6 h-6 text-blue-600" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200";
      case "error":
      case "warning":
        return "bg-orange-50 border-orange-200";
      case "bug":
        return "bg-red-50 border-red-200";
      case "ticket":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const filteredNotifications = filter === "unread"
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const deleteAll = () => {
    setNotifications([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">🔔 Notifications</h1>
            <p className="text-purple-100 mt-1">Stay updated with real-time alerts & messages</p>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                onClick={markAllAsRead}
                className="bg-white text-purple-600 hover:bg-purple-50"
                size="sm"
              >
                Mark all as read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                onClick={deleteAll}
                variant="destructive"
                size="sm"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">📊 TOTAL</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">{notifications.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">🔴 UNREAD</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{unreadCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">✅ READ</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {notifications.length - unreadCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          size="sm"
        >
          All ({notifications.length})
        </Button>
        <Button
          variant={filter === "unread" ? "default" : "outline"}
          onClick={() => setFilter("unread")}
          size="sm"
        >
          Unread ({unreadCount})
        </Button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-gray-500">
              <Bell className="w-12 h-12 mx-auto opacity-20 mb-2" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm">You're all caught up!</p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notif) => (
            <Card
              key={notif.id}
              className={`${getColor(notif.type)} border transition hover:shadow-md ${
                !notif.read ? "ring-2 ring-blue-300" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getIcon(notif.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {notif.title}
                      </h3>
                      {!notif.read && (
                        <Badge className="bg-blue-500">New</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-3">
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">
                        {new Date(notif.timestamp).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {notif.action && (
                          <a
                            href={notif.action.href}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                          >
                            {notif.action.label}
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNotification(notif.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-1" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold">Notification Settings</p>
              <p className="mt-1">
                You can customize which notifications you receive by visiting
                <a href="/settings" className="font-semibold text-blue-600 ml-1">
                  Settings → Notifications
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
