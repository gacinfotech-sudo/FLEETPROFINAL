import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Copy,
  Eye,
  RotateCcw,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Version {
  versionNumber: number;
  isLatest: boolean;
  name: string;
  body: string;
  status: string;
  changesSummary: string;
  changedBy: string;
  changedAt: string;
}

interface AuditEntry {
  action: string;
  versionNumber?: number;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  changedBy: string;
  changedAt: string;
  reason: string;
}

interface Comparison {
  differences: Record<string, { old: any; new: any }>;
}

export default function WhatsAppTemplateHistory() {
  const params = useParams();
  const templateId = params?.templateId;

  const [versions, setVersions] = useState<Version[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [compareWithVersion, setCompareWithVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'history' | 'audit' | 'compare'>('history');

  useEffect(() => {
    if (templateId) {
      fetchVersionHistory();
      fetchAuditTrail();
    }
  }, [templateId]);

  const fetchVersionHistory = async () => {
    try {
      const response = await fetch(`/api/tenant/whatsapp-templates/${templateId}/versions`);
      if (!response.ok) throw new Error('Failed to fetch versions');
      const data = await response.json();
      setVersions(data);
      if (data.length > 0) setSelectedVersion(data[0]);
    } catch (error) {
      console.error('Error fetching versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditTrail = async () => {
    try {
      const response = await fetch(`/api/tenant/whatsapp-templates/${templateId}/audit`);
      if (!response.ok) throw new Error('Failed to fetch audit trail');
      const data = await response.json();
      setAuditTrail(data);
    } catch (error) {
      console.error('Error fetching audit trail:', error);
    }
  };

  const handleCompare = async (versionNum: number) => {
    if (!selectedVersion) return;

    try {
      const response = await fetch(
        `/api/tenant/whatsapp-templates/${templateId}/compare?version1=${selectedVersion.versionNumber}&version2=${versionNum}`
      );
      if (!response.ok) throw new Error('Failed to compare versions');
      const data = await response.json();
      setComparison(data);
      setCompareWithVersion(versionNum);
      setViewMode('compare');
    } catch (error) {
      console.error('Error comparing versions:', error);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    if (!confirm(`Restore template to version ${versionNumber}?`)) return;

    setRestoring(true);
    try {
      const response = await fetch(
        `/api/tenant/whatsapp-templates/${templateId}/restore`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionNumber }),
        }
      );

      if (!response.ok) throw new Error('Failed to restore version');

      // Refresh data
      await fetchVersionHistory();
      await fetchAuditTrail();
      alert('Template restored successfully!');
    } catch (error) {
      console.error('Error restoring version:', error);
      alert('Failed to restore version');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Template Version History</h1>
          <p className="text-slate-600">View, compare, and restore template versions</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          {['history', 'audit', 'compare'].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as typeof viewMode)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {mode === 'history' && '📋 Version History'}
              {mode === 'audit' && '📝 Audit Trail'}
              {mode === 'compare' && '🔀 Compare'}
            </button>
          ))}
        </div>

        {/* Version History View */}
        {viewMode === 'history' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Versions List */}
            <div className="col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Versions ({versions.length})</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {versions.map((v) => (
                    <button
                      key={v.versionNumber}
                      onClick={() => setSelectedVersion(v)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedVersion?.versionNumber === v.versionNumber
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">v{v.versionNumber}</div>
                          <div className="text-xs text-slate-500">{v.name}</div>
                          {v.isLatest && (
                            <div className="text-xs font-bold text-green-600 mt-1">LATEST</div>
                          )}
                        </div>
                        {v.status === 'active' && (
                          <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Active</div>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 mt-2">
                        {new Date(v.changedAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Version Details */}
            {selectedVersion && (
              <div className="col-span-2 space-y-6">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{selectedVersion.name}</h2>
                      <p className="text-slate-600 mt-1">Version {selectedVersion.versionNumber}</p>
                    </div>
                    <span className={`px-4 py-2 rounded-lg font-medium ${
                      selectedVersion.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {selectedVersion.status}
                    </span>
                  </div>

                  {selectedVersion.changesSummary && (
                    <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                      <p className="text-sm text-blue-900">
                        <strong>Changes:</strong> {selectedVersion.changesSummary}
                      </p>
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={16} className="text-slate-600" />
                      <span className="text-sm text-slate-600">
                        Changed by {selectedVersion.changedBy} on{' '}
                        {new Date(selectedVersion.changedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Message Body</h3>
                    <pre className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 overflow-x-auto font-mono whitespace-pre-wrap break-words">
                      {selectedVersion.body}
                    </pre>
                  </div>

                  <div className="mt-6 flex gap-3">
                    {!selectedVersion.isLatest && (
                      <button
                        onClick={() => handleRestore(selectedVersion.versionNumber)}
                        disabled={restoring}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
                      >
                        <RotateCcw size={16} />
                        Restore This Version
                      </button>
                    )}
                    <button
                      onClick={() => handleCompare(selectedVersion.versionNumber)}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      <Eye size={16} />
                      Compare
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audit Trail View */}
        {viewMode === 'audit' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Audit Trail ({auditTrail.length})</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {auditTrail.map((entry, idx) => (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded text-xs font-bold ${
                        entry.action === 'created' ? 'bg-green-100 text-green-700' :
                        entry.action === 'updated' ? 'bg-blue-100 text-blue-700' :
                        entry.action === 'restored' ? 'bg-purple-100 text-purple-700' :
                        entry.action === 'deleted' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {entry.action.toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-900">{entry.reason}</span>
                    </div>
                    <span className="text-xs text-slate-600">
                      {new Date(entry.changedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">
                    by {entry.changedBy}
                    {entry.versionNumber && ` • v${entry.versionNumber}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compare View */}
        {viewMode === 'compare' && comparison && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6">
              Comparing v{selectedVersion?.versionNumber} ↔ v{compareWithVersion}
            </h2>

            {Object.entries(comparison.differences).length === 0 ? (
              <div className="text-center py-8 text-slate-600">No differences found between versions</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(comparison.differences).map(([field, diff]) => (
                  <div key={field} className="border border-slate-200 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3 capitalize">{field}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-bold text-red-600 mb-2">Previous (v{selectedVersion?.versionNumber})</div>
                        <pre className="bg-red-50 p-3 rounded text-xs text-red-900 overflow-x-auto font-mono">
                          {typeof diff.old === 'string' ? diff.old : JSON.stringify(diff.old, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-green-600 mb-2">Current (v{compareWithVersion})</div>
                        <pre className="bg-green-50 p-3 rounded text-xs text-green-900 overflow-x-auto font-mono">
                          {typeof diff.new === 'string' ? diff.new : JSON.stringify(diff.new, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
