// Notification Center - View notification history and status
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Clock, CheckCircle, AlertCircle, Trash2, Archive, MoreVertical } from 'lucide-react';

interface Notification {
  _id: string;
  title: string;
  body: string;
  category: string;
  channel: string;
  status: 'sent' | 'delivered' | 'clicked' | 'failed';
  createdAt: string;
  deliveredAt?: string;
  clickedAt?: string;
  read: boolean;
}

export const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'failed'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  const categories = [
    { id: 'booking', label: 'Booking', icon: '📅', color: 'bg-blue-100 text-blue-800' },
    { id: 'payment', label: 'Payment', icon: '💳', color: 'bg-green-100 text-green-800' },
    { id: 'promotion', label: 'Promotion', icon: '🎉', color: 'bg-purple-100 text-purple-800' },
    { id: 'alert', label: 'Alert', icon: '⚠️', color: 'bg-red-100 text-red-800' },
    { id: 'driver_assignment', label: 'Driver', icon: '👤', color: 'bg-orange-100 text-orange-800' },
    { id: 'support', label: 'Support', icon: '💬', color: 'bg-indigo-100 text-indigo-800' }
  ];

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [filter]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`/api/user/notifications?filter=${filter}`);
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/user/notifications/${id}/read`, { method: 'POST' });
      setNotifications(notifs =>
        notifs.map(n => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/user/notifications/${id}`, { method: 'DELETE' });
      setNotifications(notifs => notifs.filter(n => n._id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await fetch(`/api/user/notifications/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedNotifications })
      });
      setNotifications(notifs =>
        notifs.filter(n => !selectedNotifications.includes(n._id))
      );
      setSelectedNotifications([]);
    } catch (error) {
      console.error('Failed to delete notifications:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'clicked':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'Delivered';
      case 'clicked':
        return 'Clicked';
      case 'failed':
        return 'Failed';
      default:
        return 'Sent';
    }
  };

  const getCategoryInfo = (categoryId: string) => {
    return categories.find(c => c.id === categoryId) || {
      id: categoryId,
      label: categoryId,
      icon: '📬',
      color: 'bg-gray-100 text-gray-800'
    };
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const failedCount = notifications.filter(n => n.status === 'failed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notification Center
          </h2>
          <p className="text-muted-foreground mt-1">
            {notifications.length} notifications
            {unreadCount > 0 && ` (${unreadCount} unread)`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{notifications.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
            <p className="text-xs text-muted-foreground">Unread</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'unread', 'failed'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Bulk Actions */}
      {selectedNotifications.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6 flex items-center justify-between">
            <p className="text-sm font-medium">
              {selectedNotifications.length} selected
            </p>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No notifications</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map(notification => {
            const category = getCategoryInfo(notification.category);
            return (
              <Card
                key={notification._id}
                className={`cursor-pointer transition-colors ${
                  !notification.read ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification._id)}
                      onChange={(e) => {
                        const id = notification._id;
                        setSelectedNotifications(prev =>
                          e.target.checked
                            ? [...prev, id]
                            : prev.filter(pid => pid !== id)
                        );
                      }}
                      className="mt-1 w-4 h-4 cursor-pointer"
                    />

                    {/* Content */}
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => handleMarkAsRead(notification._id)}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-lg">{category.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold truncate ${
                            !notification.read ? 'text-blue-900' : ''
                          }`}>
                            {notification.title}
                          </h4>
                          <p className={`text-sm line-clamp-2 ${
                            !notification.read
                              ? 'text-blue-800'
                              : 'text-muted-foreground'
                          }`}>
                            {notification.body}
                          </p>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className={category.color}>
                          {category.label}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getStatusIcon(notification.status)}
                          {getStatusLabel(notification.status)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {notification.channel}
                        </Badge>
                      </div>

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(notification._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
