import React, { useState } from "react";
import {
  useAnalyzePricing,
  useGetMarketPositioning,
  useGetCompetitorProfiles,
  useGetCompetitiveAnalytics,
  useGetMarketSegments,
} from "../../hooks/useCompetitiveIntelligence";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const CompetitiveIntelligenceDashboard: React.FC = () => {
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const { data: positioning, isLoading: positioningLoading } = useGetMarketPositioning();
  const { data: profiles = [], isLoading: profilesLoading } = useGetCompetitorProfiles();
  const { data: analytics, isLoading: analyticsLoading } = useGetCompetitiveAnalytics();
  const { data: segments = [], isLoading: segmentsLoading } = useGetMarketSegments();
  const analyzePricing = useAnalyzePricing();

  if (positioningLoading || profilesLoading || analyticsLoading || segmentsLoading) {
    return <LoadingSpinner />;
  }

  const handleAnalyzePricing = () => {
    analyzePricing.mutate();
  };

  const selectedCompetitorData = selectedCompetitor
    ? profiles.find((p: any) => p.competitorId === selectedCompetitor)
    : profiles[0];

  const getTypeColor = (type: string): string => {
    switch (type) {
      case "direct":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "indirect":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "emerging":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Competitive Intelligence
        </h1>
        <button
          onClick={handleAnalyzePricing}
          disabled={analyzePricing.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {analyzePricing.isPending ? "Analyzing..." : "Analyze Pricing"}
        </button>
      </div>

      {/* Market Analytics */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Competitors</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {analytics.totalCompetitors}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {analytics.directCompetitors} direct
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Our Share</div>
            <div className="text-3xl font-bold text-green-600">
              {analytics.ourMarketShare}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Rank: #2
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Top 3 Share</div>
            <div className="text-3xl font-bold text-blue-600">
              {analytics.topThreeCombined}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Market concentration
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Competition</div>
            <div className="text-3xl font-bold text-orange-600">
              {analytics.competitorActivityLevel}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Activity level
            </div>
          </div>
        </div>
      )}

      {/* Market Positioning */}
      {positioning && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Our Market Position
            </h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm font-medium">
              {positioning.overallPosition.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {Object.entries(positioning.scorecard).map(([key, value]: [string, any]) => (
              <div key={key} className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              vs {positioning.comparisonVsTopCompetitor.competitor}
            </h4>
            <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <div>
                Market Gap: {positioning.comparisonVsTopCompetitor.marketShareGap.toFixed(1)}
                pp
              </div>
              <div>
                Price: {positioning.comparisonVsTopCompetitor.pricePositioning}
              </div>
              <div>Quality: {positioning.comparisonVsTopCompetitor.qualityGap}</div>
            </div>
          </div>
        </div>
      )}

      {/* Competitor Profiles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Competitors</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {profiles.map((comp: any) => (
                <div
                  key={comp.competitorId}
                  onClick={() => setSelectedCompetitor(comp.competitorId)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                    selectedCompetitor === comp.competitorId
                      ? "bg-blue-50 dark:bg-blue-900"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {comp.name}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(comp.type)}`}>
                      {comp.type.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Share:</span>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {comp.marketShare}%
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Rating:</span>
                      <div className="font-semibold text-yellow-600">
                        {comp.customerRating}★
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Vehicles:</span>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {comp.activeVehicles.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Competitor Details */}
        {selectedCompetitorData && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">
              {selectedCompetitorData.name}
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Market Share:</span>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {selectedCompetitorData.marketShare}%
                </div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Price Range:</span>
                <div className="font-semibold text-gray-900 dark:text-white">
                  ₹{selectedCompetitorData.priceRange.min} - ₹
                  {selectedCompetitorData.priceRange.max}
                </div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Strengths:</span>
                <ul className="text-xs mt-1 space-y-1">
                  {selectedCompetitorData.strengths.map((s: string, i: number) => (
                    <li key={i} className="text-gray-700 dark:text-gray-300">
                      ✓ {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Weaknesses:</span>
                <ul className="text-xs mt-1 space-y-1">
                  {selectedCompetitorData.weaknesses.map((w: string, i: number) => (
                    <li key={i} className="text-gray-700 dark:text-gray-300">
                      ✗ {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Market Segments */}
      {segments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Market Segments
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
            {segments.map((seg: any) => (
              <div
                key={seg.segment}
                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white capitalize mb-2">
                  {seg.segment}
                </h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Market:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {seg.totalMarket} rides/day
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Our Share:</span>
                    <span className="font-semibold text-green-600">
                      {seg.ourMarketShare}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Growth:</span>
                    <span className="font-semibold text-blue-600">
                      {seg.growthRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Margin:</span>
                    <span className="font-semibold text-purple-600">
                      {seg.profitability}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
