import React, { useEffect, useState } from 'react';
import { Save, Trash2, Plus, Mail, User } from 'lucide-react';

interface Approver {
  role: string;
  userEmail: string;
  name: string;
  notifyEmail: string;
}

interface ApprovalConfig {
  enableApprovalWorkflow: boolean;
  approvalRequired: boolean;
  approvers: Approver[];
  approvalTimeoutDays: number;
  requireAllApprovals: boolean;
  autoApproveTemplateTypes: string[];
  notifyOnSubmit: boolean;
  notifyOnApprove: boolean;
  notifyOnReject: boolean;
}

export default function WhatsAppApprovalConfig() {
  const [config, setConfig] = useState<ApprovalConfig>({
    enableApprovalWorkflow: false,
    approvalRequired: false,
    approvers: [],
    approvalTimeoutDays: 7,
    requireAllApprovals: false,
    autoApproveTemplateTypes: [],
    notifyOnSubmit: true,
    notifyOnApprove: true,
    notifyOnReject: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newApprover, setNewApprover] = useState<Partial<Approver>>({
    role: 'admin',
    userEmail: '',
    name: '',
    notifyEmail: '',
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/tenant/whatsapp-approvals/config');
      if (!response.ok) throw new Error('Failed to fetch config');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/tenant/whatsapp-approvals/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Failed to save config');
      alert('Approval configuration saved!');
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const addApprover = () => {
    if (!newApprover.userEmail || !newApprover.name) {
      alert('Please fill in all approver details');
      return;
    }
    setConfig({
      ...config,
      approvers: [
        ...config.approvers,
        {
          role: newApprover.role || 'admin',
          userEmail: newApprover.userEmail,
          name: newApprover.name,
          notifyEmail: newApprover.notifyEmail || newApprover.userEmail,
        },
      ],
    });
    setNewApprover({
      role: 'admin',
      userEmail: '',
      name: '',
      notifyEmail: '',
    });
  };

  const removeApprover = (index: number) => {
    setConfig({
      ...config,
      approvers: config.approvers.filter((_, i) => i !== index),
    });
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Approval Workflow Settings</h1>
          <p className="text-slate-600">Configure how template changes require approval</p>
        </div>

        {/* Main Config Card */}
        <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
          {/* Enable Workflow */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
            <input
              type="checkbox"
              id="enableWorkflow"
              checked={config.enableApprovalWorkflow}
              onChange={(e) =>
                setConfig({
                  ...config,
                  enableApprovalWorkflow: e.target.checked,
                  approvalRequired: config.approvalRequired && e.target.checked,
                })
              }
              className="w-5 h-5 rounded"
            />
            <label htmlFor="enableWorkflow" className="font-semibold text-slate-900">
              Enable Approval Workflow
            </label>
            <p className="text-sm text-slate-600 ml-auto">
              Requires templates to go through approval before going live
            </p>
          </div>

          {config.enableApprovalWorkflow && (
            <>
              {/* Require Approval */}
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  id="requireApproval"
                  checked={config.approvalRequired}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      approvalRequired: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded"
                />
                <label htmlFor="requireApproval" className="font-semibold text-slate-900">
                  Require Approval for All Templates
                </label>
              </div>

              {/* Approval Timeout */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Approval Timeout (days)
                </label>
                <input
                  type="number"
                  value={config.approvalTimeoutDays}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      approvalTimeoutDays: parseInt(e.target.value),
                    })
                  }
                  min="1"
                  max="30"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-600 mt-1">
                  How many days before pending approvals expire
                </p>
              </div>

              {/* Approval Requirements */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  id="requireAll"
                  checked={config.requireAllApprovals}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      requireAllApprovals: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded"
                />
                <label htmlFor="requireAll" className="font-semibold text-slate-900">
                  Require All Approvers to Approve
                </label>
                <p className="text-sm text-slate-600 ml-auto">
                  If unchecked, any single approver can approve
                </p>
              </div>

              {/* Notification Settings */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                <p className="font-semibold text-slate-900">Notifications</p>
                {[
                  { key: 'notifyOnSubmit', label: 'Notify approvers when templates submitted' },
                  { key: 'notifyOnApprove', label: 'Notify submitter when approved' },
                  { key: 'notifyOnReject', label: 'Notify submitter when rejected' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={item.key}
                      checked={config[item.key as keyof ApprovalConfig] as boolean}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          [item.key]: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded"
                    />
                    <label htmlFor={item.key} className="text-sm text-slate-700">
                      {item.label}
                    </label>
                  </div>
                ))}
              </div>

              {/* Approvers Section */}
              <div className="border-t pt-6">
                <h3 className="font-bold text-slate-900 mb-4">Approval Reviewers</h3>

                {/* Current Approvers */}
                {config.approvers.length > 0 && (
                  <div className="space-y-2 mb-6">
                    {config.approvers.map((approver, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-slate-500" />
                            <strong className="text-slate-900">{approver.name}</strong>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {approver.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                            <Mail size={14} />
                            {approver.notifyEmail}
                          </div>
                        </div>
                        <button
                          onClick={() => removeApprover(idx)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Approver */}
                <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-semibold text-slate-900">Add Reviewer</p>
                  <input
                    type="text"
                    placeholder="Name"
                    value={newApprover.name || ''}
                    onChange={(e) => setNewApprover({ ...newApprover, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={newApprover.userEmail || ''}
                    onChange={(e) =>
                      setNewApprover({
                        ...newApprover,
                        userEmail: e.target.value,
                        notifyEmail: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={newApprover.role || 'admin'}
                    onChange={(e) => setNewApprover({ ...newApprover, role: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="custom">Custom</option>
                  </select>
                  <button
                    onClick={addApprover}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus size={18} />
                    Add Reviewer
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex gap-3 pt-6 border-t">
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 font-medium"
                >
                  <Save size={18} />
                  Save Configuration
                </button>
              </div>
            </>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-bold text-blue-900 mb-2">How Approval Workflow Works</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Templates submitted for approval when editing</li>
            <li>✓ Approvers receive notifications and can review changes</li>
            <li>✓ Approved templates are automatically activated</li>
            <li>✓ Rejected templates return to draft for revisions</li>
            <li>✓ Auto-approval can be disabled for specific template types</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
