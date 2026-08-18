import { useState, useEffect } from 'react';
import { ArrowLeft, Loader, AlertCircle, Plus, Download, Play, Pause, Trash2 } from 'lucide-react';
import { useLocation } from 'wouter';
import SuperAdminLayout from '@/components/superadmin-layout';

export default function AdvancedConsoleLive() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'analytics' | 'reports' | 'automation' | 'integrations' | 'compliance' | 'performance' | 'export'>('analytics');

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Analytics
  const [tenantStats, setTenantStats] = useState<any>(null);
  const [revenueStats, setRevenueStats] = useState<any>(null);
  const [tenantGrowth, setTenantGrowth] = useState<any[]>([]);

  // Reports
  const [revenueReport, setRevenueReport] = useState<any>(null);
  const [tenantHealth, setTenantHealth] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any>(null);

  // Automation
  const [automationRules, setAutomationRules] = useState<any[]>([]);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleTrigger, setNewRuleTrigger] = useState('');

  // Integrations
  const [integrations, setIntegrations] = useState<any[]>([]);

  // Compliance
  const [compliance, setCompliance] = useState<any>(null);

  // Performance
  const [performance, setPerformance] = useState<any>(null);

  // Fetch all data
  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    try {
      setLoading(true);
      setError('');

      // Fetch tenant stats
      const tenantsRes = await fetch('/api/admin/tenants', {
        credentials: 'include'
      });
      if (tenantsRes.ok) {
        const tenants = await tenantsRes.json();
        setTenantStats({
          total: Array.isArray(tenants) ? tenants.length : 0,
          active: Array.isArray(tenants) ? tenants.filter((t: any) => t.isActive).length : 0
        });
      } else {
        console.warn('Failed to fetch tenants:', tenantsRes.status);
        setTenantStats({ total: 0, active: 0 });
      }

      // Fetch analytics
      const growthRes = await fetch('/api/admin/console/analytics/tenant-growth', {
        credentials: 'include'
      });
      if (growthRes.ok) {
        const data = await growthRes.json();
        setTenantGrowth(Array.isArray(data) ? data : []);
      } else {
        console.warn('Failed to fetch tenant growth:', growthRes.status);
        setTenantGrowth([]);
      }

      const revenueRes = await fetch('/api/admin/console/analytics/revenue', {
        credentials: 'include'
      });
      if (revenueRes.ok) {
        const data = await revenueRes.json();
        setRevenueStats(data || {});
      } else {
        console.warn('Failed to fetch revenue stats:', revenueRes.status);
        setRevenueStats({});
      }

      // Fetch reports
      const reportRevRes = await fetch('/api/admin/console/reports/revenue', {
        credentials: 'include'
      });
      if (reportRevRes.ok) {
        const data = await reportRevRes.json();
        setRevenueReport(data || {});
      } else {
        console.warn('Failed to fetch revenue report:', reportRevRes.status);
        setRevenueReport({});
      }

      const healthRes = await fetch('/api/admin/console/reports/tenant-health', {
        credentials: 'include'
      });
      if (healthRes.ok) {
        const data = await healthRes.json();
        setTenantHealth(data || {});
      } else {
        console.warn('Failed to fetch tenant health:', healthRes.status);
        setTenantHealth({});
      }

      const subsRes = await fetch('/api/admin/console/reports/subscriptions', {
        credentials: 'include'
      });
      if (subsRes.ok) {
        const data = await subsRes.json();
        setSubscriptions(data || {});
      } else {
        console.warn('Failed to fetch subscriptions:', subsRes.status);
        setSubscriptions({});
      }

      // Fetch automation rules
      const rulesRes = await fetch('/api/admin/console/automation/rules', {
        credentials: 'include'
      });
      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setAutomationRules(Array.isArray(data) ? data : []);
      } else {
        console.warn('Failed to fetch automation rules:', rulesRes.status);
        setAutomationRules([]);
      }

      // Fetch integrations
      const intRes = await fetch('/api/admin/console/integrations', {
        credentials: 'include'
      });
      if (intRes.ok) {
        const data = await intRes.json();
        setIntegrations(Array.isArray(data) ? data : []);
      } else {
        console.warn('Failed to fetch integrations:', intRes.status);
        setIntegrations([]);
      }

      // Fetch compliance
      const compRes = await fetch('/api/admin/console/compliance', {
        credentials: 'include'
      });
      if (compRes.ok) {
        const data = await compRes.json();
        setCompliance(data || {});
      } else {
        console.warn('Failed to fetch compliance:', compRes.status);
        setCompliance({});
      }

      // Fetch performance
      const perfRes = await fetch('/api/admin/console/performance', {
        credentials: 'include'
      });
      if (perfRes.ok) {
        const data = await perfRes.json();
        setPerformance(data || {});
      } else {
        console.warn('Failed to fetch performance:', perfRes.status);
        setPerformance({});
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load data');
      setLoading(false);
    }
  }

  async function createRule() {
    if (!newRuleName || !newRuleTrigger) return;

    try {
      const res = await fetch('/api/admin/console/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newRuleName,
          trigger: newRuleTrigger,
          action: 'execute'
        })
      });

      if (res.ok) {
        setNewRuleName('');
        setNewRuleTrigger('');
        await fetchAllData();
      }
    } catch (err) {
      console.error('Error creating rule:', err);
    }
  }

  async function exportData(format: string) {
    try {
      await fetch('/api/admin/console/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ format, dataType: 'all' })
      });
      alert(`Export queued in ${format} format`);
    } catch (err) {
      console.error('Error exporting:', err);
    }
  }

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading Advanced Console...</p>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <button
          onClick={() => setLocation('/superadmin/tenants')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tenants
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">🚀 Enterprise Advanced Console</h1>
          <p className="text-gray-600 mt-2">Real-Time Platform Management & Analytics</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200 mb-8 overflow-x-auto">
          <div className="flex gap-1 p-4">
            {[
              { id: 'analytics', label: '📊 Analytics' },
              { id: 'reports', label: '📈 Reports' },
              { id: 'automation', label: '⚙️ Automation' },
              { id: 'integrations', label: '🔗 Integrations' },
              { id: 'compliance', label: '🔏 Compliance' },
              { id: 'performance', label: '⚡ Performance' },
              { id: 'export', label: '📤 Export' },
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

        {/* ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                <p className="text-sm text-gray-600">Total Tenants</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{tenantStats?.total || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                <p className="text-sm text-gray-600">Active Tenants</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{tenantStats?.active || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">₹{revenueReport?.totalRevenue ? (revenueReport.totalRevenue / 100000).toFixed(1) : 0}L</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
                <p className="text-sm text-gray-600">Active Subs</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{subscriptions?.active || 0}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4">Tenant Growth (Last 30 Days)</h3>
              <div className="h-64 flex items-end justify-around gap-1 bg-gradient-to-b from-blue-50 to-white p-4 rounded-lg">
                {tenantGrowth.slice(-30).map((d: any, i: number) => (
                  <div
                    key={i}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-t transition-colors"
                    style={{ height: `${Math.max((d.count / Math.max(...tenantGrowth.map((x: any) => x.count))) * 100, 5)}%` }}
                    title={`${d.date}: ${d.count} tenants`}
                  />
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4">Revenue by Plan</h3>
              <div className="space-y-4">
                {revenueStats && Object.entries(revenueStats).map(([plan, revenue]: any) => (
                  <div key={plan}>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold">{plan}</span>
                      <span className="text-sm text-gray-600">₹{(revenue.revenue / 100000).toFixed(1)}L</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(revenue.revenue / (revenueReport?.totalRevenue || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-4">Revenue Report</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-600">Total Revenue:</span> <span className="font-semibold">₹{revenueReport?.totalRevenue ? (revenueReport.totalRevenue / 100000).toFixed(1) : 0}L</span></p>
                  <p><span className="text-gray-600">Next Month Forecast:</span> <span className="font-semibold">₹{revenueReport?.forecast?.nextMonth ? (revenueReport.forecast.nextMonth / 100000).toFixed(1) : 0}L</span></p>
                </div>
                <button className="w-full mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-semibold">
                  <Download className="w-4 h-4 inline mr-2" />
                  Download Report
                </button>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-4">Tenant Health</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-600">Total:</span> <span className="font-semibold">{tenantHealth?.totalTenants || 0}</span></p>
                  <p><span className="text-gray-600">Active:</span> <span className="font-semibold">{tenantHealth?.activeTenants || 0}</span></p>
                  <p><span className="text-gray-600">At Risk:</span> <span className="font-semibold text-red-600">{tenantHealth?.atRisk || 0}</span></p>
                </div>
                <button className="w-full mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-semibold">
                  <Download className="w-4 h-4 inline mr-2" />
                  Download Report
                </button>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-4">Subscription Metrics</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-600">Active:</span> <span className="font-semibold">{subscriptions?.active || 0}</span></p>
                  <p><span className="text-gray-600">Churn Rate:</span> <span className="font-semibold">{subscriptions?.churnRate || 0}%</span></p>
                  <p><span className="text-gray-600">Renewal Rate:</span> <span className="font-semibold text-green-600">{subscriptions?.renewalRate || 0}%</span></p>
                </div>
                <button className="w-full mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-semibold">
                  <Download className="w-4 h-4 inline mr-2" />
                  Download Report
                </button>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-4">Upcoming Renewals</h3>
                <div className="space-y-2 text-xs">
                  {subscriptions?.upcomingRenewals?.slice(0, 3).map((renewal: any) => (
                    <div key={renewal.tenantId} className="p-2 bg-gray-50 rounded">
                      <p className="font-semibold text-gray-900">{renewal.tenantName}</p>
                      <p className="text-gray-600">{renewal.renewalDate} • ₹{(renewal.amount / 100000).toFixed(1)}L</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AUTOMATION */}
        {activeTab === 'automation' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4">Create New Rule</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Rule name"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Trigger (e.g., no_activity_30d)"
                  value={newRuleTrigger}
                  onChange={(e) => setNewRuleTrigger(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={createRule}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Create Rule
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4">Active Rules ({automationRules.length})</h3>
              <div className="space-y-3">
                {automationRules.map((rule: any) => (
                  <div key={rule.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{rule.name}</p>
                      <p className="text-sm text-gray-600">{rule.trigger} → {rule.action}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {rule.enabled ? (
                        <button className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200">
                          <Play className="w-4 h-4" />
                        </button>
                      ) : (
                        <button className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      <button className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* INTEGRATIONS */}
        {activeTab === 'integrations' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.map((integration: any) => (
              <div key={integration.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="text-4xl mb-3">{integration.icon}</div>
                <h3 className="font-bold text-gray-900 mb-1">{integration.name}</h3>
                <p className="text-sm text-gray-600 mb-4">{integration.description}</p>
                <button
                  className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors ${
                    integration.status === 'connected'
                      ? 'bg-green-50 text-green-600 hover:bg-green-100'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  {integration.status === 'connected' ? '✓ Connected' : 'Connect'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* COMPLIANCE */}
        {activeTab === 'compliance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {compliance && Object.entries(compliance).map(([framework, data]: any) => (
              <div key={framework} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 text-lg uppercase">{framework}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    data.status === 'compliant' ? 'bg-green-100 text-green-800' :
                    data.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {data.status}
                  </span>
                </div>
                <div className="space-y-2">
                  <p><span className="text-gray-600">Score:</span> <span className="font-semibold">{data.score}%</span></p>
                  <p className="text-sm text-gray-600">Last audit: {new Date(data.lastAudit).toLocaleDateString()}</p>
                </div>
                <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: `${data.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PERFORMANCE */}
        {activeTab === 'performance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {performance && (
              <>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <p className="text-sm text-gray-600">API Response Time</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{performance.apiResponseTime.average}ms</p>
                  <p className="text-xs text-gray-600 mt-2">P95: {performance.apiResponseTime.p95}ms</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <p className="text-sm text-gray-600">Cache Hit Rate</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{performance.cacheHitRate}%</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <p className="text-sm text-gray-600">Uptime</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{performance.uptime}%</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <p className="text-sm text-gray-600">CPU Usage</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{performance.cpu}%</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <p className="text-sm text-gray-600">Memory Usage</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{performance.memory}%</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <p className="text-sm text-gray-600">Error Rate</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{performance.errorRate}%</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* EXPORT */}
        {activeTab === 'export' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {['CSV', 'Excel', 'JSON', 'PDF'].map((format) => (
              <div key={format} className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <p className="text-lg font-semibold mb-4">{format} Export</p>
                <p className="text-sm text-gray-600 mb-6">Export all platform data in {format} format</p>
                <button
                  onClick={() => exportData(format.toLowerCase())}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  <Download className="w-4 h-4 inline mr-2" />
                  Export as {format}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
