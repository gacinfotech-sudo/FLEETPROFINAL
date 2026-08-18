import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Shield, AlertCircle, CheckCircle, Lock, Eye, Download, TrendingUp, AlertTriangle, FileText, Zap } from 'lucide-react';

interface ComplianceCheckpoint {
  id: string;
  name: string;
  category: string;
  status: 'Compliant' | 'Non-Compliant' | 'In Progress' | 'N/A';
  requirement: string;
  deadline?: string;
  evidence?: string;
}

interface Vulnerability {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  affectedComponent: string;
  discoveredDate: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  remediation: string;
}

interface TenantCompliance {
  tenantId: string;
  tenantName: string;
  gdprScore: number;
  soc2Score: number;
  iso27001Score: number;
  overallScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  lastAudit: string;
  dataResidency: string;
  encryption: boolean;
  backupStatus: string;
}

interface SecurityMetric {
  month: string;
  violations: number;
  resolved: number;
  pendingReview: number;
}

interface DataLocation {
  region: string;
  tenants: number;
  dataVolume: string;
  compliance: string[];
}

export default function ComplianceSecurityDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFramework, setSelectedFramework] = useState('gdpr');
  const [selectedTenant, setSelectedTenant] = useState<TenantCompliance | null>(null);

  // GDPR Compliance Checklist
  const gdprCheckpoints: ComplianceCheckpoint[] = [
    { id: 'gdpr_1', name: 'Data Processing Agreement (DPA)', category: 'Contractual', status: 'Compliant', requirement: 'Must have signed DPA with all tenants', evidence: 'Signed 2026-02-15' },
    { id: 'gdpr_2', name: 'Privacy Policy', category: 'Documentation', status: 'Compliant', requirement: 'Privacy policy must be clear and accessible', evidence: 'Updated 2026-08-01' },
    { id: 'gdpr_3', name: 'Data Subject Rights Portal', category: 'Technical', status: 'Compliant', requirement: 'Implement GDPR data subject request feature', evidence: 'Deployed v2.1' },
    { id: 'gdpr_4', name: 'Data Retention Policy', category: 'Policy', status: 'In Progress', requirement: '30-day deletion policy after account termination', deadline: '2026-09-15' },
    { id: 'gdpr_5', name: 'Consent Management', category: 'Technical', status: 'Compliant', requirement: 'Opt-in/out tracking with audit logs', evidence: 'Implemented' },
    { id: 'gdpr_6', name: 'Data Transfer Impact Assessment', category: 'Legal', status: 'Compliant', requirement: 'DPIA completed for all data transfers', evidence: 'Completed 2026-06-20' },
    { id: 'gdpr_7', name: 'Incident Response Plan', category: 'Policy', status: 'Compliant', requirement: '72-hour breach notification procedure', evidence: 'Plan v3.2' },
    { id: 'gdpr_8', name: 'Data Processing Records', category: 'Documentation', status: 'Compliant', requirement: 'Maintain records of processing activities', evidence: 'Automated logging' },
  ];

  // SOC2 Compliance
  const soc2Checkpoints: ComplianceCheckpoint[] = [
    { id: 'soc2_1', name: 'Access Controls', category: 'Security', status: 'Compliant', requirement: 'Enforce RBAC and MFA', evidence: 'Implemented' },
    { id: 'soc2_2', name: 'Encryption at Rest', category: 'Security', status: 'Compliant', requirement: 'AES-256 encryption for all data', evidence: 'AWS KMS enabled' },
    { id: 'soc2_3', name: 'Encryption in Transit', category: 'Security', status: 'Compliant', requirement: 'TLS 1.3 for all communication', evidence: 'SSL/TLS configured' },
    { id: 'soc2_4', name: 'Audit Logging', category: 'Monitoring', status: 'Compliant', requirement: 'Complete audit trail of all actions', evidence: 'Elasticsearch + Kibana' },
    { id: 'soc2_5', name: 'Availability & Performance', category: 'Operations', status: 'Compliant', requirement: '99.9% uptime SLA', evidence: '99.95% actual' },
    { id: 'soc2_6', name: 'Incident Management', category: 'Operations', status: 'In Progress', requirement: 'Documented incident response procedures', deadline: '2026-10-01' },
    { id: 'soc2_7', name: 'Configuration Management', category: 'Operations', status: 'Compliant', requirement: 'Change management process', evidence: 'Git-based' },
    { id: 'soc2_8', name: 'Penetration Testing', category: 'Security', status: 'Compliant', requirement: 'Annual pen test by third party', evidence: 'Last: 2026-07-15' },
  ];

  // ISO27001 Compliance
  const iso27001Checkpoints: ComplianceCheckpoint[] = [
    { id: 'iso_1', name: 'Information Security Policy', category: 'Policy', status: 'Compliant', requirement: 'Documented info security policy', evidence: 'v4.1 approved' },
    { id: 'iso_2', name: 'Risk Assessment', category: 'Assessment', status: 'Compliant', requirement: 'Annual risk assessment', evidence: 'Completed Aug 2026' },
    { id: 'iso_3', name: 'Access Control', category: 'Technical', status: 'Compliant', requirement: 'Role-based access control', evidence: 'RBAC implemented' },
    { id: 'iso_4', name: 'Cryptography', category: 'Technical', status: 'Compliant', requirement: 'Cryptographic controls', evidence: 'AES-256, SHA-256' },
    { id: 'iso_5', name: 'Physical Security', category: 'Physical', status: 'Compliant', requirement: 'Data center physical controls', evidence: 'AWS compliance' },
    { id: 'iso_6', name: 'Incident Management', category: 'Operations', status: 'Compliant', requirement: 'Incident response procedure', evidence: 'Runbook v2.0' },
    { id: 'iso_7', name: 'Business Continuity', category: 'Operations', status: 'In Progress', requirement: 'Disaster recovery plan', deadline: '2026-11-30' },
    { id: 'iso_8', name: 'Third-party Management', category: 'Risk', status: 'Compliant', requirement: 'Vendor security assessment', evidence: 'Evaluated 8/10 vendors' },
  ];

  // Vulnerabilities
  const vulnerabilities: Vulnerability[] = [
    { id: 'vuln_1', title: 'SQL Injection in tenant search API', severity: 'Critical', affectedComponent: 'Search Service', discoveredDate: '2026-08-10', status: 'Resolved', remediation: 'Parameterized queries implemented' },
    { id: 'vuln_2', title: 'XSS in custom report builder', severity: 'High', affectedComponent: 'Report Module', discoveredDate: '2026-08-12', status: 'In Progress', remediation: 'DOMPurify integration in progress' },
    { id: 'vuln_3', title: 'Missing rate limiting on login endpoint', severity: 'High', affectedComponent: 'Auth Service', discoveredDate: '2026-08-08', status: 'Resolved', remediation: 'Redis-based rate limiting added' },
    { id: 'vuln_4', title: 'Weak password requirements', severity: 'Medium', affectedComponent: 'User Service', discoveredDate: '2026-08-14', status: 'Resolved', remediation: 'Updated to 12+ char requirement' },
    { id: 'vuln_5', title: 'Missing CORS headers on API', severity: 'Medium', affectedComponent: 'API Gateway', discoveredDate: '2026-08-11', status: 'In Progress', remediation: 'CORS policy configuration' },
  ];

  // Tenant compliance data
  const tenantCompliance: TenantCompliance[] = [
    { tenantId: 'tenant_001', tenantName: 'Acme Corp', gdprScore: 92, soc2Score: 89, iso27001Score: 88, overallScore: 90, riskLevel: 'Low', lastAudit: '2026-08-15', dataResidency: 'EU (Ireland)', encryption: true, backupStatus: 'Daily backups' },
    { tenantId: 'tenant_002', tenantName: 'TechStart Inc', gdprScore: 78, soc2Score: 81, iso27001Score: 79, overallScore: 79, riskLevel: 'Medium', lastAudit: '2026-07-20', dataResidency: 'US (Virginia)', encryption: true, backupStatus: 'Daily backups' },
    { tenantId: 'tenant_003', tenantName: 'Global Solutions', gdprScore: 65, soc2Score: 72, iso27001Score: 68, overallScore: 68, riskLevel: 'High', lastAudit: '2026-06-10', dataResidency: 'US (Ohio)', encryption: false, backupStatus: 'Weekly backups' },
    { tenantId: 'tenant_004', tenantName: 'Digital Pro', gdprScore: 88, soc2Score: 90, iso27001Score: 87, overallScore: 88, riskLevel: 'Low', lastAudit: '2026-08-14', dataResidency: 'EU (Frankfurt)', encryption: true, backupStatus: 'Daily backups' },
    { tenantId: 'tenant_005', tenantName: 'Cloud Systems', gdprScore: 81, soc2Score: 84, iso27001Score: 82, overallScore: 82, riskLevel: 'Low', lastAudit: '2026-08-13', dataResidency: 'US (Virginia)', encryption: true, backupStatus: 'Daily backups' },
  ];

  // Security metrics over time
  const securityMetrics: SecurityMetric[] = [
    { month: 'May', violations: 12, resolved: 10, pendingReview: 2 },
    { month: 'June', violations: 8, resolved: 7, pendingReview: 1 },
    { month: 'July', violations: 15, resolved: 14, pendingReview: 1 },
    { month: 'August', violations: 5, resolved: 5, pendingReview: 0 },
  ];

  // Data locations
  const dataLocations: DataLocation[] = [
    { region: 'EU (Ireland)', tenants: 2, dataVolume: '245 GB', compliance: ['GDPR', 'SOC2', 'ISO27001'] },
    { region: 'US (Virginia)', tenants: 2, dataVolume: '312 GB', compliance: ['SOC2', 'ISO27001'] },
    { region: 'US (Ohio)', tenants: 1, dataVolume: '156 GB', compliance: ['SOC2'] },
    { region: 'EU (Frankfurt)', tenants: 1, dataVolume: '198 GB', compliance: ['GDPR', 'SOC2', 'ISO27001'] },
  ];

  const getComplianceColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border border-green-300';
    if (score >= 75) return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    return 'bg-red-100 text-red-800 border border-red-300';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low':
        return 'bg-green-50 border border-green-300';
      case 'Medium':
        return 'bg-yellow-50 border border-yellow-300';
      case 'High':
        return 'bg-orange-50 border border-orange-300';
      case 'Critical':
        return 'bg-red-50 border border-red-300';
      default:
        return 'bg-gray-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'text-red-700 bg-red-100';
      case 'High':
        return 'text-orange-700 bg-orange-100';
      case 'Medium':
        return 'text-yellow-700 bg-yellow-100';
      case 'Low':
        return 'text-blue-700 bg-blue-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getCheckpointIcon = (status: string) => {
    switch (status) {
      case 'Compliant':
        return <CheckCircle size={18} className="text-green-600" />;
      case 'Non-Compliant':
        return <AlertTriangle size={18} className="text-red-600" />;
      case 'In Progress':
        return <Zap size={18} className="text-yellow-600" />;
      default:
        return <Eye size={18} className="text-gray-600" />;
    }
  };

  const frameworkCheckpoints =
    selectedFramework === 'gdpr' ? gdprCheckpoints : selectedFramework === 'soc2' ? soc2Checkpoints : iso27001Checkpoints;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Shield size={32} className="text-blue-600" />
            Compliance & Security Dashboard
          </h1>
          <p className="text-gray-600">GDPR, SOC2, ISO27001 compliance tracking, vulnerability management & security posture</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg shadow p-6 border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Platform Compliance Score</p>
                <p className="text-3xl font-bold text-green-700 mt-2">85.4%</p>
              </div>
              <Shield size={32} className="text-green-600" />
            </div>
            <p className="text-xs text-gray-600 mt-3">↑ 2.3% from last month</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow p-6 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Vulnerabilities</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">2</p>
              </div>
              <AlertCircle size={32} className="text-orange-500" />
            </div>
            <p className="text-xs text-gray-600 mt-3">1 High, 1 Medium priority</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg shadow p-6 border-2 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Tenants Audited</p>
                <p className="text-3xl font-bold text-purple-700 mt-2">5/5</p>
              </div>
              <FileText size={32} className="text-purple-600" />
            </div>
            <p className="text-xs text-gray-600 mt-3">Last 30 days</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow p-6 border-2 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Risk Level</p>
                <p className="text-3xl font-bold text-yellow-700 mt-2">Low</p>
              </div>
              <TrendingUp size={32} className="text-yellow-600" />
            </div>
            <p className="text-xs text-gray-600 mt-3">3 Low, 1 Medium risk</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg shadow p-6 border-2 border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Data Residency</p>
                <p className="text-3xl font-bold text-indigo-700 mt-2">4</p>
              </div>
              <Lock size={32} className="text-indigo-600" />
            </div>
            <p className="text-xs text-gray-600 mt-3">Regions covered</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('frameworks')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'frameworks'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Frameworks
          </button>
          <button
            onClick={() => setActiveTab('vulnerabilities')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'vulnerabilities'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Vulnerabilities
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'tenants'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Tenant Compliance
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'locations'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Data Locations
          </button>
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Security Posture Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={securityMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="violations" stroke="#EF4444" strokeWidth={2} name="New Violations" />
                  <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} name="Resolved" />
                  <Line type="monotone" dataKey="pendingReview" stroke="#F59E0B" strokeWidth={2} name="Pending Review" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Platform Compliance Scores</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">GDPR Compliance</span>
                      <span className="text-sm font-bold text-green-600">82%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '82%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">SOC2 Compliance</span>
                      <span className="text-sm font-bold text-green-600">88%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '88%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">ISO27001 Compliance</span>
                      <span className="text-sm font-bold text-green-600">85%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Critical Actions Required</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
                    <p className="text-sm font-semibold text-red-900">🔴 XSS in Report Builder</p>
                    <p className="text-xs text-red-700 mt-1">High severity - DOMPurify integration in progress</p>
                  </div>
                  <div className="p-3 bg-orange-50 border-l-4 border-orange-500 rounded">
                    <p className="text-sm font-semibold text-orange-900">🟠 CORS Configuration Missing</p>
                    <p className="text-xs text-orange-700 mt-1">Medium severity - API endpoint headers</p>
                  </div>
                  <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                    <p className="text-sm font-semibold text-yellow-900">🟡 Data Retention Policy</p>
                    <p className="text-xs text-yellow-700 mt-1">GDPR - Due Sept 15 - 30-day deletion policy</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Frameworks */}
        {activeTab === 'frameworks' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setSelectedFramework('gdpr')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedFramework === 'gdpr'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  GDPR (General Data Protection)
                </button>
                <button
                  onClick={() => setSelectedFramework('soc2')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedFramework === 'soc2'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  SOC2 (Service Organization Control)
                </button>
                <button
                  onClick={() => setSelectedFramework('iso27001')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedFramework === 'iso27001'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ISO27001 (Information Security)
                </button>
              </div>

              <div className="space-y-3">
                {frameworkCheckpoints.map((checkpoint) => (
                  <div key={checkpoint.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="mt-1">{getCheckpointIcon(checkpoint.status)}</div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">{checkpoint.name}</h3>
                            <p className="text-xs text-gray-600 mt-1">{checkpoint.requirement}</p>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-bold rounded-full ${
                              checkpoint.status === 'Compliant'
                                ? 'bg-green-100 text-green-800'
                                : checkpoint.status === 'In Progress'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {checkpoint.status}
                          </span>
                        </div>

                        {checkpoint.evidence && (
                          <p className="text-sm text-green-700 mt-2">✓ Evidence: {checkpoint.evidence}</p>
                        )}
                        {checkpoint.deadline && (
                          <p className="text-sm text-yellow-700 mt-2">📅 Deadline: {checkpoint.deadline}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">Category: {checkpoint.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Vulnerabilities */}
        {activeTab === 'vulnerabilities' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Security Vulnerabilities</h2>
              <div className="space-y-4">
                {vulnerabilities.map((vuln) => (
                  <div
                    key={vuln.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      vuln.severity === 'Critical'
                        ? 'border-red-500 bg-red-50'
                        : vuln.severity === 'High'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-yellow-500 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{vuln.title}</h3>
                        <p className="text-sm text-gray-700 mt-1">Component: {vuln.affectedComponent}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${getSeverityColor(vuln.severity)}`}>
                          {vuln.severity}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            vuln.status === 'Resolved'
                              ? 'bg-green-200 text-green-800'
                              : 'bg-yellow-200 text-yellow-800'
                          }`}
                        >
                          {vuln.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">Discovered:</p>
                        <p className="text-sm text-gray-700">{vuln.discoveredDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">Remediation:</p>
                        <p className="text-sm text-gray-700">{vuln.remediation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tenant Compliance */}
        {activeTab === 'tenants' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Tenant Compliance Scorecard</h2>
              <div className="space-y-4">
                {tenantCompliance.map((tenant) => (
                  <div
                    key={tenant.tenantId}
                    onClick={() => setSelectedTenant(tenant)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${getRiskColor(tenant.riskLevel)} hover:shadow-lg`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{tenant.tenantName}</h3>
                        <p className="text-xs text-gray-600 mt-1">Last audit: {tenant.lastAudit}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-gray-900">{tenant.overallScore}</p>
                        <p className="text-xs text-gray-600">Overall Score</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-white bg-opacity-60 rounded p-3">
                        <p className="text-xs text-gray-600 font-semibold">GDPR</p>
                        <p className="text-2xl font-bold text-gray-900">{tenant.gdprScore}</p>
                      </div>
                      <div className="bg-white bg-opacity-60 rounded p-3">
                        <p className="text-xs text-gray-600 font-semibold">SOC2</p>
                        <p className="text-2xl font-bold text-gray-900">{tenant.soc2Score}</p>
                      </div>
                      <div className="bg-white bg-opacity-60 rounded p-3">
                        <p className="text-xs text-gray-600 font-semibold">ISO27001</p>
                        <p className="text-2xl font-bold text-gray-900">{tenant.iso27001Score}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Lock size={16} />
                      <span>{tenant.encryption ? '✅ Encrypted' : '❌ Not encrypted'}</span>
                      <span className="ml-4">📦 {tenant.backupStatus}</span>
                      <span className="ml-4">📍 {tenant.dataResidency}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tenant Detail Modal */}
            {selectedTenant && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow p-6 border-2 border-blue-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedTenant.tenantName} - Compliance Profile</h3>
                    <p className="text-gray-600 mt-1">Tenant ID: {selectedTenant.tenantId}</p>
                  </div>
                  <button
                    onClick={() => setSelectedTenant(null)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Overall Score</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedTenant.overallScore}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Risk Level</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedTenant.riskLevel}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Data Residency</p>
                    <p className="text-sm font-bold text-gray-900">{selectedTenant.dataResidency}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Encryption Status</p>
                    <p className="text-lg font-bold text-green-600">{selectedTenant.encryption ? '🔒 Enabled' : '🔓 Disabled'}</p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-bold text-gray-900 mb-3">Compliance Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Backup Status:</span>
                      <span className="font-semibold text-gray-900">{selectedTenant.backupStatus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Audit:</span>
                      <span className="font-semibold text-gray-900">{selectedTenant.lastAudit}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Locations */}
        {activeTab === 'locations' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Data Residency & Compliance by Region</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dataLocations.map((location) => (
                  <div key={location.region} className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-lg text-gray-900">{location.region}</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                        {location.tenants} tenant{location.tenants > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Data Volume:</span>
                        <span className="font-semibold text-gray-900">{location.dataVolume}</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-xs text-gray-600 font-semibold mb-2">Compliance Frameworks:</p>
                      <div className="flex flex-wrap gap-2">
                        {location.compliance.map((framework) => (
                          <span key={framework} className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                            ✓ {framework}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Global Data Distribution</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dataLocations.map((location) => (
                  <div key={location.region} className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 text-center border border-blue-200">
                    <p className="font-bold text-gray-900">{location.region}</p>
                    <p className="text-2xl font-bold text-blue-600 mt-2">{location.dataVolume}</p>
                    <p className="text-xs text-gray-600 mt-1">{location.tenants} tenant{location.tenants > 1 ? 's' : ''}</p>
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
