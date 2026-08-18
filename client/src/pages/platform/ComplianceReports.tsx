import React, { useEffect, useState } from 'react';
import { Download, AlertTriangle, CheckCircle, Shield, Search } from 'lucide-react';

interface ComplianceData {
  checks: Record<string, any>;
  score: string;
  status: string;
}

interface AuditLog {
  actor: string;
  action: string;
  status: string;
  createdAt: string;
}

export default function ComplianceReports() {
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityAudit, setSecurityAudit] = useState<any>(null);
  const [dataIntegrity, setDataIntegrity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [searchActor, setSearchActor] = useState('');

  useEffect(() => {
    fetchCompliance();
  }, [period]);

  const fetchCompliance = async () => {
    try {
      setLoading(true);
      const [checklistRes, auditRes, securityRes, integrityRes] = await Promise.all([
        fetch('/api/platform/compliance/checklist').then(r => r.json()),
        fetch(`/api/platform/compliance/audit-log?days=${period}`).then(r => r.json()),
        fetch(`/api/platform/compliance/security-audit?days=${period}`).then(r => r.json()),
        fetch('/api/platform/compliance/data-integrity').then(r => r.json())
      ]);

      setCompliance(checklistRes);
      setAuditLogs(auditRes.events || []);
      setSecurityAudit(securityRes);
      setDataIntegrity(integrityRes);
    } catch (error) {
      console.error('Failed to fetch compliance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const res = await fetch('/api/platform/compliance/report?format=json');
      const report = await res.json();
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  if (loading) return <div className="p-8">Loading compliance data...</div>;

  const complianceScore = parseInt(compliance?.score?.split('/')[0] || '0');
  const complianceTotal = parseInt(compliance?.score?.split('/')[1] || '5');
  const scorePercentage = (complianceScore / complianceTotal) * 100;

  const filteredAuditLogs = auditLogs.filter(log =>
    !searchActor || log.actor.toLowerCase().includes(searchActor.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Compliance & Auditing</h1>
            <p className="text-gray-600 mt-2">Security audit trails and compliance reports</p>
          </div>
          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Download Report
          </button>
        </div>

        {/* Compliance Score */}
        {compliance && (
          <div className="bg-white rounded-lg shadow p-8 mb-8">
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Compliance Score</h2>
                <p className="text-gray-600 mb-6">{compliance.status === 'compliant' ? 'All compliance checks passed ✅' : 'Some issues detected'}</p>

                <div className="space-y-2">
                  {Object.entries(compliance.checks).map(([key, check]: [string, any]) => (
                    <div key={key} className="flex items-center gap-3">
                      {check.status === 'pass' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{check.check}</p>
                        <p className="text-sm text-gray-600">{check.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-shrink-0">
                <div className="text-center">
                  <div className="w-32 h-32 rounded-full flex items-center justify-center border-4" style={{
                    borderColor: scorePercentage === 100 ? '#10b981' : scorePercentage >= 80 ? '#f59e0b' : '#ef4444'
                  }}>
                    <div className="text-center">
                      <p className="text-3xl font-bold" style={{
                        color: scorePercentage === 100 ? '#10b981' : scorePercentage >= 80 ? '#f59e0b' : '#ef4444'
                      }}>
                        {scorePercentage.toFixed(0)}%
                      </p>
                      <p className="text-sm text-gray-600">{compliance.score}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Audit */}
        {securityAudit && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security Audit
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Failed Operations</p>
                <p className="text-2xl font-bold text-red-600 mt-2">{securityAudit.failedOperations}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Sensitive Operations</p>
                <p className="text-2xl font-bold text-orange-600 mt-2">{securityAudit.sensitiveOperations}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Anomalous Patterns</p>
                <p className="text-2xl font-bold text-yellow-600 mt-2">{securityAudit.anomalousPatterns}</p>
              </div>
              <div className="p-4 rounded" style={{
                backgroundColor: securityAudit.riskLevel === 'low' ? '#dcfce7' :
                                securityAudit.riskLevel === 'medium' ? '#fef3c7' :
                                '#fee2e2'
              }}>
                <p className="text-sm text-gray-600">Risk Level</p>
                <p className="text-2xl font-bold mt-2" style={{
                  color: securityAudit.riskLevel === 'low' ? '#16a34a' :
                         securityAudit.riskLevel === 'medium' ? '#ca8a04' :
                         '#dc2626'
                }}>
                  {securityAudit.riskLevel?.toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Data Integrity */}
        {dataIntegrity && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Integrity</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">Collections</p>
                <div className="space-y-1 text-sm">
                  <p>Subscriptions: {dataIntegrity.collections.subscriptions}</p>
                  <p>Invoices: {dataIntegrity.collections.invoices}</p>
                  <p>Payments: {dataIntegrity.collections.payments}</p>
                  <p>Tickets: {dataIntegrity.collections.tickets}</p>
                  <p>Audit Logs: {dataIntegrity.collections.auditLogs}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Integrity Status</p>
                <div className="flex items-center gap-2">
                  {dataIntegrity.integrity.status === 'healthy' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className="font-medium">{dataIntegrity.integrity.status}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Orphaned Records</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dataIntegrity.integrity.orphanedPayments}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Audit Log */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-gray-900">Audit Log ({period} days)</h3>
              <select
                value={period}
                onChange={(e) => setPeriod(parseInt(e.target.value))}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
          </div>

          <div className="p-6 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by actor..."
                value={searchActor}
                onChange={(e) => setSearchActor(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Timestamp</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actor</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.slice(0, 20).map((log, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">
                          {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{log.actor}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{log.action}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
