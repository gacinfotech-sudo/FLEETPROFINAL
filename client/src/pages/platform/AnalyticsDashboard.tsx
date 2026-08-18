import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react';

interface Analytics {
  mrr: number;
  arr: number;
  arpu: { arpu: number; tenantCount: number };
  churn: { churnRate: number; active: number; churned: number };
  collectionRate: { collectionRate: number };
  ltv: { ltv: number; arpu: number; avgSubscriptionMonths: number };
  revenueByPlan: Array<any>;
  growth: Array<any>;
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<Partial<Analytics>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [mrr, arr, arpu, churn, collection, ltv, byPlan, growth] = await Promise.all([
        fetch('/api/platform/analytics/mrr').then(r => r.json()),
        fetch('/api/platform/analytics/arr').then(r => r.json()),
        fetch('/api/platform/analytics/arpu').then(r => r.json()),
        fetch('/api/platform/analytics/churn').then(r => r.json()),
        fetch('/api/platform/analytics/collection-rate').then(r => r.json()),
        fetch('/api/platform/analytics/ltv').then(r => r.json()),
        fetch('/api/platform/analytics/revenue-by-plan').then(r => r.json()),
        fetch('/api/platform/analytics/growth?months=12').then(r => r.json())
      ]);

      setAnalytics({
        mrr: mrr.mrr,
        arr: arr.arr,
        arpu,
        churn,
        collectionRate: collection,
        ltv,
        revenueByPlan: byPlan,
        growth
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading analytics...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Revenue Analytics</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* MRR */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Monthly Recurring Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{(analytics.mrr! / 100000).toFixed(1)}L
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-green-500 opacity-20" />
            </div>
          </div>

          {/* ARR */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Annual Recurring Revenue</p>
                <p className="text-2xl font-bold text-blue-600">
                  ₹{(analytics.arr! / 1000000).toFixed(2)}Cr
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-blue-500 opacity-20" />
            </div>
          </div>

          {/* ARPU */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Average Revenue Per User</p>
                <p className="text-2xl font-bold text-purple-600">
                  ₹{(analytics.arpu?.arpu! / 100).toFixed(0)}
                </p>
              </div>
              <Users className="w-12 h-12 text-purple-500 opacity-20" />
            </div>
          </div>

          {/* LTV */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Lifetime Value</p>
                <p className="text-2xl font-bold text-orange-600">
                  ₹{(analytics.ltv?.ltv! / 100000).toFixed(1)}L
                </p>
              </div>
              <Target className="w-12 h-12 text-orange-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Churn Rate */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm mb-2">30-Day Churn Rate</p>
            <div className="flex items-end justify-between">
              <p className={`text-3xl font-bold ${
                analytics.churn!.churnRate! < 5 ? 'text-green-600' :
                analytics.churn!.churnRate! < 10 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {analytics.churn?.churnRate}%
              </p>
              <div className="text-right text-sm text-gray-600">
                <p>{analytics.churn?.churned} churned</p>
                <p>{analytics.churn?.active} active</p>
              </div>
            </div>
          </div>

          {/* Collection Rate */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm mb-2">Payment Collection Rate</p>
            <p className="text-3xl font-bold text-blue-600">
              {analytics.collectionRate?.collectionRate}%
            </p>
          </div>

          {/* Active Tenants */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm mb-2">Active Tenants</p>
            <p className="text-3xl font-bold text-indigo-600">
              {analytics.arpu?.tenantCount}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tenant Growth */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tenant Growth (12 months)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.growth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id.month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="newTenants" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue by Plan */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Plan</h3>
            <div className="space-y-3">
              {analytics.revenueByPlan?.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{item.planName}</span>
                    <span className="text-sm text-gray-600">
                      {item.count} tenants • ₹{(item.totalRevenue / 100).toFixed(0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded h-2">
                    <div
                      className="bg-blue-600 h-2 rounded"
                      style={{
                        width: `${Math.max(1, (item.totalRevenue / (analytics.revenueByPlan?.reduce((sum: number, p: any) => sum + p.totalRevenue, 0) || 1)) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded">
              <p className="text-sm font-medium text-blue-900">Customer Acquisition Cost</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                ₹{analytics.arpu && analytics.ltv ?
                  Math.round(analytics.arpu.arpu * 6 / 100).toLocaleString() : '-'}
              </p>
              <p className="text-xs text-blue-700 mt-1">Assuming 6-month payback period</p>
            </div>
            <div className="p-4 bg-green-50 rounded">
              <p className="text-sm font-medium text-green-900">Revenue Efficiency</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {analytics.collectionRate ? analytics.collectionRate.collectionRate.toFixed(1) : '-'}%
              </p>
              <p className="text-xs text-green-700 mt-1">Payment collection rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
