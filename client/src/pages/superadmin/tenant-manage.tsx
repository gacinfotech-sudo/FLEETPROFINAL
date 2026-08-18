import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Save, Lock, Unlock, RefreshCw, Key, DollarSign, Package, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin-layout';

interface TenantData {
  _id: string;
  name: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  ownerMobile: string;
  status: 'active' | 'inactive' | 'suspended';
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pin?: string;
  gstin?: string;
  pan?: string;
  subscriptionPlan?: string;
  vehicleLimit?: number;
  userLimit?: number;
  driverLimit?: number;
  branchLimit?: number;
  createdAt: string;
  updatedAt: string;
}

export default function TenantManage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [, setLocation] = useLocation();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'owner' | 'plan' | 'limits' | 'subscription' | 'status'>('profile');
  const [editedData, setEditedData] = useState<Partial<TenantData>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  // Fetch tenant data
  useEffect(() => {
    fetchTenant();
  }, [tenantId]);

  async function fetchTenant() {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setTenant(data);
        setEditedData(data);
      } else {
        setMessage({ type: 'error', text: 'Failed to load tenant' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error loading tenant' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function saveTenant() {
    if (!tenant) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/admin/tenants/${tenant._id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedData),
      });

      if (response.ok) {
        const updated = await response.json();
        setTenant(updated);
        setMessage({ type: 'success', text: 'Tenant updated successfully' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.message || 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving tenant' });
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!tenant) return;
    try {
      const response = await fetch(`/api/admin/tenants/${tenant._id}/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setTempPassword(data.tempPassword);
        setMessage({ type: 'success', text: 'Password reset. Copy it now - it will not be shown again!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to reset password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error resetting password' });
      console.error(error);
    }
  }

  async function changeTenantStatus(newStatus: 'active' | 'inactive') {
    if (!tenant) return;
    try {
      const endpoint = newStatus === 'active' ? '/activate' : '/deactivate';
      const response = await fetch(`/api/admin/tenants/${tenant._id}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const updated = await response.json();
        setTenant(updated);
        setMessage({ type: 'success', text: `Tenant ${newStatus}d successfully` });
      } else {
        setMessage({ type: 'error', text: 'Failed to change status' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error changing status' });
      console.error(error);
    }
  }

  function updateField(key: keyof TenantData, value: any) {
    setEditedData(prev => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading tenant...</p>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  if (!tenant) {
    return (
      <SuperAdminLayout>
        <div className="p-6">
          <button onClick={() => setLocation('/superadmin/tenants')} className="text-blue-600 hover:underline flex items-center gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Tenants
          </button>
          <div className="bg-red-50 border border-red-300 rounded-lg p-4">
            <p className="text-red-800">Tenant not found</p>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => setLocation('/superadmin/tenants')} className="text-blue-600 hover:underline flex items-center gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Tenants
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{tenant.businessName || tenant.name}</h1>
              <p className="text-gray-600 mt-1">ID: {tenant._id}</p>
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {tenant.status}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-300 text-green-800'
              : 'bg-red-50 border border-red-300 text-red-800'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Password Reset Modal */}
        {showPasswordReset && tempPassword && (
          <div className="mb-6 bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
            <h3 className="text-lg font-bold text-blue-900 mb-4">⚠️ Temporary Password Generated</h3>
            <p className="text-sm text-blue-800 mb-4">Copy this password now. It will NOT be displayed again.</p>
            <div className="bg-white border border-blue-300 rounded p-4 mb-4 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">{tempPassword}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    setMessage({ type: 'success', text: 'Password copied!' });
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setShowPasswordReset(false);
                setTempPassword('');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Done (Password hidden)
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-300 flex gap-4">
          {['profile', 'owner', 'plan', 'limits', 'subscription', 'status'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg border border-gray-300 p-6 mb-6">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Company Profile</h2>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Company Name"
                  value={editedData.name || ''}
                  onChange={e => updateField('name', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  placeholder="Legal Name"
                  value={editedData.businessName || ''}
                  onChange={e => updateField('businessName', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="email"
                  placeholder="Business Email"
                  value={editedData.email || ''}
                  onChange={e => updateField('email', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  placeholder="Business Phone"
                  value={editedData.phone || ''}
                  onChange={e => updateField('phone', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={editedData.address || ''}
                  onChange={e => updateField('address', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  placeholder="City"
                  value={editedData.city || ''}
                  onChange={e => updateField('city', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={editedData.state || ''}
                  onChange={e => updateField('state', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  placeholder="PIN"
                  value={editedData.pin || ''}
                  onChange={e => updateField('pin', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  placeholder="GSTIN"
                  value={editedData.gstin || ''}
                  onChange={e => updateField('gstin', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  placeholder="PAN"
                  value={editedData.pan || ''}
                  onChange={e => updateField('pan', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                />
              </div>
            </div>
          )}

          {activeTab === 'owner' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Owner Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Owner Name"
                  value={editedData.ownerName || ''}
                  onChange={e => updateField('ownerName', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="email"
                  placeholder="Owner Email"
                  value={editedData.ownerEmail || ''}
                  onChange={e => updateField('ownerEmail', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  placeholder="Owner Mobile"
                  value={editedData.ownerMobile || ''}
                  onChange={e => updateField('ownerMobile', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded"
                />
                <button
                  onClick={() => {
                    setShowPasswordReset(true);
                    resetPassword();
                  }}
                  className="col-span-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" /> Reset Password
                </button>
              </div>
            </div>
          )}

          {activeTab === 'plan' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Subscription Plan</h2>
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={editedData.subscriptionPlan || 'starter'}
                  onChange={e => updateField('subscriptionPlan', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="starter">Starter - ₹5,000/month</option>
                  <option value="professional">Professional - ₹15,000/month</option>
                  <option value="enterprise">Enterprise - ₹30,000/month</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'limits' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Resource Limits</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Limit</label>
                  <input
                    type="number"
                    value={editedData.vehicleLimit || 10}
                    onChange={e => updateField('vehicleLimit', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">User Limit</label>
                  <input
                    type="number"
                    value={editedData.userLimit || 5}
                    onChange={e => updateField('userLimit', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Driver Limit</label>
                  <input
                    type="number"
                    value={editedData.driverLimit || 20}
                    onChange={e => updateField('driverLimit', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch Limit</label>
                  <input
                    type="number"
                    value={editedData.branchLimit || 1}
                    onChange={e => updateField('branchLimit', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Subscription Management</h2>
              <div className="bg-blue-50 border border-blue-300 rounded p-4">
                <p className="text-blue-800">Subscription management APIs coming in next update.</p>
              </div>
            </div>
          )}

          {activeTab === 'status' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Tenant Status</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => changeTenantStatus('active')}
                  disabled={tenant.status === 'active'}
                  className={`flex items-center gap-2 px-4 py-2 rounded font-medium ${
                    tenant.status === 'active'
                      ? 'bg-green-100 text-green-800 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" /> Activate
                </button>
                <button
                  onClick={() => changeTenantStatus('inactive')}
                  disabled={tenant.status === 'inactive'}
                  className={`flex items-center gap-2 px-4 py-2 rounded font-medium ${
                    tenant.status === 'inactive'
                      ? 'bg-yellow-100 text-yellow-800 cursor-not-allowed'
                      : 'bg-yellow-600 text-white hover:bg-yellow-700'
                  }`}
                >
                  <Lock className="w-4 h-4" /> Deactivate
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={() => setLocation('/superadmin/tenants')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={saveTenant}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
