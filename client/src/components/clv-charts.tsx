import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users } from 'lucide-react';
import { apiClient } from '../utils/api-client';

interface CLVData {
  segment: string;
  count: number;
  avgClv: number;
  totalSpending: number;
}

const COLORS = {
  vip: '#FFD700',
  loyal: '#3B82F6',
  regular: '#10B981',
  'at-risk': '#F97316',
  churned: '#EF4444'
};

export default function CLVCharts() {
  const [distribution, setDistribution] = useState<CLVData[]>([]);
  const [highValue, setHighValue] = useState<any[]>([]);
  const [atRisk, setAtRisk] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'distribution' | 'high-value' | 'at-risk'>('distribution');

  useEffect(() => {
    fetchCLVData();
  }, []);

  const fetchCLVData = async () => {
    try {
      setLoading(true);
      const [dist, hv, ar] = await Promise.all([
        apiClient.get('/analytics/customers/clv-distribution'),
        apiClient.get('/analytics/customers/high-value?limit=10'),
        apiClient.get('/analytics/customers/at-risk?limit=10'),
      ]);

      const distArray = dist.distribution
        ? Object.entries(dist.distribution).map(([key, value]: [string, any]) => ({
            segment: key,
            count: value.count,
            avgClv: value.avgClv,
            totalSpending: value.totalSpending
          }))
        : [];

      setDistribution(distArray);
      setHighValue(hv.customers || []);
      setAtRisk(ar.customers || []);
    } catch (error) {
      console.error('Failed to fetch CLV data:', error);
    } finally {
      setLoading(false);
    }
  };

  const segmentLabels: Record<string, string> = {
    vip: '💎 VIP (CLV ≥80)',
    loyal: '⭐ Loyal (CLV 50-79)',
    regular: '👤 Regular',
    'at-risk': '⚠️ At-Risk',
    churned: '❌ Churned'
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('distribution')}
          className={`px-4 py-2 font-medium ${activeTab === 'distribution' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          CLV Distribution
        </button>
        <button
          onClick={() => setActiveTab('high-value')}
          className={`px-4 py-2 font-medium ${activeTab === 'high-value' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          High-Value Customers
        </button>
        <button
          onClick={() => setActiveTab('at-risk')}
          className={`px-4 py-2 font-medium ${activeTab === 'at-risk' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          At-Risk Customers
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            {activeTab === 'distribution' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold mb-4">Customer Segment Distribution</h3>
                  {distribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={distribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ segment, count }) => `${segmentLabels[segment]} (${count})`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {distribution.map((entry) => (
                            <Cell key={`cell-${entry.segment}`} fill={COLORS[entry.segment as keyof typeof COLORS] || '#888888'} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500">No distribution data</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-4">CLV Score by Segment</h3>
                  {distribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={distribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="segment" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="avgClv" fill="#3b82f6" name="Average CLV Score" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500">No data available</p>
                  )}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  {distribution.map(seg => (
                    <div key={seg.segment} className="border rounded-lg p-4">
                      <p className="text-sm font-semibold mb-2">{segmentLabels[seg.segment]}</p>
                      <p className="text-2xl font-bold mb-1">{seg.count}</p>
                      <p className="text-xs text-gray-600">CLV Avg: {seg.avgClv}</p>
                      <p className="text-xs text-gray-600">Revenue: ₹{seg.totalSpending.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'high-value' && (
              <div>
                <h3 className="text-lg font-bold mb-4">Top VIP Customers</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {highValue.length > 0 ? (
                    highValue.map(customer => (
                      <div key={customer._id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            💎 {customer.customerName || `Customer ${customer._id.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-gray-600">
                            Bookings: {customer.bookingCount} | Spent: ₹{customer.totalSpending.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-yellow-600">{customer.clvScore}</p>
                          <p className="text-xs text-gray-500">CLV Score</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No high-value customers</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'at-risk' && (
              <div>
                <h3 className="text-lg font-bold mb-4">Customers at Risk of Churning</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {atRisk.length > 0 ? (
                    atRisk.map(customer => (
                      <div key={customer._id} className="flex items-center justify-between p-3 border rounded-lg border-orange-200 bg-orange-50 hover:bg-orange-100">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            ⚠️ {customer.customerName || `Customer ${customer._id.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-gray-600">
                            Last Booking: {customer.daysSinceLastBooking} days ago | Churn Risk: {customer.churnRisk}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${customer.churnRisk > 75 ? 'text-red-600' : 'text-orange-600'}`}>
                            {customer.churnRisk}%
                          </p>
                          <p className="text-xs text-gray-500">Risk Level</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No at-risk customers</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
