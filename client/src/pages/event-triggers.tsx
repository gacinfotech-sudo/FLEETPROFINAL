import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Toggle2 } from 'lucide-react';

interface EventTrigger {
  id: string;
  name: string;
  eventType: string;
  condition: string;
  template: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  enabled: boolean;
  recipients: string[];
  delay: number; // seconds
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  statistics?: {
    triggered: number;
    sent: number;
    failed: number;
  };
}

interface EventType {
  value: string;
  label: string;
  description: string;
}

const EVENT_TYPES: EventType[] = [
  { value: 'booking_created', label: 'Booking Created', description: 'When a new booking is created' },
  { value: 'booking_confirmed', label: 'Booking Confirmed', description: 'When booking is confirmed' },
  { value: 'booking_cancelled', label: 'Booking Cancelled', description: 'When booking is cancelled' },
  { value: 'booking_completed', label: 'Booking Completed', description: 'When booking is completed' },
  { value: 'payment_received', label: 'Payment Received', description: 'When payment is received' },
  { value: 'payment_failed', label: 'Payment Failed', description: 'When payment fails' },
  { value: 'payment_overdue', label: 'Payment Overdue', description: 'When payment is overdue' },
  { value: 'driver_assigned', label: 'Driver Assigned', description: 'When driver is assigned' },
  { value: 'driver_unassigned', label: 'Driver Unassigned', description: 'When driver is unassigned' },
  { value: 'vehicle_assigned', label: 'Vehicle Assigned', description: 'When vehicle is assigned' },
  { value: 'trip_started', label: 'Trip Started', description: 'When trip starts' },
  { value: 'trip_ended', label: 'Trip Ended', description: 'When trip ends' },
  { value: 'customer_created', label: 'Customer Created', description: 'When customer is added' },
  { value: 'customer_updated', label: 'Customer Updated', description: 'When customer is updated' },
  { value: 'invoice_created', label: 'Invoice Created', description: 'When invoice is generated' },
  { value: 'invoice_paid', label: 'Invoice Paid', description: 'When invoice is paid' },
  { value: 'refund_issued', label: 'Refund Issued', description: 'When refund is issued' },
];

const RECIPIENT_TYPES = [
  { value: 'customer_email', label: 'Customer Email' },
  { value: 'driver_email', label: 'Driver Email' },
  { value: 'manager_email', label: 'Manager Email' },
  { value: 'customer_phone', label: 'Customer Phone' },
  { value: 'driver_phone', label: 'Driver Phone' },
  { value: 'admin_email', label: 'Admin Email' },
  { value: 'team_email', label: 'Team Email' },
];

