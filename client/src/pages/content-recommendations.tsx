import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, ThumbsUp, TrendingUp, Zap, Target } from 'lucide-react';

interface ContentRecommendation {
  id: string;
  type: 'subject_line' | 'body_text' | 'cta' | 'send_time' | 'channel';
  title: string;
  description: string;
  variants: { text: string; expectedLift: number }[];
  confidence: number;
  impactScore: number;
  reasoning: string;
}

export default function ContentRecommendations() {
  const [filters, setFilters] = useState({ contentType: 'all', segment: 'all' });

  const { data: recommendations } = useQuery({
    queryKey: ['content-recommendations', filters],
    queryFn: async () => {
      const response = await fetch(
        `/api/notifications/content-recommendations?type=${filters.contentType}&segment=${filters.segment}`
      );
      if (!response.ok) throw new Error('Failed to fetch');
      return (await response.json()).recommendations || [];
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Content Recommendations</h1>
          <p className="text-gray-600 mt-2">AI-powered suggestions to optimize engagement</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-8 flex gap-4">
          <select
            value={filters.contentType}
            onChange={(e) => setFilters(prev => ({ ...prev, contentType: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Types</option>
            <option value="subject_line">Subject Lines</option>
            <option value="body_text">Body Text</option>
            <option value="cta">Call-to-Action</option>
          </select>

          <select
            value={filters.segment}
            onChange={(e) => setFilters(prev => ({ ...prev, segment: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Segments</option>
            <option value="high-value">High Value</option>
            <option value="new">New Users</option>
          </select>
        </div>

        <div className="space-y-6">
          {recommendations?.map((rec: ContentRecommendation) => (
            <div key={rec.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <Brain className="text-purple-600 mt-1" size={24} />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{rec.title}</h2>
                    <p className="text-gray-600 text-sm mt-1">{rec.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">+{(rec.impactScore * 100).toFixed(0)}%</div>
                  <p className="text-xs text-gray-500 mt-1">{(rec.confidence * 100).toFixed(0)}% confidence</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm font-medium text-gray-900 mb-3">Recommended Variants</p>
                <div className="space-y-2">
                  {rec.variants.map((v, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <p className="text-sm text-gray-700">"{v.text}"</p>
                      <span className="text-sm font-semibold text-green-600">+{(v.expectedLift * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-900">Why This Works</p>
                <p className="text-sm text-blue-800 mt-2">{rec.reasoning}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
