import { useState } from 'react';
import { ArrowLeft, Lock, Activity, Key, TrendingUp, Palette, Ticket, Shield, Mail, DollarSign, Copy, RefreshCw, Eye, EyeOff, Download } from 'lucide-react';
import { useLocation, useRoute } from 'wouter';
import SuperAdminLayout from '@/components/superadmin-layout';

interface TenantAdvanced {
  _id: string;
  name: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  ownerMobile: string;
}

export default function TenantAdvanced() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/superadmin/tenants/:tenantId/advanced');
  const tenantId = params?.tenantId as string;

  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'usage' | 'api' | 'billing' | 'branding' | 'support' | 'activity'>('overview');
  const [showPassword, setShowPassword] = useState(false);
  const [copyNotification, setCopyNotification] = useState('');

  const tenant: TenantAdvanced = {
    _id: tenantId,
    name: 'Test Business',
    businessName: 'Test Business One',
    ownerName: 'John Doe',
    ownerEmail: 'john@testbusiness.com',
    ownerMobile: '+91-9876543210'
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyNotification(`${label} copied!`);
    setTimeout(() => setCopyNotification(''), 2000);
  };

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
          <h1 className="text-4xl font-bold text-gray-900">{tenant.businessName}</h1>
          <p className="text-gray-600 mt-2">Advanced Management & Configuration</p>
        </div>

        {/* Copy Notification */}
        {copyNotification && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
            {copyNotification}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200 mb-8 overflow-x-auto">
          <div className="flex gap-1 p-4">
            {[
              { id: 'overview', label: '📋 Overview', icon: null },
              { id: 'security', label: '🔐 Security & 2FA', icon: null },
              { id: 'usage', label: '📊 Usage & Limits', icon: null },
              { id: 'api', label: '🔑 API Keys', icon: null },
              { id: 'billing', label: '💳 Advanced Billing', icon: null },
              { id: 'branding', label: '🎨 White-Label', icon: null },
              { id: 'support', label: '🎫 Support Tickets', icon: null },
              { id: 'activity', label: '📋 Activity Log', icon: null },
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

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tenant Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4">Tenant Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Business Name</p>
                  <p className="text-lg font-semibold">{tenant.businessName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Owner Name</p>
                  <p className="text-lg font-semibold">{tenant.ownerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="text-lg font-mono">{tenant.ownerEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Mobile</p>
                  <p className="text-lg font-semibold">{tenant.ownerMobile}</p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                <p className="text-sm text-blue-700 font-semibold">Active Users</p>
                <p className="text-3xl font-bold text-blue-900">24</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                <p className="text-sm text-green-700 font-semibold">Subscription Status</p>
                <p className="text-3xl font-bold text-green-900">Professional</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
                <p className="text-sm text-purple-700 font-semibold">Last Access</p>
                <p className="text-3xl font-bold text-purple-900">2 hours ago</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY & 2FA */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Password Management */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-600" />
                Password Management
              </h3>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm text-gray-600 block mb-2">Current Password</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value="password123!"
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded bg-white font-mono"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard('password123!', 'Password')}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors">
                  Generate New Password
                </button>
                <button className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors">
                  Force Password Reset on Next Login
                </button>
              </div>
            </div>

            {/* 2FA Configuration */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                Two-Factor Authentication
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 font-semibold mb-2">⚠️ 2FA Status: DISABLED</p>
                  <p className="text-sm text-yellow-700">Enable 2FA to add extra security layer</p>
                </div>
                <button className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors">
                  Enable 2FA (SMS OTP)
                </button>
                <button className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
                  Enable 2FA (Authenticator App)
                </button>
                <button className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors">
                  Manage 2FA Settings
                </button>
              </div>
            </div>

            {/* IP Whitelisting */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4">IP Whitelisting & Security</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Allowed IP Addresses</label>
                  <input
                    type="text"
                    placeholder="192.168.1.1, 10.0.0.0/8"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Comma-separated IPs or CIDR ranges</p>
                </div>
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
                    Add IP
                  </button>
                  <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors">
                    Disable IP Whitelisting
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: USAGE & LIMITS */}
        {activeTab === 'usage' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              { name: 'Vehicles', used: 45, limit: 50, color: 'blue' },
              { name: 'Drivers', used: 120, limit: 150, color: 'green' },
              { name: 'Storage (GB)', used: 75, limit: 100, color: 'purple' },
              { name: 'API Calls (Monthly)', used: 450000, limit: 500000, color: 'orange' },
            ].map((item) => {
              const percentage = (item.used / item.limit) * 100;
              const colorClass = {
                blue: 'bg-blue-600',
                green: 'bg-green-600',
                purple: 'bg-purple-600',
                orange: 'bg-orange-600'
              }[item.color];

              return (
                <div key={item.name} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900">{item.name}</h4>
                    <span className="text-sm font-semibold text-gray-600">{percentage.toFixed(0)}%</span>
                  </div>
                  <div className="mb-3">
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div className={`h-full ${colorClass} transition-all`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{item.used.toLocaleString()} / {item.limit.toLocaleString()}</p>
                  <button className="mt-4 w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-semibold text-sm transition-colors">
                    Increase Limit
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 4: API KEYS */}
        {activeTab === 'api' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              API Keys & Integrations
            </h3>
            <div className="space-y-4">
              {[
                { name: 'Production API Key', key: 'pk_live_abc123xyz456...', created: '2026-08-10', lastUsed: '2 hours ago' },
                { name: 'Development API Key', key: 'pk_test_def789xyz123...', created: '2026-08-05', lastUsed: '1 day ago' },
              ].map((api, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-gray-900">{api.name}</h4>
                    <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">Active</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <input type="text" value={api.key} readOnly className="flex-1 px-3 py-2 border border-gray-300 rounded bg-gray-50 font-mono text-sm" />
                    <button onClick={() => copyToClipboard(api.key, 'API Key')} className="p-2 hover:bg-gray-200 rounded">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">Created: {api.created} | Last used: {api.lastUsed}</p>
                </div>
              ))}
              <button className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
                Generate New API Key
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: ADVANCED BILLING */}
        {activeTab === 'billing' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Billing Configuration
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Custom Billing Rate (%)</label>
                  <input type="number" placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Discount Amount</label>
                  <div className="flex gap-2">
                    <input type="number" placeholder="0" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" />
                    <select className="px-3 py-2 border border-gray-300 rounded-lg">
                      <option>₹</option>
                      <option>%</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Discount Valid Until</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <button className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors">
                  Apply Custom Rates
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4">Payment Reminders</h3>
              <div className="space-y-3">
                {['7 days before renewal', '1 day before renewal', 'On due date', 'After 7 days overdue'].map((reminder, idx) => (
                  <label key={idx} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                    <span className="ml-3 text-sm text-gray-700">{reminder}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: WHITE-LABEL */}
        {activeTab === 'branding' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Palette className="w-5 h-5 text-purple-600" />
                Custom Branding
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Primary Color</label>
                  <input type="color" defaultValue="#3B82F6" className="w-full h-10 border border-gray-300 rounded cursor-pointer" />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Logo URL</label>
                  <input type="text" placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Company Name</label>
                  <input type="text" defaultValue={tenant.businessName} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <button className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors">
                  Save Branding
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 p-6">
              <h4 className="font-bold text-gray-900 mb-4">Preview</h4>
              <div className="bg-white rounded-lg p-4 border-2" style={{ borderColor: '#3B82F6' }}>
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-600 rounded mx-auto mb-3"></div>
                  <h4 className="font-bold text-gray-900">{tenant.businessName}</h4>
                  <p className="text-sm text-gray-600 mt-2">Your white-labeled dashboard</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SUPPORT TICKETS */}
        {activeTab === 'support' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Ticket className="w-5 h-5 text-orange-600" />
                Support Tickets
              </h3>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Ticket ID</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Subject</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Created</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  { id: 'TKT-001', subject: 'Login issues', status: 'Open', date: '2026-08-15' },
                  { id: 'TKT-002', subject: 'Feature request', status: 'In Progress', date: '2026-08-14' },
                  { id: 'TKT-003', subject: 'Billing inquiry', status: 'Resolved', date: '2026-08-10' },
                ].map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{ticket.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{ticket.subject}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        ticket.status === 'Open' ? 'bg-red-100 text-red-800' :
                        ticket.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{ticket.date}</td>
                    <td className="px-6 py-4"><button className="text-blue-600 hover:underline text-sm font-semibold">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 8: ACTIVITY LOG */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Activity Log
            </h3>
            <div className="space-y-4">
              {[
                { action: 'User Login', user: 'john@testbusiness.com', time: '2 hours ago', status: 'success' },
                { action: 'Plan Upgraded', user: 'System Admin', time: '1 day ago', status: 'success' },
                { action: 'API Call', user: 'API Key: pk_live_...', time: '3 hours ago', status: 'success' },
                { action: 'Failed Login Attempt', user: 'Unknown', time: '5 hours ago', status: 'error' },
                { action: 'Password Changed', user: 'john@testbusiness.com', time: '2 days ago', status: 'success' },
              ].map((log, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className={`w-3 h-3 rounded-full ${log.status === 'success' ? 'bg-green-600' : 'bg-red-600'}`}></div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{log.action}</p>
                    <p className="text-sm text-gray-600">{log.user}</p>
                  </div>
                  <span className="text-sm text-gray-500">{log.time}</span>
                </div>
              ))}
              <button className="w-full px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors mt-4">
                <Download className="w-4 h-4 inline mr-2" />
                Export Activity Log
              </button>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
