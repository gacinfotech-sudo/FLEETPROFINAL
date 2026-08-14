import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Zap, TrendingUp, AlertCircle } from 'lucide-react';

interface CampaignPrediction {
  campaignId: string;
  campaignName: string;
  predictedMetrics: { sent: number; delivered: number; opened: number; clicked: number; conversions: number };
  predictedRates: { deliveryRate: number; openRate: number; clickRate: number; conversionRate: number };
  confidence: number;
  riskFactors: string[];
  recommendations: string[];
}

export default function CampaignPredictor() {
  const [campaigns, setCampaigns] = useState<CampaignPrediction[]>([]);

  const { data: predictions } = useQuery({
    queryKey: ['campaign-predictions'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/campaign-predictions');
      if (!response.ok) throw new Error('Failed to fetch');
      return (await response.json()).predictions || [];
    },
  });

  if (predictions) setCampaigns(predictions);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Campaign Performance Predictor</h1>
          <p className="text-gray-600 mt-2">Forecast campaign metrics before launch</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
        {campaigns.map((campaign) => (
          <div key={campaign.campaignId} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{campaign.campaignName}</h2>
                <p className="text-gray-600 text-sm mt-1">Campaign ID: {campaign.campaignId.slice(0, 8)}</p>
              </div>
              <div className={`text-sm font-bold px-3 py-1 rounded-full ${
                campaign.confidence >= 0.9 ? 'bg-green-100 text-green-800' :
                campaign.confidence >= 0.75 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {(campaign.confidence * 100).toFixed(0)}% confidence
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-gray-600 text-xs">Predicted Sent</p>
                <p className="text-2xl font-bold text-blue-600 mt-2">
                  {(campaign.predictedMetrics.sent / 1000).toFixed(1)}K
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-gray-600 text-xs">Delivery Rate</p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  {(campaign.predictedRates.deliveryRate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-gray-600 text-xs">Open Rate</p>
                <p className="text-2xl font-bold text-purple-600 mt-2">
                  {(campaign.predictedRates.openRate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-gray-600 text-xs">Click Rate</p>
                <p className="text-2xl font-bold text-orange-600 mt-2">
                  {(campaign.predictedRates.clickRate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-gray-600 text-xs">Conversions</p>
                <p className="text-2xl font-bold text-indigo-600 mt-2">
                  {campaign.predictedMetrics.conversions}
                </p>
              </div>
            </div>

            {campaign.riskFactors.length > 0 && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-red-600 mt-1" size={20} />
                  <div>
                    <p className="font-medium text-red-900 mb-2">Risk Factors</p>
                    <ul className="text-sm text-red-800 space-y-1">
                      {campaign.riskFactors.map((risk, idx) => (
                        <li key={idx}>• {risk}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {campaign.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Zap className="text-blue-600 mt-1" size={20} />
                  <div>
                    <p className="font-medium text-blue-900 mb-2">Recommendations to Improve Performance</p>
                    <ul className="text-sm text-blue-800 space-y-1">
                      {campaign.recommendations.map((rec, idx) => (
                        <li key={idx}>✓ {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
