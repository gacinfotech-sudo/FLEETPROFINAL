import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Zap } from 'lucide-react';
import { apiClient } from '../utils/api-client';

interface DriverMetrics {
  _id: string;
  driverId: string;
  bookingCount: number;
  completedCount: number;
  averageRating: number;
  onTimePercentage: number;
  revenueGenerated: number;
  performanceScore: number;
  lastUpdated: Date;
}

export default function DriverLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<DriverMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'performance' | 'revenue' | 'rating'>('performance');

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/analytics/drivers/leaderboard');
      setLeaderboard(response.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const sorted = [...leaderboard].sort((a, b) => {
    if (sortBy === 'performance') return b.performanceScore - a.performanceScore;
    if (sortBy === 'revenue') return b.revenueGenerated - a.revenueGenerated;
    if (sortBy === 'rating') return b.averageRating - a.averageRating;
    return 0;
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="text-yellow-500" size={28} />
          <h2 className="text-2xl font-bold">Driver Leaderboard</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('performance')}
            className={`px-3 py-1 rounded text-sm font-medium ${sortBy === 'performance' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Performance
          </button>
          <button
            onClick={() => setSortBy('revenue')}
            className={`px-3 py-1 rounded text-sm font-medium ${sortBy === 'revenue' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Revenue
          </button>
          <button
            onClick={() => setSortBy('rating')}
            className={`px-3 py-1 rounded text-sm font-medium ${sortBy === 'rating' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Rating
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading leaderboard...</div>
      ) : sorted.length > 0 ? (
        <div className="space-y-3">
          {sorted.map((driver, index) => (
            <div
              key={driver._id}
              className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 border transition"
            >
              {/* Rank */}
              <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-white"
                style={{
                  backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#6B7280'
                }}>
                {index + 1}
              </div>

              {/* Driver Info */}
              <div className="flex-1">
                <p className="font-semibold">Driver {driver.driverId.slice(0, 8)}</p>
                <p className="text-sm text-gray-600">{driver.completedCount} completed trips</p>
              </div>

              {/* Metrics */}
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-xs text-gray-600">Performance</p>
                  <p className="text-lg font-bold text-blue-600">{driver.performanceScore}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Rating</p>
                  <p className="text-lg font-bold text-yellow-500">
                    {driver.averageRating.toFixed(1)} ⭐
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Revenue</p>
                  <p className="text-lg font-bold text-green-600">₹{driver.revenueGenerated.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">On-Time</p>
                  <p className="text-lg font-bold">{driver.onTimePercentage}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">No driver metrics available</div>
      )}
    </div>
  );
}
