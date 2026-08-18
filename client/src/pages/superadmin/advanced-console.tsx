import { useState } from 'react';
import { ArrowLeft, BarChart3, FileText, Zap, Plug, Settings2, Shield, Zap as Zap2, Copy, Download, Plus, Trash2, Edit2, Play, Pause } from 'lucide-react';
import { useLocation } from 'wouter';
import SuperAdminLayout from '@/components/superadmin-layout';

export default function AdvancedConsole() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'analytics' | 'reports' | 'automation' | 'integrations' | 'custom-fields' | 'compliance' | 'performance' | 'bulk-ops' | 'workflows' | 'export'>('analytics');

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => setLocation('/superadmin/tenants')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tenants
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">🚀 Enterprise Advanced Console</h1>
          <p className="text-gray-600 mt-2">Complete Platform Management, Analytics & Automation</p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200 mb-8 overflow-x-auto">
          <div className="flex gap-1 p-4">
            {[
              { id: 'analytics', label: '📊 Analytics', icon: null },
              { id: 'reports', label: '📈 Reports', icon: null },
              { id: 'automation', label: '⚙️ Automation', icon: null },
              { id: 'integrations', label: '🔗 Integrations', icon: null },
              { id: 'custom-fields', label: '📋 Custom Fields', icon: null },
              { id: 'compliance', label: '🔏 Compliance', icon: null },
              { id: 'performance', label: '⚡ Performance', icon: null },
              { id: 'bulk-ops', label: '📦 Bulk Ops', icon: null },
              { id: 'workflows', label: '🤖 Workflows', icon: null },
              { id: 'export', label: '📤 Export', icon: null },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 whitespace-nowrap font-semibold rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 1. ANALYTICS DASHBOARD */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Tenants', value: '156', change: '+12%', color: 'blue' },
                { label: 'Active Users', value: '2,847', change: '+5%', color: 'green' },
                { label: 'Revenue', value: '₹24.5L', change: '+18%', color: 'purple' },
                { label: 'API Calls/Day', value: '2.3M', change: '-3%', color: 'orange' },
              ].map((stat, idx) => (
                <div key={idx} className={`bg-gradient-to-br from-${stat.color}-50 to-${stat.color}-100 rounded-lg p-6 border border-${stat.color}-200`}>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  <p className={`text-sm mt-2 ${stat.change.includes('+') ? 'text-green-600' : 'text-red-600'}`}>{stat.change}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-xl font-bold mb-4">Tenant Growth (Last 30 Days)</h3>
                <div className="h-64 bg-gradient-to-b from-blue-100 to-blue-50 rounded-lg flex items-end justify-around p-4">
                  {Array.from({length: 15}).map((_, i) => (
                    <div key={i} className="bg-blue-600 rounded-t w-6" style={{height: `${Math.random() * 80 + 20}%`}}></div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-xl font-bold mb-4">Revenue Breakdown</h3>
                <div className="space-y-3">
                  {[
                    { plan: 'Starter', revenue: '₹4.2L', percentage: 18 },
                    { plan: 'Professional', revenue: '₹12.5L', percentage: 51 },
                    { plan: 'Enterprise', revenue: '₹7.8L', percentage: 31 },
                  ].map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between mb-1">
                        <span className="font-semibold">{item.plan}</span>
                        <span className="text-sm text-gray-600">{item.revenue}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{width: `${item.percentage}%`}}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">
              <Plus className="w-4 h-4 inline mr-2" />
              Create Custom Report
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { name: 'Tenant Performance', date: '2026-08-16', status: 'Ready' },
                { name: 'Revenue Analysis', date: '2026-08-15', status: 'Ready' },
                { name: 'Usage Statistics', date: '2026-08-14', status: 'Generating' },
                { name: 'Churn Analysis', date: '2026-08-12', status: 'Ready' },
              ].map((report, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-gray-900">{report.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      report.status === 'Ready' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Generated: {report.date}</p>
                  <button className="w-full px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. AUTOMATION RULES */}
        {activeTab === 'automation' && (
          <div className="space-y-6">
            <button className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold">
              <Plus className="w-4 h-4 inline mr-2" />
              Create New Rule
            </button>

            <div className="space-y-3">
              {[
                { name: 'Auto-upgrade on usage', trigger: 'Usage > 80%', action: 'Suggest upgrade', status: 'Active' },
                { name: 'Payment reminder', trigger: '7 days before renewal', action: 'Send email', status: 'Active' },
                { name: 'Inactive tenant alert', trigger: 'No login x 30 days', action: 'Notify admin', status: 'Paused' },
              ].map((rule, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-900">{rule.name}</h4>
                    <p className="text-sm text-gray-600">Trigger: {rule.trigger} → {rule.action}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      rule.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.status}
                    </span>
                    <button className="p-2 hover:bg-gray-100 rounded"><Edit2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. INTEGRATIONS */}
        {activeTab === 'integrations' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'Slack', status: 'Connected', icon: '💬', lastUsed: '2 hours ago' },
              { name: 'Webhook', status: 'Configured', icon: '🪝', lastUsed: '30 min ago' },
              { name: 'Zapier', status: 'Connected', icon: '⚡', lastUsed: 'Yesterday' },
              { name: 'Google Sheets', status: 'Not Connected', icon: '📊', lastUsed: 'Never' },
              { name: 'HubSpot', status: 'Connected', icon: '🎯', lastUsed: '1 day ago' },
              { name: 'Salesforce', status: 'Not Connected', icon: '☁️', lastUsed: 'Never' },
            ].map((integration, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <div className="text-4xl mb-3">{integration.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{integration.name}</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
                  integration.status === 'Connected' ? 'bg-green-100 text-green-800' :
                  integration.status === 'Configured' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {integration.status}
                </span>
                <p className="text-xs text-gray-600 mb-4">Last used: {integration.lastUsed}</p>
                <button className="w-full px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-semibold text-sm">
                  {integration.status === 'Not Connected' ? 'Connect' : 'Manage'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 5. CUSTOM FIELDS */}
        {activeTab === 'custom-fields' && (
          <div className="space-y-6">
            <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold">
              <Plus className="w-4 h-4 inline mr-2" />
              Add Custom Field
            </button>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Field Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Required</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { name: 'Industry', type: 'Dropdown', required: 'No' },
                    { name: 'Company Size', type: 'Number', required: 'No' },
                    { name: 'Tax ID', type: 'Text', required: 'Yes' },
                  ].map((field, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold text-gray-900">{field.name}</td>
                      <td className="px-6 py-4 text-gray-600">{field.type}</td>
                      <td className="px-6 py-4 text-gray-600">{field.required}</td>
                      <td className="px-6 py-4 flex gap-2">
                        <button className="p-2 hover:bg-gray-200 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button className="p-2 hover:bg-red-100 rounded text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. COMPLIANCE & AUDIT */}
        {activeTab === 'compliance' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                Compliance Status
              </h3>
              <div className="space-y-3">
                {[
                  { standard: 'GDPR', status: 'Compliant', score: '98%' },
                  { standard: 'ISO 27001', status: 'Compliant', score: '95%' },
                  { standard: 'SOC 2', status: 'In Progress', score: '75%' },
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-semibold text-gray-900">{item.standard}</p>
                      <p className="text-sm text-gray-600">{item.status}</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{item.score}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4">Audit Log</h3>
              <div className="space-y-2">
                {[
                  'User data exported - 2 hours ago',
                  'Tenant deleted - 5 hours ago',
                  'Password reset - 1 day ago',
                  'Plan upgraded - 2 days ago',
                ].map((log, idx) => (
                  <p key={idx} className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                    ✓ {log}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 7. PERFORMANCE MONITORING */}
        {activeTab === 'performance' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              { metric: 'API Response Time', value: '125ms', target: '<200ms', status: '✅' },
              { metric: 'Database Query Time', value: '45ms', target: '<100ms', status: '✅' },
              { metric: 'Cache Hit Rate', value: '94%', target: '>90%', status: '✅' },
              { metric: 'Error Rate', value: '0.02%', target: '<0.1%', status: '✅' },
              { metric: 'Uptime', value: '99.98%', target: '>99.9%', status: '✅' },
              { metric: 'CPU Usage', value: '45%', target: '<70%', status: '✅' },
            ].map((perf, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-900">{perf.metric}</h4>
                  <span className="text-lg">{perf.status}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-2">{perf.value}</p>
                <p className="text-sm text-gray-600">Target: {perf.target}</p>
              </div>
            ))}
          </div>
        )}

        {/* 8. BULK OPERATIONS */}
        {activeTab === 'bulk-ops' && (
          <div className="space-y-6">
            <button className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold">
              <Plus className="w-4 h-4 inline mr-2" />
              New Bulk Operation
            </button>

            <div className="space-y-3">
              {[
                { operation: 'Upgrade 15 tenants to Professional', created: '2026-08-15', status: 'Completed', progress: '15/15' },
                { operation: 'Send renewal reminder to 42 tenants', created: '2026-08-14', status: 'In Progress', progress: '28/42' },
                { operation: 'Disable inactive accounts', created: '2026-08-10', status: 'Completed', progress: '8/8' },
              ].map((op, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-gray-900">{op.operation}</h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      op.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {op.status}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{width: `${(parseInt(op.progress.split('/')[0]) / parseInt(op.progress.split('/')[1])) * 100}%`}}></div>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">Created: {op.created}</p>
                    <p className="text-sm font-semibold text-gray-900">{op.progress}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. WORKFLOW AUTOMATION */}
        {activeTab === 'workflows' && (
          <div className="space-y-6">
            <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold">
              <Plus className="w-4 h-4 inline mr-2" />
              Create Workflow
            </button>

            <div className="grid grid-cols-1 gap-4">
              {[
                {
                  name: 'New Tenant Onboarding',
                  steps: ['Send welcome email', 'Create API key', 'Schedule tutorial call', 'Send docs'],
                  status: 'Active'
                },
                {
                  name: 'Failed Payment Recovery',
                  steps: ['Send retry notification', 'Wait 3 days', 'Escalate to support', 'Disable tenant'],
                  status: 'Active'
                },
              ].map((workflow, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-lg font-bold text-gray-900">{workflow.name}</h4>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                      {workflow.status}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {workflow.steps.map((step, stepIdx) => (
                      <div key={stepIdx} className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {stepIdx + 1}
                        </div>
                        <span className="text-gray-700">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 10. DATA EXPORT */}
        {activeTab === 'export' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { format: 'CSV', icon: '📄', desc: 'Comma-separated values' },
              { format: 'Excel', icon: '📊', desc: 'Microsoft Excel format' },
              { format: 'PDF', icon: '📑', desc: 'Portable Document Format' },
              { format: 'JSON', icon: '{}', desc: 'JSON data format' },
              { format: 'SQL', icon: '🗄️', desc: 'SQL database dump' },
              { format: 'API', icon: '🔗', desc: 'Direct API export' },
            ].map((exp, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow">
                <div className="text-3xl mb-3">{exp.icon}</div>
                <h4 className="font-bold text-gray-900 mb-1">{exp.format}</h4>
                <p className="text-sm text-gray-600 mb-4">{exp.desc}</p>
                <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
                  Export
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
