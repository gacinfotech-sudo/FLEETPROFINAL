import { useState, useEffect } from 'react';
import { Search, Download, Filter, Clock, User, AlertCircle, CheckCircle, Eye, Trash2, Shield } from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin-layout';

interface AuditLog {
  _id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  status: 'success' | 'failed' | 'attempted';
  ipAddress: string;
  userAgent: string;
  changes?: Record<string, any>;
  result?: any;
  timestamp: string;
  duration: number;
  riskScore: number;
}

interface ActivityStats {
  totalActions: number;
  failedAttempts: number;
  highRiskActions: number;
  activeUsers: number;
  topUser: string;
  topAction: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('24h');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const actions = [
    'user.login',
    'user.logout',
    'user.created',
    'user.updated',
    'user.deleted',
    'tenant.created',
    'tenant.updated',
    'tenant.deleted',
    'plan.created',
    'plan.updated',
    'plan.deleted',
    'settings.changed',
    'webhook.tested',
    'api_key.generated',
    'api_key.deleted',
  ];

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchLogs() {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/audit-logs?limit=100`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setLogs(Array.isArray(data) ? data : data.logs || []);

        // Calculate stats
        const stats = {
          totalActions: data.length || 0,
          failedAttempts: (data || []).filter((l: any) => l.status === 'failed').length,
          highRiskActions: (data || []).filter((l: any) => l.riskScore > 7).length,
          activeUsers: new Set((data || []).map((l: any) => l.userId)).size,
          topUser: (data || []).length > 0 ? (data || [])[0].userName : 'N/A',
          topAction: (data || []).length > 0 ? (data || [])[0].action : 'N/A',
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function exportLogs() {
    try {
      const response = await fetch('/api/admin/audit-logs/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ format: 'csv' }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString()}.csv`;
        a.click();
      }
    } catch (error) {
      alert('Error exporting logs');
    }
  }

  async function deleteOldLogs() {
    if (!confirm('Delete logs older than 90 days? This cannot be undone.')) return;

    try {
      await fetch('/api/admin/audit-logs/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ days: 90 }),
      });
      await fetchLogs();
      alert('Old logs deleted successfully!');
    } catch (error) {
      alert('Error deleting logs');
    }
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.resourceId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUser = filterUser === 'all' || log.userId === filterUser;
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesStatus = filterStatus === 'all' || log.status === filterStatus;
    return matchesSearch && matchesUser && matchesAction && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (status === 'failed') return <AlertCircle className="w-4 h-4 text-red-600" />;
    return <Eye className="w-4 h-4 text-yellow-600" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'success') return 'bg-green-100 text-green-800';
    if (status === 'failed') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getRiskColor = (score: number) => {
    if (score >= 8) return 'bg-red-100 text-red-800';
    if (score >= 5) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🔍 Audit Logs & Activity Tracking</h1>
          <p className="text-gray-600">Monitor all system activities, user actions, and security events</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatCard label="Total Actions" value={stats.totalActions} icon="📊" />
            <StatCard label="Failed Attempts" value={stats.failedAttempts} icon="❌" color="red" />
            <StatCard label="High Risk" value={stats.highRiskActions} icon="⚠️" color="orange" />
            <StatCard label="Active Users" value={stats.activeUsers} icon="👥" />
            <StatCard label="Top Action" value={stats.topAction} icon="🔝" />
          </div>
        )}

        {/* Filters & Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search user, action, resource..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Actions</option>
              {actions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="attempted">Attempted</option>
            </select>
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <button
              onClick={exportLogs}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterStatus('failed')}
              className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm hover:bg-red-200"
            >
              🔴 Failed Only
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm hover:bg-gray-200"
            >
              Show All
            </button>
            <button
              onClick={deleteOldLogs}
              className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm hover:bg-orange-200"
            >
              🗑️ Cleanup
            </button>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading audit logs...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">User</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Resource</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Risk</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Time</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No audit logs found
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{log.userName}</p>
                            <p className="text-xs text-gray-500">{log.ipAddress}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{log.action}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <code className="bg-gray-100 px-2 py-1 rounded">{log.resourceId}</code>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(log.status)}`}>
                              {log.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRiskColor(log.riskScore)}`}>
                            {log.riskScore}/10
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(log.timestamp).toLocaleString('en-IN')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => { setSelectedLog(log); setShowDetails(true); }}
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetails && selectedLog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                <h2 className="text-2xl font-bold text-gray-900">Activity Details</h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">User</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedLog.userName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Action</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedLog.action}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Status</p>
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedLog.status)}`}>
                      {getStatusIcon(selectedLog.status)}
                      {selectedLog.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Risk Score</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getRiskColor(selectedLog.riskScore)}`}>
                      {selectedLog.riskScore}/10
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">IP Address</p>
                    <p className="text-lg font-mono text-gray-900">{selectedLog.ipAddress}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Duration</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedLog.duration}ms</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Resource</p>
                    <p className="text-lg font-mono text-gray-900 break-all">{selectedLog.resourceId}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Timestamp</p>
                    <p className="text-lg font-semibold text-gray-900">{new Date(selectedLog.timestamp).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600 mb-2">Changes</p>
                    <pre className="text-xs overflow-auto bg-gray-100 p-2 rounded">
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.result && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600 mb-2">Result</p>
                    <pre className="text-xs overflow-auto bg-gray-100 p-2 rounded">
                      {JSON.stringify(selectedLog.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 p-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}

function StatCard({ label, value, icon, color = 'default' }: any) {
  const colorClass = color === 'red' ? 'text-red-600' : color === 'orange' ? 'text-orange-600' : 'text-blue-600';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-2xl mt-2">{icon}</p>
    </div>
  );
}
