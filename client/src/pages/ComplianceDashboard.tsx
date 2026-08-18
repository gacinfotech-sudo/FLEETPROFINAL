/**
 * COMPLIANCE DASHBOARD
 * Displays compliance status, audit logs, incidents, and compliance reports
 * Provides interfaces for data export, deletion, and consent management
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, TrendingUp, Download, Trash2, Eye } from 'lucide-react';

interface ComplianceStatus {
  gdprCompliant: boolean;
  dataProtectionReady: boolean;
  consentManagementReady: boolean;
  auditTrailComplete: boolean;
  lastComplianceCheck: string;
  issues: string[];
  recommendations: string[];
}

interface AuditLog {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  userName: string;
  timestamp: string;
  status: string;
  severity: string;
}

interface Incident {
  incidentId: string;
  title: string;
  severity: string;
  status: string;
  reportedAt: string;
  affectedUsers?: number;
}

interface ComplianceReport {
  reportId: string;
  reportType: string;
  generatedAt: string;
  score: number;
  findings: Array<{
    area: string;
    status: string;
  }>;
}

export default function ComplianceDashboard() {
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'incidents' | 'reports'>('overview');
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [dataRetentionDays, setDataRetentionDays] = useState(2555); // 7 years

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    setLoading(true);
    try {
      // Fetch compliance status
      const statusRes = await fetch('/api/compliance/status');
      if (statusRes.ok) {
        setComplianceStatus(await statusRes.json());
      }

      // Fetch audit logs
      const auditRes = await fetch('/api/audit/logs?limit=50');
      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLogs(data.logs || []);
      }

      // Fetch incidents
      const incidentRes = await fetch('/api/incidents?limit=20');
      if (incidentRes.ok) {
        setIncidents(await incidentRes.json());
      }

      // Fetch compliance reports
      const reportsRes = await fetch('/api/compliance/reports');
      if (reportsRes.ok) {
        setReports(await reportsRes.json());
      }
    } catch (error) {
      console.error('Error loading compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await fetch(`/api/compliance/data-export?format=${exportFormat}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `data-export-${Date.now()}.${exportFormat}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const handleDeleteData = async () => {
    if (!window.confirm('Are you sure? This will request deletion of your data (30-day grace period).')) {
      return;
    }

    try {
      const response = await fetch('/api/compliance/data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'User requested deletion' }),
      });

      if (response.ok) {
        alert('Data deletion requested. You will be notified when completed.');
      }
    } catch (error) {
      console.error('Error requesting data deletion:', error);
    }
  };

  const handleGenerateReport = async (reportType: string) => {
    try {
      const response = await fetch(`/api/compliance/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType }),
      });

      if (response.ok) {
        const newReport = await response.json();
        setReports([newReport, ...reports]);
        alert(`${reportType} report generated successfully!`);
      }
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Compliance Dashboard</h1>
          <p className="text-gray-600">Monitor and manage compliance status, audit trails, and incidents</p>
        </div>

        {/* Compliance Status Cards */}
        {complianceStatus && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <ComplianceCard
              title="GDPR Compliant"
              status={complianceStatus.gdprCompliant}
              icon={<CheckCircle />}
            />
            <ComplianceCard
              title="Data Protection"
              status={complianceStatus.dataProtectionReady}
              icon={<Lock />}
            />
            <ComplianceCard
              title="Consent Management"
              status={complianceStatus.consentManagementReady}
              icon={<FileCheck />}
            />
            <ComplianceCard
              title="Audit Trail"
              status={complianceStatus.auditTrailComplete}
              icon={<Eye />}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <button
              onClick={handleExportData}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              <Download className="w-4 h-4" />
              Export My Data
            </button>
            <button
              onClick={handleDeleteData}
              className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
            >
              <Trash2 className="w-4 h-4" />
              Request Data Deletion
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'overview'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'audit'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Audit Logs ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'incidents'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Incidents ({incidents.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'reports'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Reports ({reports.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow p-6">
          {activeTab === 'overview' && complianceStatus && (
            <OverviewTab status={complianceStatus} onGenerateReport={handleGenerateReport} />
          )}

          {activeTab === 'audit' && (
            <AuditTab logs={auditLogs} onRefresh={loadComplianceData} />
          )}

          {activeTab === 'incidents' && (
            <IncidentsTab incidents={incidents} />
          )}

          {activeTab === 'reports' && (
            <ReportsTab reports={reports} />
          )}
        </div>
      </div>
    </div>
  );
}

function ComplianceCard({
  title,
  status,
  icon,
}: {
  title: string;
  status: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className={`p-6 rounded-lg shadow ${status ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className={`text-lg font-semibold ${status ? 'text-green-700' : 'text-red-700'}`}>
            {status ? 'Compliant' : 'Non-Compliant'}
          </p>
        </div>
        <div className={`w-8 h-8 ${status ? 'text-green-600' : 'text-red-600'}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  status,
  onGenerateReport,
}: {
  status: ComplianceStatus;
  onGenerateReport: (type: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Issues */}
      {status.issues.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Outstanding Issues
          </h3>
          <ul className="space-y-2">
            {status.issues.map((issue, idx) => (
              <li key={idx} className="text-red-700 bg-red-50 p-3 rounded">
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {status.recommendations.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Recommendations
          </h3>
          <ul className="space-y-2">
            {status.recommendations.map((rec, idx) => (
              <li key={idx} className="text-blue-700 bg-blue-50 p-3 rounded">
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Generate Reports */}
      <div>
        <h3 className="font-semibold text-lg mb-3">Generate Compliance Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {['GDPR', 'SOC2', 'ISO27001', 'PCI_DSS'].map((type) => (
            <button
              key={type}
              onClick={() => onGenerateReport(type)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
            >
              Generate {type} Report
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm text-gray-600">
          Last checked: {new Date(status.lastComplianceCheck).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function AuditTab({ logs, onRefresh }: { logs: AuditLog[]; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <button
        onClick={onRefresh}
        className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
      >
        Refresh
      </button>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-4">Time</th>
              <th className="text-left py-2 px-4">User</th>
              <th className="text-left py-2 px-4">Action</th>
              <th className="text-left py-2 px-4">Entity</th>
              <th className="text-left py-2 px-4">Severity</th>
              <th className="text-left py-2 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="py-2 px-4">{log.userName}</td>
                <td className="py-2 px-4">{log.action}</td>
                <td className="py-2 px-4">{log.entityType}</td>
                <td className="py-2 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    log.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                    log.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                    log.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {log.severity}
                  </span>
                </td>
                <td className="py-2 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    log.status === 'SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncidentsTab({ incidents }: { incidents: Incident[] }) {
  return (
    <div className="space-y-4">
      {incidents.length === 0 ? (
        <p className="text-gray-600">No incidents reported.</p>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <div key={incident.incidentId} className="border rounded p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-900">{incident.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">ID: {incident.incidentId}</p>
                  <p className="text-sm text-gray-600">Reported: {new Date(incident.reportedAt).toLocaleString()}</p>
                  {incident.affectedUsers && (
                    <p className="text-sm text-gray-600">Affected Users: {incident.affectedUsers}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded text-xs font-semibold ${
                    incident.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                    incident.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                    incident.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {incident.severity}
                  </span>
                  <p className="text-xs font-semibold mt-2">{incident.status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportsTab({ reports }: { reports: ComplianceReport[] }) {
  return (
    <div className="space-y-4">
      {reports.length === 0 ? (
        <p className="text-gray-600">No compliance reports generated yet.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.reportId} className="border rounded p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-900">{report.reportType} Compliance Report</h4>
                  <p className="text-sm text-gray-600">Generated: {new Date(report.generatedAt).toLocaleDateString()}</p>
                  <div className="mt-2 text-sm">
                    <span className="font-semibold">Compliant Areas:</span>
                    <span className="ml-2">{report.findings.filter(f => f.status === 'COMPLIANT').length}/{report.findings.length}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{report.score}%</div>
                  <p className="text-xs text-gray-600">Compliance Score</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Icon components
function Lock() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm6-10V7a2 2 0 00-2-2H7a2 2 0 00-2 2v4m11-1h.01M7 9h.01" /></svg>;
}

function FileCheck() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
