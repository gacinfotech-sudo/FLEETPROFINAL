// Notification Batch Manager - Submit and monitor bulk jobs
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Play, Square } from 'lucide-react';

interface BatchJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalItems: number;
  processedItems: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
  completedAt?: string;
}

export const NotificationBatchManager: React.FC = () => {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    category: 'general',
    channels: ['push'] as string[],
    targetType: 'filter',
    userFilter: '',
    userIds: ''
  });
  const [loading, setLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/notification-batch/jobs');
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = {
        title: formData.title,
        body: formData.body,
        category: formData.category,
        channels: formData.channels
      };

      if (formData.targetType === 'filter' && formData.userFilter) {
        payload.userFilter = JSON.parse(formData.userFilter);
      } else if (formData.targetType === 'ids' && formData.userIds) {
        payload.userIds = formData.userIds.split(',').map(id => id.trim());
      }

      const response = await fetch('/api/notification-batch/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        setFormData({
          title: '',
          body: '',
          category: 'general',
          channels: ['push'],
          targetType: 'filter',
          userFilter: '',
          userIds: ''
        });
        fetchJobs();
      }
    } catch (error) {
      console.error('Failed to submit batch job:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      const response = await fetch(`/api/notification-batch/jobs/${jobId}/cancel`, {
        method: 'POST'
      });

      if (response.ok) {
        fetchJobs();
      }
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-700';
      case 'failed':
        return 'bg-red-500/10 text-red-700';
      case 'processing':
        return 'bg-blue-500/10 text-blue-700';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-700';
      case 'cancelled':
        return 'bg-gray-500/10 text-gray-700';
      default:
        return 'bg-gray-500/10 text-gray-700';
    }
  };

  const progressPercentage = (processed: number, total: number) =>
    total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Submit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Submit Bulk Send Job</CardTitle>
          <CardDescription>Send notifications to multiple users at once</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Notification Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="px-3 py-2 border rounded-md"
              >
                <option value="general">General</option>
                <option value="booking">Booking</option>
                <option value="payment">Payment</option>
                <option value="promotion">Promotion</option>
                <option value="alert">Alert</option>
              </select>
            </div>

            <Textarea
              placeholder="Notification Body"
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              rows={3}
              required
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Target Users</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="filter"
                    checked={formData.targetType === 'filter'}
                    onChange={(e) => setFormData({ ...formData, targetType: e.target.value })}
                  />
                  <span>MongoDB Filter</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="ids"
                    checked={formData.targetType === 'ids'}
                    onChange={(e) => setFormData({ ...formData, targetType: e.target.value })}
                  />
                  <span>User IDs</span>
                </label>
              </div>

              {formData.targetType === 'filter' ? (
                <Textarea
                  placeholder='{"role": "driver", "status": "active"}'
                  value={formData.userFilter}
                  onChange={(e) => setFormData({ ...formData, userFilter: e.target.value })}
                  rows={2}
                  required
                />
              ) : (
                <Textarea
                  placeholder="user1, user2, user3"
                  value={formData.userIds}
                  onChange={(e) => setFormData({ ...formData, userIds: e.target.value })}
                  rows={2}
                  required
                />
              )}
            </div>

            <div className="flex gap-2">
              {['push', 'email', 'sms', 'in_app'].map(channel => (
                <label key={channel} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.channels.includes(channel)}
                    onChange={(e) => {
                      const channels = e.target.checked
                        ? [...formData.channels, channel]
                        : formData.channels.filter(c => c !== channel);
                      setFormData({ ...formData, channels });
                    }}
                  />
                  <span className="capitalize text-sm">{channel}</span>
                </label>
              ))}
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Submit Batch Job
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Jobs</CardTitle>
          <CardDescription>Monitor and manage batch operations</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No batch jobs yet</p>
          ) : (
            <div className="space-y-4">
              {jobs.map(job => {
                const progress = progressPercentage(job.processedItems, job.totalItems);
                const successRate = job.totalItems > 0
                  ? ((job.successCount / job.totalItems) * 100).toFixed(1)
                  : '0';

                return (
                  <div key={job.jobId} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <span className="font-mono text-sm">{job.jobId}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created: {new Date(job.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm text-muted-foreground">{progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total</span>
                        <p className="font-semibold">{job.totalItems}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Processed</span>
                        <p className="font-semibold">{job.processedItems}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Success</span>
                        <p className="font-semibold text-green-600">{job.successCount}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Failed</span>
                        <p className="font-semibold text-red-600">{job.failureCount}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    {job.status === 'processing' || job.status === 'pending' ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancel(job.jobId)}
                      >
                        <Square className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationBatchManager;