export default function EventTriggers() {
  const [triggers, setTriggers] = useState<EventTrigger[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<EventTrigger | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    eventType: '',
    condition: '',
    template: '',
    channel: 'EMAIL' as const,
    recipients: [] as string[],
    delay: 0,
    retryCount: 3,
  });

  const { data: triggersData } = useQuery({
    queryKey: ['event-triggers'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/triggers');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.triggers || [];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['templates-for-triggers'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/templates');
      if (!response.ok) return [];
      const data = await response.json();
      return data.templates || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch('/api/notifications/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to create');
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!selectedTrigger) return;
      const response = await fetch(`/api/notifications/triggers/${selectedTrigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (triggerId: string) => {
      const response = await fetch(`/api/notifications/triggers/${triggerId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      return response.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (triggerId: string) => {
      const response = await fetch(`/api/notifications/triggers/${triggerId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to toggle');
      return response.json();
    },
  });

  if (triggersData) {
    setTriggers(triggersData);
  }

  const handleSave = async () => {
    const payload = {
      name: formData.name,
      eventType: formData.eventType,
      condition: formData.condition,
      template: formData.template,
      channel: formData.channel,
      recipients: formData.recipients,
      delay: formData.delay,
      retryCount: formData.retryCount,
    };

    if (selectedTrigger) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }

    setIsCreating(false);
    setSelectedTrigger(null);
    resetForm();
  };

  const handleToggle = async (triggerId: string) => {
    await toggleMutation.mutateAsync(triggerId);
  };

  const handleDelete = async (triggerId: string) => {
    if (confirm('Delete this trigger?')) {
      await deleteMutation.mutateAsync(triggerId);
      if (selectedTrigger?.id === triggerId) {
        setSelectedTrigger(null);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      eventType: '',
      condition: '',
      template: '',
      channel: 'EMAIL',
      recipients: [],
      delay: 0,
      retryCount: 3,
    });
  };

  const getEventTypeLabel = (value: string) => {
    const event = EVENT_TYPES.find(e => e.value === value);
    return event?.label || value;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Event Triggers</h1>
          <p className="text-gray-600 mt-2">Automatically send notifications on system events</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Triggers List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Triggers</h2>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setSelectedTrigger(null);
                  resetForm();
                }}
                className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {triggers.map((trigger) => (
                <div
                  key={trigger.id}
                  onClick={() => {
                    setSelectedTrigger(trigger);
                    setIsCreating(false);
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                    selectedTrigger?.id === trigger.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{trigger.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {getEventTypeLabel(trigger.eventType)}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      trigger.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {trigger.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {trigger.statistics && (
                    <p className="text-xs text-gray-600 mt-2">
                      {trigger.statistics.sent}/{trigger.statistics.triggered} sent
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="col-span-2">
            {isCreating || selectedTrigger ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">
                    {selectedTrigger ? 'Edit Trigger' : 'New Trigger'}
                  </h2>
                  {selectedTrigger && (
                    <button
                      onClick={() => handleDelete(selectedTrigger.id)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="e.g., Send confirmation on booking"
                    />
                  </div>

                  {/* Event Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Event</label>
                    <select
                      value={formData.eventType}
                      onChange={(e) => setFormData(prev => ({ ...prev, eventType: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="">Select event...</option>
                      {EVENT_TYPES.map(et => (
                        <option key={et.value} value={et.value}>
                          {et.label} - {et.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Condition */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Condition (Optional)</label>
                    <input
                      type="text"
                      value={formData.condition}
                      onChange={(e) => setFormData(prev => ({ ...prev, condition: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="e.g., amount > 5000"
                    />
                    <p className="text-xs text-gray-500 mt-1">Add conditions to filter when this trigger fires</p>
                  </div>

                  {/* Template & Channel */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                      <select
                        value={formData.template}
                        onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">Select template...</option>
                        {templates?.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
                      <select
                        value={formData.channel}
                        onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value as any }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="EMAIL">Email</option>
                        <option value="SMS">SMS</option>
                        <option value="PUSH">Push</option>
                        <option value="IN_APP">In-App</option>
                      </select>
                    </div>
                  </div>

                  {/* Recipients */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
                    <div className="grid grid-cols-2 gap-2">
                      {RECIPIENT_TYPES.map(rt => (
                        <label key={rt.value} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.recipients.includes(rt.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  recipients: [...prev.recipients, rt.value],
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  recipients: prev.recipients.filter(r => r !== rt.value),
                                }));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">{rt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Delay & Retry */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Delay (seconds)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.delay}
                        onChange={(e) => setFormData(prev => ({ ...prev, delay: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Retry Count</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={formData.retryCount}
                        onChange={(e) => setFormData(prev => ({ ...prev, retryCount: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                        placeholder="3"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={handleSave}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Save Trigger
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setSelectedTrigger(null);
                        resetForm();
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-600 text-lg mb-4">Select a trigger or create a new one</p>
                <button
                  onClick={() => {
                    setIsCreating(true);
                    resetForm();
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  Create New Trigger
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">How Event Triggers Work</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>✓ System events automatically trigger configured notifications</li>
            <li>✓ Conditions allow filtering (e.g., only for high-value bookings)</li>
            <li>✓ Delays can prevent notification fatigue</li>
            <li>✓ Retry logic ensures reliable delivery</li>
            <li>✓ Multiple recipients can be selected for each trigger</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
