import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BarChart3, Play, Pause, Trash2, Plus, TrendingUp } from 'lucide-react';

interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'completed' | 'paused';
  variants: Variant[];
  startDate: Date;
  endDate?: Date;
  sampleSize: number;
  audience: string;
  metrics: Metrics;
  confidenceLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Variant {
  id: string;
  name: string;
  templateId: string;
  channel: string;
  description: string;
  allocation: number; // percentage
  metrics?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    conversions: number;
  };
}

interface Metrics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalConversions: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  winner?: string;
}

export default function NotificationABTesting() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    audience: '',
    sampleSize: 1000,
    confidenceLevel: 95,
    variants: [
      { name: 'Variant A', templateId: '', channel: 'EMAIL', description: '', allocation: 50 },
      { name: 'Variant B', templateId: '', channel: 'EMAIL', description: '', allocation: 50 },
    ],
  });

  const { data: testsData } = useQuery({
    queryKey: ['ab-tests'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/ab-tests');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.tests || [];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['templates-for-ab'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/templates');
      if (!response.ok) return [];
      const data = await response.json();
      return data.templates || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch('/api/notifications/ab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to create');
      return response.json();
    },
  });

  const startMutation = useMutation({
    mutationFn: async (testId: string) => {
      const response = await fetch(`/api/notifications/ab-tests/${testId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to start');
      return response.json();
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (testId: string) => {
      const response = await fetch(`/api/notifications/ab-tests/${testId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to stop');
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (testId: string) => {
      const response = await fetch(`/api/notifications/ab-tests/${testId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      return response.json();
    },
  });

  if (testsData) {
    setTests(testsData);
  }

  const handleCreateTest = async () => {
    const totalAllocation = formData.variants.reduce((sum, v) => sum + v.allocation, 0);
    if (totalAllocation !== 100) {
      alert('Variant allocations must sum to 100%');
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description,
      audience: formData.audience,
      sampleSize: formData.sampleSize,
      confidenceLevel: formData.confidenceLevel,
      variants: formData.variants,
    };

    await createMutation.mutateAsync(payload);
    setIsCreating(false);
    resetForm();
  };

  const handleStartTest = async (testId: string) => {
    await startMutation.mutateAsync(testId);
  };

  const handleStopTest = async (testId: string) => {
    await stopMutation.mutateAsync(testId);
  };

  const handleDelete = async (testId: string) => {
    if (confirm('Delete this test?')) {
      await deleteMutation.mutateAsync(testId);
      if (selectedTest?.id === testId) {
        setSelectedTest(null);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      audience: '',
      sampleSize: 1000,
      confidenceLevel: 95,
      variants: [
        { name: 'Variant A', templateId: '', channel: 'EMAIL', description: '', allocation: 50 },
        { name: 'Variant B', templateId: '', channel: 'EMAIL', description: '', allocation: 50 },
      ],
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateSignificance = (test: ABTest) => {
    if (!test.variants || test.variants.length < 2) return 0;
    const v1 = test.variants[0].metrics || { opened: 0, sent: 1 };
    const v2 = test.variants[1].metrics || { opened: 0, sent: 1 };
    const r1 = v1.opened / v1.sent;
    const r2 = v2.opened / v2.sent;
    return Math.abs((r2 - r1) / ((r1 * (1 - r1) / v1.sent) + (r2 * (1 - r2) / v2.sent)) ** 0.5);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">A/B Testing</h1>
          <p className="text-gray-600 mt-2">Test notification variants and measure performance</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Tests List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Tests</h2>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setSelectedTest(null);
                  resetForm();
                }}
                className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {tests.map((test) => (
                <div
                  key={test.id}
                  onClick={() => {
                    setSelectedTest(test);
                    setIsCreating(false);
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                    selectedTest?.id === test.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <h3 className="font-medium text-gray-900">{test.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {test.variants?.length || 0} variants
                  </p>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(test.status)}`}>
                      {test.status}
                    </span>
                    {test.metrics?.winner && (
                      <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                        <TrendingUp size={14} />
                        {test.metrics.winner}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="col-span-2">
            {isCreating ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-6">Create New Test</h2>

                <div className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Test Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="e.g., Subject Line Test"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="What are you testing?"
                    />
                  </div>

                  {/* Test Config */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Audience</label>
                      <select
                        value={formData.audience}
                        onChange={(e) => setFormData(prev => ({ ...prev, audience: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">Select audience...</option>
                        <option value="all_customers">All Customers</option>
                        <option value="new_customers">New Customers</option>
                        <option value="high_value">High Value</option>
                        <option value="inactive">Inactive Users</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sample Size</label>
                      <input
                        type="number"
                        min="100"
                        value={formData.sampleSize}
                        onChange={(e) => setFormData(prev => ({ ...prev, sampleSize: parseInt(e.target.value) }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confidence Level</label>
                      <select
                        value={formData.confidenceLevel}
                        onChange={(e) => setFormData(prev => ({ ...prev, confidenceLevel: parseInt(e.target.value) }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      >
                        <option value={90}>90%</option>
                        <option value={95}>95% (Standard)</option>
                        <option value={99}>99%</option>
                      </select>
                    </div>
                  </div>

                  {/* Variants */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Variants</h3>
                    <div className="space-y-4">
                      {formData.variants.map((variant, idx) => (
                        <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <input
                              type="text"
                              value={variant.name}
                              onChange={(e) => {
                                const newVariants = [...formData.variants];
                                newVariants[idx].name = e.target.value;
                                setFormData(prev => ({ ...prev, variants: newVariants }));
                              }}
                              className="px-3 py-2 border border-gray-300 rounded text-sm"
                              placeholder="Variant name"
                            />
                            <select
                              value={variant.templateId}
                              onChange={(e) => {
                                const newVariants = [...formData.variants];
                                newVariants[idx].templateId = e.target.value;
                                setFormData(prev => ({ ...prev, variants: newVariants }));
                              }}
                              className="px-3 py-2 border border-gray-300 rounded text-sm"
                            >
                              <option value="">Select template...</option>
                              {templates?.map((t: any) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={variant.allocation}
                                onChange={(e) => {
                                  const newVariants = [...formData.variants];
                                  newVariants[idx].allocation = parseInt(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                className="w-16 px-3 py-2 border border-gray-300 rounded text-sm"
                              />
                              <span className="text-sm text-gray-600">%</span>
                            </div>
                          </div>
                          <textarea
                            value={variant.description}
                            onChange={(e) => {
                              const newVariants = [...formData.variants];
                              newVariants[idx].description = e.target.value;
                              setFormData(prev => ({ ...prev, variants: newVariants }));
                            }}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                            placeholder="What's different about this variant?"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={handleCreateTest}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Create Test
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        resetForm();
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedTest ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedTest.name}</h2>
                    <p className="text-gray-600 text-sm mt-1">{selectedTest.description}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(selectedTest.id)}
                    className="text-red-600 hover:bg-red-50 p-2 rounded"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                {/* Test Controls */}
                <div className="mb-6 pb-6 border-b">
                  <div className="flex gap-3">
                    {selectedTest.status === 'draft' && (
                      <button
                        onClick={() => handleStartTest(selectedTest.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <Play size={18} />
                        Start Test
                      </button>
                    )}
                    {selectedTest.status === 'running' && (
                      <button
                        onClick={() => handleStopTest(selectedTest.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                      >
                        <Pause size={18} />
                        Stop Test
                      </button>
                    )}
                    <span className={`px-3 py-2 rounded text-sm font-medium ${getStatusColor(selectedTest.status)}`}>
                      {selectedTest.status}
                    </span>
                  </div>
                </div>

                {/* Variants Performance */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Variant Performance</h3>
                  {selectedTest.variants?.map((variant, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{variant.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{variant.description}</p>
                        </div>
                        <span className="text-sm font-semibold text-blue-600">{variant.allocation}%</span>
                      </div>
                      {variant.metrics && (
                        <div className="grid grid-cols-5 gap-2 text-sm">
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Sent</p>
                            <p className="font-bold text-gray-900">{variant.metrics.sent}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Delivered</p>
                            <p className="font-bold text-gray-900">{variant.metrics.delivered}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Opened</p>
                            <p className="font-bold text-gray-900">{variant.metrics.opened}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Clicked</p>
                            <p className="font-bold text-gray-900">{variant.metrics.clicked}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Conversions</p>
                            <p className="font-bold text-gray-900">{variant.metrics.conversions}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Test Summary */}
                {selectedTest.metrics && (
                  <div className="mt-6 grid grid-cols-4 gap-4 pt-6 border-t">
                    <div className="text-center">
                      <p className="text-gray-500 text-xs">Overall Open Rate</p>
                      <p className="text-2xl font-bold text-gray-900">{(selectedTest.metrics.openRate * 100).toFixed(1)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 text-xs">Overall Click Rate</p>
                      <p className="text-2xl font-bold text-gray-900">{(selectedTest.metrics.clickRate * 100).toFixed(1)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 text-xs">Conversion Rate</p>
                      <p className="text-2xl font-bold text-gray-900">{(selectedTest.metrics.conversionRate * 100).toFixed(1)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 text-xs">Total Sent</p>
                      <p className="text-2xl font-bold text-gray-900">{selectedTest.metrics.totalSent}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg mb-4">Select a test or create a new one</p>
                <button
                  onClick={() => {
                    setIsCreating(true);
                    resetForm();
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  Create New Test
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
