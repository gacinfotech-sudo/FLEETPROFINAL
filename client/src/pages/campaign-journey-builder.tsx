import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, Plus, Play, Settings, Trash2 } from 'lucide-react';

interface JourneyStage {
  id: string;
  name: string;
  type: 'trigger' | 'wait' | 'send' | 'decision' | 'action';
  config: Record<string, any>;
  nextStageId?: string;
}

interface Journey {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused';
  stages: JourneyStage[];
  recipients: number;
  conversions: number;
  conversionRate: number;
  createdAt: Date;
}

export default function CampaignJourneyBuilder() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: journeysData } = useQuery({
    queryKey: ['campaign-journeys'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/journeys');
      if (!response.ok) throw new Error('Failed to fetch');
      return (await response.json()).journeys || [];
    },
  });

  if (journeysData) setJourneys(journeysData);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Campaign Journey Builder</h1>
          <p className="text-gray-600 mt-2">Design multi-channel customer journeys</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Journeys</h2>
              <button
                onClick={() => setIsCreating(true)}
                className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {journeys.map((journey) => (
                <div
                  key={journey.id}
                  onClick={() => { setSelectedJourney(journey); setIsCreating(false); }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedJourney?.id === journey.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{journey.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{journey.stages.length} stages</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      journey.status === 'active' ? 'bg-green-100 text-green-800' :
                      journey.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {journey.status}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs">
                    <span className="text-gray-600">{journey.recipients.toLocaleString()} recipients</span>
                    <span className="text-green-600 font-semibold">{(journey.conversionRate * 100).toFixed(1)}% conversion</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            {isCreating ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-6">Create Journey</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Journey name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 mb-3">Journey Stages</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">1</div>
                        <span className="text-gray-700">Trigger Event</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>
                        <span className="text-gray-700">Wait (optional delay)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>
                        <span className="text-gray-700">Send Notification</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">4</div>
                        <span className="text-gray-700">Decision (branch)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">5</div>
                        <span className="text-gray-700">Action (CRM sync)</span>
                      </div>
                    </div>
                  </div>
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                    Create Journey
                  </button>
                </div>
              </div>
            ) : selectedJourney ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedJourney.name}</h2>
                    <p className="text-gray-600 text-sm mt-1">{selectedJourney.stages.length} stages configured</p>
                  </div>
                  <div className="flex gap-2">
                    {selectedJourney.status === 'active' && (
                      <button className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 text-sm font-medium">
                        Pause
                      </button>
                    )}
                    {selectedJourney.status === 'draft' && (
                      <button className="px-3 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 text-sm font-medium flex items-center gap-1">
                        <Play size={16} /> Launch
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-xs">Recipients</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                      {selectedJourney.recipients.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-xs">Conversions</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {selectedJourney.conversions.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-xs">Conversion Rate</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">
                      {(selectedJourney.conversionRate * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Journey Map</h3>
                  <div className="space-y-3">
                    {selectedJourney.stages.map((stage, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div className="flex-1 bg-gray-50 p-3 rounded-lg">
                          <p className="font-medium text-gray-900 capitalize">{stage.type}</p>
                          <p className="text-sm text-gray-600 mt-1">{stage.name}</p>
                        </div>
                        {idx < selectedJourney.stages.length - 1 && (
                          <GitBranch size={20} className="text-gray-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <GitBranch size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">Select a journey to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
