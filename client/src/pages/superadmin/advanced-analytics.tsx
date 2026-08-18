import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Download, Filter, Settings, TrendingUp, Users, Calendar, Target, AlertCircle, Eye } from 'lucide-react';

interface AnalyticsTab {
  id: string;
  label: string;
  icon: JSX.Element;
}

interface CohortData {
  cohort: string;
  m0: number;
  m1: number;
  m2: number;
  m3: number;
  m4: number;
  m5: number;
  m6: number;
}

interface FunnelStep {
  step: string;
  users: number;
  dropoff: number;
  conversionRate: number;
}

interface RetentionCohort {
  name: string;
  cohort: string;
  day7: number;
  day30: number;
  day90: number;
  day180: number;
  churnRisk: string;
}

interface ChurnPrediction {
  tenantId: string;
  tenantName: string;
  riskScore: number;
  riskLevel: string;
  churnProbability: number;
  reasons: string[];
  lastActivity: string;
}

interface MetricData {
  month: string;
  projected: number;
  actual: number;
}

export default function AdvancedAnalytics() {
  const [activeTab, setActiveTab] = useState('cohort');
  const [dateRange, setDateRange] = useState('90d');
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null);
  const [showPredictive, setShowPredictive] = useState(false);

  // Cohort retention data
  const cohortData: CohortData[] = [
    { cohort: '2026-05', m0: 100, m1: 85, m2: 72, m3: 68, m4: 65, m5: 62, m6: 60 },
    { cohort: '2026-06', m0: 100, m1: 88, m2: 78, m3: 75, m4: 72, m5: 70, m6: null },
    { cohort: '2026-07', m0: 100, m1: 92, m2: 82, m3: 80, m4: 78, m5: null, m6: null },
    { cohort: '2026-08', m0: 100, m1: 90, m2: 85, m3: null, m4: null, m5: null, m6: null },
  ];

  // Funnel data
  const funnelData: FunnelStep[] = [
    { step: 'Page View', users: 10000, dropoff: 0, conversionRate: 100 },
    { step: 'Sign Up', users: 7500, dropoff: 2500, conversionRate: 75 },
    { step: 'Activate Subscription', users: 5625, dropoff: 1875, conversionRate: 75 },
    { step: 'First API Call', users: 4500, dropoff: 1125, conversionRate: 80 },
    { step: 'Become Paying Customer', users: 2700, dropoff: 1800, conversionRate: 60 },
  ];

  // Retention curves
  const retentionCohorts: RetentionCohort[] = [
    { name: 'Cohort May 2026', cohort: '2026-05', day7: 85, day30: 72, day90: 68, day180: 60, churnRisk: 'Low' },
    { name: 'Cohort June 2026', cohort: '2026-06', day7: 88, day30: 78, day90: 75, day180: null, churnRisk: 'Low' },
    { name: 'Cohort July 2026', cohort: '2026-07', day7: 92, day30: 82, day90: 80, day180: null, churnRisk: 'Very Low' },
    { name: 'Cohort Aug 2026', cohort: '2026-08', day7: 90, day30: 85, day90: null, day180: null, churnRisk: 'Low' },
  ];

  // Churn predictions
  const churnPredictions: ChurnPrediction[] = [
    { tenantId: 'tenant_001', tenantName: 'Acme Corp', riskScore: 8.5, riskLevel: 'Critical', churnProbability: 75, reasons: ['30 days no API calls', 'Support tickets 5x increase', 'Payment method expired'], lastActivity: '15 days ago' },
    { tenantId: 'tenant_002', tenantName: 'TechStart Inc', riskScore: 6.2, riskLevel: 'High', churnProbability: 58, reasons: ['Reduced API usage 40%', 'No feature adoption', 'Support tickets increased'], lastActivity: '8 days ago' },
    { tenantId: 'tenant_003', tenantName: 'Global Solutions', riskScore: 4.1, riskLevel: 'Medium', churnProbability: 35, reasons: ['Usage plateau', 'Competitor activity detected'], lastActivity: '3 days ago' },
    { tenantId: 'tenant_004', tenantName: 'Digital Pro', riskScore: 2.1, riskLevel: 'Low', churnProbability: 15, reasons: ['Seasonal pattern detected'], lastActivity: '1 day ago' },
  ];

  // LTV data
  const ltvCurveData = [
    { month: 'Month 1', ltv: 50 },
    { month: 'Month 3', ltv: 180 },
    { month: 'Month 6', ltv: 420 },
    { month: 'Month 9', ltv: 750 },
    { month: 'Month 12', ltv: 1200 },
    { month: 'Month 18', ltv: 1800 },
    { month: 'Month 24', ltv: 2400 },
  ];

  // Feature adoption
  const featureAdoptionData = [
    { feature: 'API Integration', adoption: 92 },
    { feature: 'Webhooks', adoption: 78 },
    { feature: 'Analytics Dashboard', adoption: 85 },
    { feature: 'Custom Reporting', adoption: 62 },
    { feature: 'Advanced Auth', adoption: 54 },
    { feature: 'White Label', adoption: 38 },
    { feature: 'Compliance Audit', adoption: 45 },
  ];

  // Revenue forecast
  const forecastData: MetricData[] = [
    { month: 'May', actual: 45000, projected: 45000 },
    { month: 'June', actual: 52000, projected: 52000 },
    { month: 'July', actual: 58000, projected: 58000 },
    { month: 'Aug', actual: 62000, projected: 62000 },
    { month: 'Sept', actual: null, projected: 68000 },
    { month: 'Oct', actual: null, projected: 75000 },
    { month: 'Nov', actual: null, projected: 82000 },
  ];

  // CAC & LTV Payback
  const paybackData = [
    { tenant: 'Acme Corp', cac: 2500, ltv: 24000, paybackMonths: 3.1, roi: 860 },
    { tenant: 'TechStart', cac: 1800, ltv: 15000, paybackMonths: 4.5, roi: 733 },
    { tenant: 'Global Sol', cac: 3200, ltv: 28000, paybackMonths: 3.8, roi: 775 },
    { tenant: 'Digital Pro', cac: 1500, ltv: 12000, paybackMonths: 4.2, roi: 700 },
  ];

  const tabs: AnalyticsTab[] = [
    { id: 'cohort', label: 'Cohort Analysis', icon: <Users size={18} /> },
    { id: 'funnel', label: 'Funnel Analytics', icon: <TrendingUp size={18} /> },
    { id: 'retention', label: 'Retention Curves', icon: <Target size={18} /> },
    { id: 'churn', label: 'Churn Prediction', icon: <AlertCircle size={18} /> },
    { id: 'ltv', label: 'LTV & CAC', icon: <TrendingUp size={18} /> },
    { id: 'forecast', label: 'Forecasting', icon: <Calendar size={18} /> },
  ];

  const handleExport = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const data = {
      tab: activeTab,
      dateRange,
      timestamp,
      cohortData: activeTab === 'cohort' ? cohortData : null,
      funnelData: activeTab === 'funnel' ? funnelData : null,
      churnPredictions: activeTab === 'churn' ? churnPredictions : null,
    };
    const csv = JSON.stringify(data, null, 2);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${activeTab}-${timestamp}.csv`;
    a.click();
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Advanced Analytics Engine</h1>
          <p className="text-gray-600">Cohort analysis, funnel tracking, churn prediction & forecasting</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="6m">Last 6 months</option>
              <option value="1y">Last year</option>
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPredictive}
                onChange={(e) => setShowPredictive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Show Predictions</span>
            </label>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download size={18} />
            Export Report
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Cohort Analysis */}
        {activeTab === 'cohort' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Cohort Retention (%)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-4 font-semibold">Cohort</th>
                      <th className="text-center py-2 px-4">Month 0</th>
                      <th className="text-center py-2 px-4">Month 1</th>
                      <th className="text-center py-2 px-4">Month 2</th>
                      <th className="text-center py-2 px-4">Month 3</th>
                      <th className="text-center py-2 px-4">Month 4</th>
                      <th className="text-center py-2 px-4">Month 5</th>
                      <th className="text-center py-2 px-4">Month 6</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohortData.map((row) => (
                      <tr key={row.cohort} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{row.cohort}</td>
                        <td className="text-center py-3 px-4 bg-green-50">{row.m0}%</td>
                        <td className="text-center py-3 px-4 bg-blue-50">{row.m1}%</td>
                        <td className="text-center py-3 px-4 bg-blue-50">{row.m2}%</td>
                        <td className="text-center py-3 px-4 bg-blue-50">{row.m3}%</td>
                        <td className="text-center py-3 px-4 bg-blue-50">{row.m4}%</td>
                        <td className="text-center py-3 px-4 bg-blue-100">{row.m5}%</td>
                        <td className="text-center py-3 px-4 bg-blue-100">{row.m6 ? `${row.m6}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-600 mt-4">📊 Cohort trend: Newer cohorts show better retention (92% vs 85% in Month 1)</p>
            </div>
          </div>
        )}

        {/* Funnel Analysis */}
        {activeTab === 'funnel' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Conversion Funnel</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="step" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="users" fill="#3B82F6" name="Users" />
                  <Bar dataKey="dropoff" fill="#EF4444" name="Dropoff" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {funnelData.map((step, idx) => (
                <div key={step.step} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{step.step}</h3>
                    <span className="text-2xl font-bold text-blue-600">{step.conversionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${step.conversionRate}%` }}></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{step.users.toLocaleString()} users | {step.dropoff} dropoff</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Retention Curves */}
        {activeTab === 'retention' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Retention Curves by Cohort</h2>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={retentionCohorts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="day7" stroke="#10B981" name="Day 7" strokeWidth={2} />
                  <Line type="monotone" dataKey="day30" stroke="#3B82F6" name="Day 30" strokeWidth={2} />
                  <Line type="monotone" dataKey="day90" stroke="#F59E0B" name="Day 90" strokeWidth={2} />
                  <Line type="monotone" dataKey="day180" stroke="#8B5CF6" name="Day 180" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {retentionCohorts.map((cohort) => (
                <div key={cohort.cohort} className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900">{cohort.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      cohort.churnRisk === 'Low' ? 'bg-green-100 text-green-800' :
                      cohort.churnRisk === 'Very Low' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {cohort.churnRisk} Risk
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span>Day 7:</span> <strong>{cohort.day7}%</strong></div>
                    <div className="flex justify-between text-sm"><span>Day 30:</span> <strong>{cohort.day30}%</strong></div>
                    <div className="flex justify-between text-sm"><span>Day 90:</span> <strong>{cohort.day90}%</strong></div>
                    {cohort.day180 && <div className="flex justify-between text-sm"><span>Day 180:</span> <strong>{cohort.day180}%</strong></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Churn Prediction */}
        {activeTab === 'churn' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Churn Risk Prediction (ML-Based)</h2>
              <div className="space-y-4">
                {churnPredictions.map((prediction) => (
                  <div
                    key={prediction.tenantId}
                    className={`p-4 rounded-lg border-2 ${
                      prediction.riskLevel === 'Critical' ? 'border-red-300 bg-red-50' :
                      prediction.riskLevel === 'High' ? 'border-orange-300 bg-orange-50' :
                      prediction.riskLevel === 'Medium' ? 'border-yellow-300 bg-yellow-50' :
                      'border-green-300 bg-green-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{prediction.tenantName}</h3>
                        <p className="text-xs text-gray-600">Last activity: {prediction.lastActivity}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                          prediction.riskLevel === 'Critical' ? 'bg-red-200 text-red-900' :
                          prediction.riskLevel === 'High' ? 'bg-orange-200 text-orange-900' :
                          prediction.riskLevel === 'Medium' ? 'bg-yellow-200 text-yellow-900' :
                          'bg-green-200 text-green-900'
                        }`}>
                          {prediction.riskLevel}
                        </span>
                        <p className="text-xs text-gray-700 mt-1 font-mono">Risk: {prediction.riskScore.toFixed(1)}/10</p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Churn Probability</span>
                        <span className="font-bold">{prediction.churnProbability}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            prediction.riskLevel === 'Critical' ? 'bg-red-600' :
                            prediction.riskLevel === 'High' ? 'bg-orange-600' :
                            prediction.riskLevel === 'Medium' ? 'bg-yellow-600' :
                            'bg-green-600'
                          }`}
                          style={{ width: `${prediction.churnProbability}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">Risk Factors:</p>
                      <ul className="space-y-1">
                        {prediction.reasons.map((reason, idx) => (
                          <li key={idx} className="text-sm text-gray-700">• {reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LTV & CAC Analysis */}
        {activeTab === 'ltv' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">LTV Curve Over Time</h2>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={ltvCurveData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₹${value}`} />
                  <Area type="monotone" dataKey="ltv" fill="#3B82F6" stroke="#1E40AF" />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-600 mt-4">📈 Average LTV reaches ₹2,400 by Month 24 (8x payback on CAC)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Feature Adoption Rate</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={featureAdoptionData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="feature" type="category" width={140} />
                    <Tooltip />
                    <Bar dataKey="adoption" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">CAC Payback Analysis</h3>
                <div className="space-y-3">
                  {paybackData.map((item) => (
                    <div key={item.tenant} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-900">{item.tenant}</h4>
                        <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-900 rounded">
                          {item.paybackMonths.toFixed(1)}mo payback
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-gray-600">CAC</p>
                          <p className="font-bold text-gray-900">₹{item.cac.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">LTV</p>
                          <p className="font-bold text-gray-900">₹{item.ltv.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">ROI</p>
                          <p className="font-bold text-green-600">{item.roi}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Forecasting */}
        {activeTab === 'forecast' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Revenue Forecast (Next 3 Months)</h2>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => value ? `₹${value.toLocaleString()}` : '-'} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="Actual Revenue"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Projected Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-600 mt-4">📊 Forecast confidence: 92% | Growth rate: 13% MoM</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Sep Projection</h3>
                <p className="text-3xl font-bold text-blue-900">₹68K</p>
                <p className="text-xs text-blue-700 mt-2">+9.7% from August</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Oct Projection</h3>
                <p className="text-3xl font-bold text-green-900">₹75K</p>
                <p className="text-xs text-green-700 mt-2">+10.3% from September</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Nov Projection</h3>
                <p className="text-3xl font-bold text-purple-900">₹82K</p>
                <p className="text-xs text-purple-700 mt-2">+9.3% from October</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Key Forecast Drivers</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900">New Customer Acquisition</p>
                    <p className="text-sm text-gray-600">2-3 new enterprise customers per month driving revenue growth</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900">Expansion Revenue</p>
                    <p className="text-sm text-gray-600">Average ARR increase of 15% from existing customers upgrading plans</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900">Churn Mitigation</p>
                    <p className="text-sm text-gray-600">Retaining 97% of customers through proactive success initiatives</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
