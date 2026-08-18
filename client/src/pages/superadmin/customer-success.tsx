import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Heart, TrendingUp, AlertTriangle, Star, Users, Target, MessageSquare, CheckCircle, Clock, ArrowUpRight, ArrowDownRight, Phone, Mail, Eye } from 'lucide-react';

interface CustomerHealth {
  tenantId: string;
  tenantName: string;
  healthScore: number;
  status: 'Healthy' | 'At Risk' | 'Critical';
  mrr: number;
  engagement: number;
  adoptionRate: number;
  nps: number;
  lastActivity: string;
  riskFactors: string[];
}

interface EngagementMetric {
  month: string;
  logins: number;
  apiCalls: number;
  features: number;
}

interface ExpansionOpportunity {
  tenantName: string;
  currentMRR: number;
  potentialMRR: number;
  opportunity: string;
  confidence: number;
  nextSteps: string[];
}

interface PlaybookAction {
  priority: number;
  customer: string;
  action: string;
  reason: string;
  expectedOutcome: string;
  dueDate: string;
}

export default function CustomerSuccessDashboard() {
  const [activeView, setActiveView] = useState('overview');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHealth | null>(null);

  // Customer health data
  const customers: CustomerHealth[] = [
    {
      tenantId: 'tenant_001',
      tenantName: 'Acme Corp',
      healthScore: 92,
      status: 'Healthy',
      mrr: 5000,
      engagement: 95,
      adoptionRate: 88,
      nps: 72,
      lastActivity: '2 hours ago',
      riskFactors: [],
    },
    {
      tenantId: 'tenant_002',
      tenantName: 'TechStart Inc',
      healthScore: 68,
      status: 'At Risk',
      mrr: 2000,
      engagement: 52,
      adoptionRate: 45,
      nps: 42,
      lastActivity: '8 days ago',
      riskFactors: ['Low engagement', 'Reduced API usage', 'Not using premium features'],
    },
    {
      tenantId: 'tenant_003',
      tenantName: 'Global Solutions',
      healthScore: 45,
      status: 'Critical',
      mrr: 3000,
      engagement: 25,
      adoptionRate: 20,
      nps: 28,
      lastActivity: '22 days ago',
      riskFactors: ['No activity for 3 weeks', 'Support tickets increased 5x', 'Missed payment'],
    },
    {
      tenantId: 'tenant_004',
      tenantName: 'Digital Pro',
      healthScore: 88,
      status: 'Healthy',
      mrr: 4200,
      engagement: 92,
      adoptionRate: 85,
      nps: 68,
      lastActivity: '30 mins ago',
      riskFactors: [],
    },
    {
      tenantId: 'tenant_005',
      tenantName: 'Cloud Systems',
      healthScore: 75,
      status: 'Healthy',
      mrr: 3500,
      engagement: 78,
      adoptionRate: 70,
      nps: 55,
      lastActivity: '4 hours ago',
      riskFactors: ['Seasonal usage pattern'],
    },
  ];

  // Engagement trend data
  const engagementTrend: EngagementMetric[] = [
    { month: 'May', logins: 4500, apiCalls: 12000, features: 85 },
    { month: 'June', logins: 5200, apiCalls: 15000, features: 88 },
    { month: 'July', logins: 6100, apiCalls: 18500, features: 91 },
    { month: 'August', logins: 5800, apiCalls: 17200, features: 89 },
  ];

  // Expansion opportunities
  const expansionOps: ExpansionOpportunity[] = [
    {
      tenantName: 'Acme Corp',
      currentMRR: 5000,
      potentialMRR: 7500,
      opportunity: 'Advanced Analytics add-on',
      confidence: 92,
      nextSteps: ['Schedule demo', 'Send proposal', 'Follow up in 5 days'],
    },
    {
      tenantName: 'Digital Pro',
      currentMRR: 4200,
      potentialMRR: 6500,
      opportunity: 'White Label upgrade',
      confidence: 78,
      nextSteps: ['Share case study', 'Technical deep dive', 'Pricing discussion'],
    },
    {
      tenantName: 'Cloud Systems',
      currentMRR: 3500,
      potentialMRR: 5200,
      opportunity: 'Premium support tier',
      confidence: 85,
      nextSteps: ['Analyze support patterns', 'Suggest SLA upgrade', 'Custom proposal'],
    },
  ];

  // Playbook actions (CS team tasks)
  const playbook: PlaybookAction[] = [
    {
      priority: 1,
      customer: 'Global Solutions',
      action: 'Emergency call with decision maker',
      reason: 'Critical: No activity for 3 weeks, payment issues',
      expectedOutcome: 'Re-engage or prevent churn',
      dueDate: 'Today',
    },
    {
      priority: 2,
      customer: 'TechStart Inc',
      action: 'Feature adoption training call',
      reason: 'At Risk: Using only 45% of platform',
      expectedOutcome: 'Increase engagement by 30%',
      dueDate: 'Tomorrow',
    },
    {
      priority: 3,
      customer: 'Acme Corp',
      action: 'Expansion opportunity discussion',
      reason: 'Healthy: Showing high engagement, ready for upsell',
      expectedOutcome: 'Upgrade to add-on or higher plan',
      dueDate: 'This week',
    },
  ];

  // Health distribution
  const healthDistribution = [
    { name: 'Healthy', value: 3, fill: '#10B981' },
    { name: 'At Risk', value: 1, fill: '#F59E0B' },
    { name: 'Critical', value: 1, fill: '#EF4444' },
  ];

  // NPS distribution
  const npsData = [
    { score: 'Detractors (0-6)', count: 1, color: '#EF4444' },
    { score: 'Passives (7-8)', count: 2, color: '#F59E0B' },
    { score: 'Promoters (9-10)', count: 2, color: '#10B981' },
  ];

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Healthy':
        return 'bg-green-100 text-green-800 border border-green-300';
      case 'At Risk':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'Critical':
        return 'bg-red-100 text-red-800 border border-red-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Heart size={32} className="text-red-500" />
            Customer Success Dashboard
          </h1>
          <p className="text-gray-600">Health scores, engagement metrics, expansion opportunities & playbooks</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Customers</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{customers.length}</p>
              </div>
              <Users size={32} className="text-blue-500" />
            </div>
            <p className="text-xs text-gray-600 mt-3">Total revenue: ₹17.7K/mo</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Avg Health Score</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">73.6</p>
              </div>
              <Heart size={32} className="text-red-500" />
            </div>
            <p className="text-xs text-gray-600 mt-3">3 Healthy, 1 At Risk, 1 Critical</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Expansion Potential</p>
                <p className="text-3xl font-bold text-green-600 mt-2">+₹5.2K</p>
              </div>
              <TrendingUp size={32} className="text-green-500" />
            </div>
            <p className="text-xs text-gray-600 mt-3">From 3 key opportunities</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Avg NPS Score</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">53</p>
              </div>
              <Star size={32} className="text-yellow-500" />
            </div>
            <p className="text-xs text-gray-600 mt-3">2 Promoters, 2 Passives, 1 Detractor</p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveView('overview')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'overview'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveView('health')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'health'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Health Scores
          </button>
          <button
            onClick={() => setActiveView('engagement')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'engagement'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Engagement
          </button>
          <button
            onClick={() => setActiveView('expansion')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'expansion'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Expansion
          </button>
          <button
            onClick={() => setActiveView('playbook')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'playbook'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Playbooks
          </button>
        </div>

        {/* Overview */}
        {activeView === 'overview' && (
          <div className="space-y-6">
            {/* Health distribution & NPS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Customer Status Distribution</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={healthDistribution} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                      {healthDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">NPS Distribution</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={npsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="score" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick actions & at-risk list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full p-3 text-left rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <Phone size={18} className="text-red-600" />
                      <div>
                        <p className="font-semibold text-red-900">Call Global Solutions (Critical)</p>
                        <p className="text-xs text-red-700">No activity for 3 weeks</p>
                      </div>
                    </div>
                  </button>
                  <button className="w-full p-3 text-left rounded-lg bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={18} className="text-yellow-600" />
                      <div>
                        <p className="font-semibold text-yellow-900">Email TechStart Inc (At Risk)</p>
                        <p className="text-xs text-yellow-700">Feature adoption training</p>
                      </div>
                    </div>
                  </button>
                  <button className="w-full p-3 text-left rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <Target size={18} className="text-green-600" />
                      <div>
                        <p className="font-semibold text-green-900">Upsell Acme Corp (Expansion)</p>
                        <p className="text-xs text-green-700">Advanced Analytics add-on ready</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">At-Risk Customers</h3>
                <div className="space-y-3">
                  {customers.filter(c => c.status !== 'Healthy').map((customer) => (
                    <div key={customer.tenantId} className={`p-3 rounded-lg border-2 ${getStatusBadge(customer.status)}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">{customer.tenantName}</h4>
                        <span className="text-xs font-bold">Score: {customer.healthScore}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={14} />
                        <span className="text-xs">Last activity: {customer.lastActivity}</span>
                      </div>
                      <div className="space-y-1">
                        {customer.riskFactors.map((factor, idx) => (
                          <p key={idx} className="text-xs">• {factor}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Health Scores */}
        {activeView === 'health' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Health Scores</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customers.map((customer) => (
                  <div
                    key={customer.tenantId}
                    onClick={() => setSelectedCustomer(customer)}
                    className="p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-gray-900">{customer.tenantName}</h3>
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusBadge(customer.status)}`}>
                        {customer.status}
                      </span>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-2xl font-bold text-gray-900">{customer.healthScore}</span>
                        <span className="text-xs text-gray-600">/100</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            customer.healthScore >= 80
                              ? 'bg-green-500'
                              : customer.healthScore >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${customer.healthScore}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Engagement:</span>
                        <span className="font-semibold">{customer.engagement}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Adoption:</span>
                        <span className="font-semibold">{customer.adoptionRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">NPS:</span>
                        <span className="font-semibold">{customer.nps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">MRR:</span>
                        <span className="font-semibold">₹{customer.mrr.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Customer Detail */}
            {selectedCustomer && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow p-6 border-2 border-blue-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedCustomer.tenantName} - Deep Dive</h3>
                    <p className="text-gray-600 mt-1">Tenant ID: {selectedCustomer.tenantId}</p>
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Health Score</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedCustomer.healthScore}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Engagement</p>
                    <p className="text-2xl font-bold text-blue-600">{selectedCustomer.engagement}%</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Adoption Rate</p>
                    <p className="text-2xl font-bold text-green-600">{selectedCustomer.adoptionRate}%</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-purple-600">₹{selectedCustomer.mrr.toLocaleString()}</p>
                  </div>
                </div>

                {selectedCustomer.riskFactors.length > 0 && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-bold text-red-900 mb-2">Risk Factors</h4>
                    <ul className="space-y-1">
                      {selectedCustomer.riskFactors.map((factor, idx) => (
                        <li key={idx} className="text-sm text-red-800">• {factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Engagement */}
        {activeView === 'engagement' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Platform Engagement Trends</h2>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={engagementTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="logins"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="Logins"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="apiCalls"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="API Calls"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="features"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    name="Features Used"
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-600 mt-4">
                📈 Overall engagement up 29% (4,500 → 5,800 logins), API usage up 43% (12K → 17.2K calls)
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Feature Adoption by Customer</h2>
              <div className="space-y-3">
                {customers.map((customer) => (
                  <div key={customer.tenantId} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-gray-900">{customer.tenantName}</span>
                      <span className="text-sm font-bold text-gray-600">{customer.adoptionRate}%</span>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${customer.adoptionRate}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {customer.status === 'Healthy'
                        ? '✅ Healthy adoption trajectory'
                        : customer.status === 'At Risk'
                        ? '⚠️ Below-average usage'
                        : '🔴 Critical adoption gap'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expansion */}
        {activeView === 'expansion' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Expansion Opportunities</h2>
              <div className="space-y-4">
                {expansionOps.map((opp, idx) => (
                  <div key={idx} className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">{opp.tenantName}</h3>
                        <p className="text-gray-700 font-semibold mt-1">{opp.opportunity}</p>
                      </div>
                      <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                        {opp.confidence}% confidence
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-gray-600">Current MRR</p>
                        <p className="text-lg font-bold text-gray-900">₹{opp.currentMRR.toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-gray-600">Potential MRR</p>
                        <p className="text-lg font-bold text-green-600">₹{opp.potentialMRR.toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-gray-600">Expansion Value</p>
                        <p className="text-lg font-bold text-blue-600">+₹{(opp.potentialMRR - opp.currentMRR).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Next Steps:</p>
                      <ol className="space-y-1">
                        {opp.nextSteps.map((step, stepIdx) => (
                          <li key={stepIdx} className="text-sm text-gray-700">
                            {stepIdx + 1}. {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Playbooks */}
        {activeView === 'playbook' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Success Playbooks</h2>
              <div className="space-y-4">
                {playbook.map((action, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 ${
                      action.priority === 1
                        ? 'border-red-300 bg-red-50'
                        : action.priority === 2
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-blue-300 bg-blue-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                            action.priority === 1
                              ? 'bg-red-600'
                              : action.priority === 2
                              ? 'bg-yellow-600'
                              : 'bg-blue-600'
                          }`}
                        >
                          P{action.priority}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{action.action}</h3>
                          <p className="text-sm font-semibold text-gray-800 mt-1">{action.customer}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-white rounded-full text-xs font-bold">
                        {action.dueDate}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">Reason:</p>
                        <p className="text-sm text-gray-900">{action.reason}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">Expected Outcome:</p>
                        <p className="text-sm text-gray-900">{action.expectedOutcome}</p>
                      </div>
                    </div>

                    <button className="mt-3 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-900">
                      {action.priority === 1 ? '📞 Schedule Call' : action.priority === 2 ? '📧 Send Email' : '📅 Schedule Meeting'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
