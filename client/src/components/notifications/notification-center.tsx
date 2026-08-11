import React, { useState } from "react";
import {
  useGetUserNotifications,
  useGetUnreadNotifications,
  useMarkAsRead,
  useGetDeliveryStats,
  useGetTemplates,
} from "../../hooks/useNotifications";
import { LoadingSpinner } from "../common/LoadingSpinner";

interface NotificationCenterProps {
  userId: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const [view, setView] = useState<"all" | "unread">("unread");
  const { data: allNotifications = [], isLoading: allLoading } = useGetUserNotifications(
    userId,
    50
  );
  const { data: unreadNotifications = [], isLoading: unreadLoading } =
    useGetUnreadNotifications(userId);
  const { data: stats, isLoading: statsLoading } = useGetDeliveryStats();
  const { data: templates = [] } = useGetTemplates();
  const markAsRead = useMarkAsRead();

  const notifications = view === "unread" ? unreadNotifications : allNotifications;
  const isLoading = view === "unread" ? unreadLoading : allLoading;

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
  };

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      booking: "🎫",
      payment: "💳",
      driver: "🚗",
      customer: "👤",
      system: "⚙️",
      alert: "🚨",
      promotion: "🎁",
      maintenance: "🔧",
    };
    return icons[category] || "📢";
  };

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead.mutate(notificationId, {
      onSuccess: () => {
        // Toast notification would go here
      },
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Notification Center
        </h1>
        <div className="flex items-center gap-2">
          {unreadNotifications.length > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full text-sm font-medium">
              {unreadNotifications.length} Unread
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Sent</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.totalNotifications}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Delivery Rate</div>
            <div className="text-3xl font-bold text-green-600">{stats.deliveryRate}%</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Delivery</div>
            <div className="text-3xl font-bold text-blue-600">{stats.avgDeliveryTime}s</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Failed</div>
            <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setView("unread")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            view === "unread"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Unread ({unreadNotifications.length})
        </button>
        <button
          onClick={() => setView("all")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            view === "all"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          All ({allNotifications.length})
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {view === "unread" ? "No unread notifications" : "No notifications"}
          </div>
        ) : (
          notifications.map((notif: any) => (
            <div
              key={notif.id}
              className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                notif.status !== "read" ? "bg-blue-50 dark:bg-blue-900" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-2xl">
                    {getCategoryIcon(notif.category)}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {notif.title}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                          notif.priority
                        )}`}
                      >
                        {notif.priority.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(notif.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {notif.message}
                    </p>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {notif.channels.map((channel: string) => (
                        <span
                          key={channel}
                          className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                        >
                          {channel}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {notif.status !== "read" && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      disabled={markAsRead.isPending}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      Mark Read
                    </button>
                  )}
                  {notif.actionUrl && (
                    <a
                      href={notif.actionUrl}
                      className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 whitespace-nowrap"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Templates Reference */}
      {templates.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Available Templates
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {templates.slice(0, 4).map((template: any) => (
              <div
                key={template.id}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
              >
                <div className="font-semibold text-gray-900 dark:text-white">
                  {template.name}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {template.messageTemplate}
                </p>
                <div className="flex gap-1 flex-wrap mt-2">
                  {template.channels.map((ch: string) => (
                    <span
                      key={ch}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
