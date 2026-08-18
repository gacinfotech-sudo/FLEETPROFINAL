import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin-layout';

interface Plan {
  _id: string;
  name: string;
  code: string;
  description: string;
  pricing: { monthly: number; annual: number; currency: string };
  limits: { vehicles: number; drivers: number; users: number };
  features: string[];
  trial: { enabled: boolean; daysCount: number };
  active: boolean;
  createdAt: string;
}

export default function PlansEnhanced() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    pricing: { monthly: 0, annual: 0, currency: 'INR' },
    limits: { vehicles: 10, drivers: 5, users: 3 },
    features: [] as string[],
    trial: { enabled: true, daysCount: 14 },
    active: true,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      const response = await fetch('/api/admin/plans', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setPlans(Array.isArray(data.data) ? data.data : data || []);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      alert('Plan name and code required');
      return;
    }

    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/admin/plans/${editingId}` : '/api/admin/plans';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        resetForm();
        setEditingId(null);
        await fetchPlans();
        alert('Plan saved successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to save plan'}`);
      }
    } catch (error) {
      console.error('Failed to save plan:', error);
      alert('Error saving plan');
    }
  }

  async function handleDeletePlan(planId: string) {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      const response = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchPlans();
        alert('Plan deleted successfully!');
      }
    } catch (error) {
      console.error('Failed to delete plan:', error);
      alert('Error deleting plan');
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      code: '',
      description: '',
      pricing: { monthly: 0, annual: 0, currency: 'INR' },
      limits: { vehicles: 10, drivers: 5, users: 3 },
      features: [],
      trial: { enabled: true, daysCount: 14 },
      active: true,
    });
    setNewFeature('');
    setShowCreateForm(false);
  }

  function startEdit(plan: Plan) {
    setFormData(plan);
    setEditingId(plan._id);
    setShowCreateForm(true);
  }

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData({
        ...formData,
        features: [...formData.features, newFeature],
      });
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index),
    });
  };

  const getPlanColor = (index: number) => {
    const colors = [
      'from-blue-50 to-blue-100 border-blue-200',
      'from-purple-50 to-purple-100 border-purple-200',
      'from-green-50 to-green-100 border-green-200',
    ];
    return colors[index % 3];
  };

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">💰 Pricing Plans</h1>
            <p className="text-gray-600">Manage subscription plans and pricing tiers</p>
          </div>
          <button
            onClick={() => { resetForm(); setEditingId(null); setShowCreateForm(!showCreateForm); }}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Plan
          </button>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingId ? 'Edit Plan' : 'Create New Plan'}
            </h2>
            <form onSubmit={handleSavePlan} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Plan Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="e.g., Professional"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Plan Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="e.g., PROFESSIONAL"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Brief description of this plan"
                  rows={3}
                />
              </div>

              {/* Pricing */}
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-4">💵 Pricing</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Monthly Price (₹)</label>
                    <input
                      type="number"
                      value={formData.pricing.monthly}
                      onChange={(e) => setFormData({
                        ...formData,
                        pricing: { ...formData.pricing, monthly: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Annual Price (₹)</label>
                    <input
                      type="number"
                      value={formData.pricing.annual}
                      onChange={(e) => setFormData({
                        ...formData,
                        pricing: { ...formData.pricing, annual: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                {formData.pricing.annual > 0 && (
                  <p className="text-sm text-green-700 mt-2">
                    💚 Save {Math.round((1 - formData.pricing.annual / (formData.pricing.monthly * 12)) * 100)}% annually!
                  </p>
                )}
              </div>

              {/* Limits */}
              <div className="bg-purple-50 p-6 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-4">📊 Plan Limits</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Max Vehicles</label>
                    <input
                      type="number"
                      value={formData.limits.vehicles}
                      onChange={(e) => setFormData({
                        ...formData,
                        limits: { ...formData.limits, vehicles: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Max Drivers</label>
                    <input
                      type="number"
                      value={formData.limits.drivers}
                      onChange={(e) => setFormData({
                        ...formData,
                        limits: { ...formData.limits, drivers: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Max Users</label>
                    <input
                      type="number"
                      value={formData.limits.users}
                      onChange={(e) => setFormData({
                        ...formData,
                        limits: { ...formData.limits, users: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Trial */}
              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="trial"
                    checked={formData.trial.enabled}
                    onChange={(e) => setFormData({
                      ...formData,
                      trial: { ...formData.trial, enabled: e.target.checked }
                    })}
                    className="mr-2"
                  />
                  <label htmlFor="trial" className="font-bold text-gray-900">✨ Enable Free Trial</label>
                </div>
                {formData.trial.enabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Trial Days</label>
                    <input
                      type="number"
                      value={formData.trial.daysCount}
                      onChange={(e) => setFormData({
                        ...formData,
                        trial: { ...formData.trial, daysCount: parseInt(e.target.value) || 14 }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                    />
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="bg-orange-50 p-6 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-4">⭐ Features Included</h3>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500"
                    placeholder="Add a feature..."
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.features.map((feature, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                      <span className="text-gray-900">✓ {feature}</span>
                      <button
                        type="button"
                        onClick={() => removeFeature(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  {editingId ? 'Update Plan' : 'Create Plan'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Plans Display */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600 mb-4">No plans created yet</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
              <div
                key={plan._id}
                className={`bg-gradient-to-br ${getPlanColor(index)} rounded-lg border-2 p-6 hover:shadow-xl transition-all`}
              >
                {/* Header */}
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      plan.active ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'
                    }`}>
                      {plan.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{plan.code}</p>
                </div>

                <p className="text-gray-700 text-sm mb-4">{plan.description}</p>

                {/* Pricing */}
                <div className="mb-4 p-3 bg-white/70 rounded-lg">
                  <p className="text-3xl font-bold text-gray-900">₹{plan.pricing.monthly.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">/month</p>
                  {plan.pricing.annual > 0 && (
                    <p className="text-xs text-green-700 mt-1">
                      Annual: ₹{plan.pricing.annual.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Trial Badge */}
                {plan.trial?.enabled && (
                  <div className="mb-4 p-2 bg-green-200 rounded-lg">
                    <p className="text-sm font-semibold text-green-800">✨ {plan.trial.daysCount} days free trial</p>
                  </div>
                )}

                {/* Limits */}
                <div className="mb-4 space-y-1 text-sm">
                  <p className="text-gray-700">🚗 {plan.limits.vehicles} Vehicles</p>
                  <p className="text-gray-700">👥 {plan.limits.drivers} Drivers</p>
                  <p className="text-gray-700">👤 {plan.limits.users} Users</p>
                </div>

                {/* Features */}
                {plan.features.length > 0 && (
                  <div className="mb-4 p-3 bg-white/60 rounded-lg">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Features:</p>
                    <ul className="space-y-1">
                      {plan.features.slice(0, 3).map((feature, i) => (
                        <li key={i} className="text-xs text-gray-700">✓ {feature}</li>
                      ))}
                      {plan.features.length > 3 && (
                        <li className="text-xs text-gray-600 italic">+{plan.features.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(plan)}
                    className="flex-1 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan._id)}
                    className="flex-1 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
