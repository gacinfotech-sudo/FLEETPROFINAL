import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Check, X, Clock, AlertCircle, MessageSquare, Filter } from 'lucide-react';

interface PendingApproval {
  _id: string;
  templateId: string;
  versionNumber: number;
  status: string;
  submittedBy: string;
  submittedAt: string;
  requiresApproval: boolean;
  templateName?: string;
  messageType?: string;
}

export default function WhatsAppApprovalQueue() {
  const [, navigate] = useLocation();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [requestedChanges, setRequestedChanges] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending'>('pending');

  useEffect(() => {
    fetchPendingApprovals();
  }, [filterStatus]);

  const fetchPendingApprovals = async () => {
    try {
      const response = await fetch(`/api/tenant/whatsapp-approvals/pending?status=${filterStatus}`);
      if (!response.ok) throw new Error('Failed to fetch approvals');
      const data = await response.json();
      setApprovals(data);
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApproval) return;
    setReviewing(true);

    try {
      const response = await fetch(
        `/api/tenant/whatsapp-templates/${selectedApproval.templateId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            versionNumber: selectedApproval.versionNumber,
            approvalNotes: reviewNotes,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to approve');
      await fetchPendingApprovals();
      setSelectedApproval(null);
      setReviewNotes('');
      alert('Template approved!');
    } catch (error) {
      console.error('Error approving template:', error);
      alert('Failed to approve template');
    } finally {
      setReviewing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    setReviewing(true);

    try {
      const response = await fetch(
        `/api/tenant/whatsapp-templates/${selectedApproval.templateId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            versionNumber: selectedApproval.versionNumber,
            rejectionReason: reviewNotes,
            requestedChanges: requestedChanges
              .split('\n')
              .filter((c) => c.trim())
              .map((c) => c.trim()),
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to reject');
      await fetchPendingApprovals();
      setSelectedApproval(null);
      setReviewNotes('');
      setRequestedChanges('');
      alert('Template rejected with feedback');
    } catch (error) {
      console.error('Error rejecting template:', error);
      alert('Failed to reject template');
    } finally {
      setReviewing(false);
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Approval Queue</h1>
          <p className="text-slate-600">Review and approve pending template changes</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          {(['pending'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {status === 'pending' && `⏳ Pending (${approvals.length})`}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-6">
          {/* Approval List */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Templates Awaiting Review</h2>
              {approvals.length === 0 ? (
                <div className="text-center py-8 text-slate-600">
                  <Clock size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No pending approvals</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {approvals.map((approval) => (
                    <button
                      key={approval._id}
                      onClick={() => setSelectedApproval(approval)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedApproval?._id === approval._id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{approval.templateName || 'Template'}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        v{approval.versionNumber} • {approval.messageType}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        by {approval.submittedBy?.split('@')[0]}
                      </div>
                      <div className="text-xs text-orange-600 mt-2 font-bold">PENDING REVIEW</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Review Panel */}
          {selectedApproval ? (
            <div className="col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      {selectedApproval.templateName || 'Template Review'}
                    </h2>
                    <p className="text-slate-600 mt-1">v{selectedApproval.versionNumber}</p>
                  </div>
                  <span className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-bold">PENDING</span>
                </div>

                {/* Submission Info */}
                <div className="mb-6 p-4 bg-slate-50 border-l-4 border-blue-500 rounded">
                  <div className="text-sm text-slate-700">
                    <div>
                      <strong>Submitted by:</strong> {selectedApproval.submittedBy}
                    </div>
                    <div>
                      <strong>Submitted at:</strong>{' '}
                      {new Date(selectedApproval.submittedAt).toLocaleString()}
                    </div>
                    <div>
                      <strong>Message Type:</strong> {selectedApproval.messageType}
                    </div>
                  </div>
                </div>

                {/* Review Form */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-900 mb-2 block">
                      Review Notes
                    </label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add your feedback or approval notes..."
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-900 mb-2 block">
                      Requested Changes (one per line)
                    </label>
                    <textarea
                      value={requestedChanges}
                      onChange={(e) => setRequestedChanges(e.target.value)}
                      placeholder="List any changes you'd like to see..."
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={handleApprove}
                      disabled={reviewing}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 font-medium"
                    >
                      <Check size={18} />
                      Approve Template
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={reviewing}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-400 font-medium"
                    >
                      <X size={18} />
                      Reject & Request Changes
                    </button>
                  </div>
                </div>
              </div>

              {/* Approval Guidelines */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <AlertCircle size={18} />
                  Approval Checklist
                </h3>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li>✓ Verify variables are correctly formatted ({{variable}})</li>
                  <li>✓ Check grammar and tone are appropriate</li>
                  <li>✓ Ensure message length is reasonable</li>
                  <li>✓ Verify personalization and customization</li>
                  <li>✓ Check compliance with brand guidelines</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="col-span-2 bg-white rounded-lg shadow-md p-12 flex flex-col items-center justify-center">
              <MessageSquare size={48} className="text-slate-300 mb-4" />
              <p className="text-slate-600 text-lg">Select a template to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
