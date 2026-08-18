import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Card, CardContent } from 'recharts';
import { CreditCard, Users, Settings, Activity, Download, MoreVertical, Plus, TrendingUp, AlertCircle, CheckCircle, Lock, Eye } from 'lucide-react';

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  items: string;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string;
  status: 'Active' | 'Inactive' | 'Revoked';
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  status: 'Active' | 'Invited' | 'Inactive';
  joinedDate: string;
}

interface UsageData {
  month: string;
  apiCalls: number;
  requests: number;
}

export default function TenantPortalDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showApiModal, setShowApiModal] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);

  // Current subscription info
  const subscription = {
    plan: 'Professional',
    status: 'Active',
    billingCycle: 'Monthly',
    amount: '₹2,999',
    nextBillingDate: '2026-09-16',
    usagePercent: 65,
    features: ['API Integration', 'Webhooks', 'Analytics Dashboard', 'Custom Reporting', 'Priority Support'],
    seats: 5,
    seatsUsed: 3,
  };

  // Usage data
  const usageData: UsageData[] = [
    { month: 'Apr', apiCalls: 25000, requests: 18000 },
    { month: 'May', apiCalls: 32000, requests: 24000 },
    { month: 'Jun', apiCalls: 41000, requests: 31000 },
    { month: 'Jul', apiCalls: 48000, requests: 35000 },
    { month: 'Aug', apiCalls: 52000, requests: 38000 },
  ];

  // Recent invoices
  const invoices: Invoice[] = [
    { id: 'INV-2026-008', date: '2026-08-16', amount: 2999, status: 'Paid', items: 'Professional Plan (1 month)' },
    { id: 'INV-2026-007', date: '2026-07-16', amount: 2999, status: 'Paid', items: 'Professional Plan (1 month)' },
    { id: 'INV-2026-006', date: '2026-06-16', amount: 2999, status: 'Paid', items: 'Professional Plan (1 month)' },
    { id: 'INV-2026-005', date: '2026-05-16', amount: 2999, status: 'Paid', items: 'Professional Plan (1 month)' },
  ];

  // API Keys
  const apiKeys: ApiKey[] = [
    { id: 'key_1', name: 'Production API Key', key: 'sk_prod_xxxxxxxxxxxxxxxxxxxx', createdAt: '2026-06-01', lastUsed: '2 hours ago', status: 'Active' },
    { id: 'key_2', name: 'Staging API Key', key: 'sk_staging_xxxxxxxxxxxxxxxxxxxx', createdAt: '2026-05-15', lastUsed: '3 days ago', status: 'Active' },
    { id: 'key_3', name: 'Old Development Key', key: 'sk_dev_xxxxxxxxxxxxxxxxxxxx', createdAt: '2026-02-10', lastUsed: 'Never', status: 'Revoked' },
  ];

  // Team members
  const teamMembers: TeamMember[] = [
    { id: '1', name: 'You', email: 'admin@company.com', role: 'Admin', status: 'Active', joinedDate: '2026-01-15' },
    { id: '2', name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Editor', status: 'Active', joinedDate: '2026-03-20' },
    { id: '3', name: 'Mike Chen', email: 'mike@company.com', role: 'Viewer', status: 'Active', joinedDate: '2026-05-10' },
  ];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-100 text-red-800';
      case 'Editor':
        return 'bg-blue-100 text-blue-800';
      case 'Viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
      case 'Paid':
        return 'text-green-600 bg-green-50';
      case 'Pending':
      case 'Invited':
        return 'text-yellow-600 bg-yellow-50';
      case 'Overdue':
      case 'Inactive':
        return 'text-red-600 bg-red-50';
      case 'Revoked':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <h1 className="text-3xl font-bold mb-2">Tenant Portal</h1>
          <p className="text-blue-100">Manage your subscription, billing, team, and API keys</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Subscription Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-600 text-sm font-medium">Current Plan</p>
              <CreditCard size={20} className="text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{subscription.plan}</p>
            <p className="text-xs text-gray-600 mt-2">{subscription.billingCycle}</p>
            <p className="text-lg font-bold text-green-600 mt-2">{subscription.amount}/mo</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-600 text-sm font-medium">Status</p>
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{subscription.status}</p>
            <p className="text-xs text-gray-600 mt-2">Next billing: {subscription.nextBillingDate}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-600 text-sm font-medium">Team Members</p>
              <Users size={20} className="text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{subscription.seatsUsed}/{subscription.seats}</p>
            <p className="text-xs text-gray-600 mt-2">Seats used</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-600 text-sm font-medium">Usage This Month</p>
              <TrendingUp size={20} className="text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">65%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '65%' }}></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap border-b border-gray-200 pb-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'billing'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Billing & Invoices
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'team'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Team Members
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'api'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Settings
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Plan Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Plan Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subscription.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <CheckCircle size={20} className="text-green-600" />
                    <span className="text-gray-700 font-medium">{feature}</span>
                  </div>
                ))}
              </div>
              <button className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                Upgrade to Enterprise
              </button>
            </div>

            {/* Usage Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">API Usage Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => value.toLocaleString()} />
                  <Legend />
                  <Line type="monotone" dataKey="apiCalls" stroke="#3B82F6" strokeWidth={2} name="API Calls" />
                  <Line type="monotone" dataKey="requests" stroke="#10B981" strokeWidth={2} name="Requests" />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-600 mt-4">📈 API usage up 108% in past 4 months (25K → 52K calls)</p>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Invoices</h2>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <Download size={18} />
                  Download All
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Invoice ID</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Description</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-sm text-gray-900">{invoice.id}</td>
                        <td className="py-3 px-4 text-gray-600">{invoice.date}</td>
                        <td className="py-3 px-4 text-gray-600">{invoice.items}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">₹{invoice.amount.toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                            <Download size={16} />
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Billing Settings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Billing Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 font-semibold mb-2">Company Name</p>
                  <p className="text-gray-900 font-medium">Acme Corporation</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-semibold mb-2">Email</p>
                  <p className="text-gray-900 font-medium">billing@acme.com</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-semibold mb-2">Tax ID</p>
                  <p className="text-gray-900 font-medium">12-3456789</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-semibold mb-2">Billing Address</p>
                  <p className="text-gray-900 font-medium">123 Main St, New York, NY 10001</p>
                </div>
              </div>
              <button className="mt-6 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-900">
                Update Billing Information
              </button>
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Team Members</h2>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <Plus size={18} />
                  Add Member
                </button>
              </div>

              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <div key={member.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-600">{member.email}</p>
                      <p className="text-xs text-gray-500 mt-1">Joined {member.joinedDate}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleColor(member.role)}`}>
                        {member.role}
                      </span>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(member.status)}`}>
                        {member.status}
                      </span>
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical size={18} className="text-gray-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Role Permissions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Role Permissions</h3>
              <div className="space-y-4">
                {[
                  { role: 'Admin', perms: 'Full access including team management, billing, and settings' },
                  { role: 'Editor', perms: 'Can modify API keys, webhooks, and team members' },
                  { role: 'Viewer', perms: 'Read-only access to dashboards and reports' },
                ].map((item) => (
                  <div key={item.role} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-semibold text-gray-900">{item.role}</p>
                    <p className="text-sm text-gray-600">{item.perms}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">API Keys</h2>
                <button
                  onClick={() => setShowApiModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus size={18} />
                  Generate New Key
                </button>
              </div>

              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div key={key.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{key.name}</h3>
                        <p className="text-sm text-gray-600 font-mono mt-1 flex items-center gap-2">
                          {selectedKey?.id === key.id ? key.key : key.key.slice(0, 15) + '...' + key.key.slice(-5)}
                          <button className="text-blue-600 hover:text-blue-700">
                            <Eye size={16} />
                          </button>
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          key.status === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : key.status === 'Inactive'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {key.status}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-gray-600 pt-3 border-t border-gray-100">
                      <span>Created: {key.createdAt}</span>
                      <span>Last used: {key.lastUsed}</span>
                      <button className="text-red-600 hover:text-red-700 font-medium">Revoke</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* API Documentation Link */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-bold text-blue-900 mb-2">📚 API Documentation</h3>
              <p className="text-blue-800 text-sm mb-4">
                Learn how to use our API with code examples and interactive documentation.
              </p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                View API Docs
              </button>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Account Settings</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Tenant Name</label>
                  <input type="text" defaultValue="Acme Corporation" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Email Address</label>
                  <input type="email" defaultValue="admin@acme.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Phone Number</label>
                  <input type="tel" defaultValue="+1 (555) 123-4567" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Timezone</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option>America/New_York (EST)</option>
                    <option>America/Chicago (CST)</option>
                    <option>America/Denver (MST)</option>
                    <option>America/Los_Angeles (PST)</option>
                  </select>
                </div>

                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Save Changes
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Notification Preferences</h3>

              <div className="space-y-4">
                {[
                  { label: 'Invoice Notifications', desc: 'Get notified when invoices are ready' },
                  { label: 'Usage Alerts', desc: 'Alert when usage exceeds 80% of plan limit' },
                  { label: 'Billing Updates', desc: 'Payment failed and renewal reminders' },
                  { label: 'Team Invitations', desc: 'Notify when team members join' },
                  { label: 'System Updates', desc: 'Important platform updates and maintenance' },
                  { label: 'Weekly Digest', desc: 'Weekly summary of activity and usage' },
                ].map((item) => (
                  <label key={item.label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-600">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-red-900 mb-4">Danger Zone</h3>

              <div className="space-y-3">
                <button className="w-full px-4 py-2 border-2 border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium">
                  Download All Data (GDPR Export)
                </button>
                <button className="w-full px-4 py-2 border-2 border-red-500 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium">
                  Cancel Subscription
                </button>
                <button className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                  Delete Account Permanently
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
