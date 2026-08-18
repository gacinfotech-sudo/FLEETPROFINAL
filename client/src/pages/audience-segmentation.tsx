import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, Filter, BarChart3, Plus, Edit2, Trash2 } from 'lucide-react';

interface Segment {
  id: string;
  name: string;
  description: string;
  rules: SegmentRule[];
  userCount: number;
  engagementMetrics: { openRate: number; clickRate: number; conversionRate: number };
  createdAt: Date;
}

interface SegmentRule {
  field: string;
  operator: string;
  value: string;
  logic?: 'AND' | 'OR';
}

export default function AudienceSegmentation() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', rules: [] as SegmentRule[] });

  const { data: segmentsData } = useQuery({
    queryKey: ['audience-segments'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/segments');
      if (!response.ok) throw new Error('Failed to fetch');
      return (await response.json()).segments || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch('/api/notifications/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to create');
      return response.json();
    },
  });

  if (segmentsData) setSegments(segmentsData);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Audience Segmentation</h1>
          <p className="text-gray-600 mt-2">Create and manage audience segments with ML-powered classification</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Segments</h2>
              <button
                onClick={() => setIsCreating(true)}
                className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  onClick={() => { setSelectedSegment(seg); setIsCreating(false); }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedSegment?.id === seg.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <h3 className="font-medium text-gray-900">{seg.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{seg.userCount.toLocaleString()} users</p>
                  <p className="text-xs text-blue-600 mt-1">{(seg.engagementMetrics.openRate * 100).toFixed(1)}% open rate</p>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            {isCreating ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-6">Create Segment</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Segment name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                  <textarea
                    placeholder="Description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    onClick={() => createMutation.mutateAsync(formData)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Create Segment
                  </button>
                </div>
              </div>
            ) : selectedSegment ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedSegment.name}</h2>
                    <p className="text-gray-600 mt-2">{selectedSegment.description}</p>
                  </div>
                  <button className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={20} /></button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-xs">Users</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{selectedSegment.userCount.toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-xs">Open Rate</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {(selectedSegment.engagementMetrics.openRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-xs">Conversion</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">
                      {(selectedSegment.engagementMetrics.conversionRate * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Segmentation Rules</h3>
                  <div className="space-y-2">
                    {selectedSegment.rules.map((rule, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
                        <span className="font-medium">{rule.field}</span> {rule.operator} {rule.value}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Users size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">Select a segment to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
