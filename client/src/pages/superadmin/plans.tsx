import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronDown } from 'lucide-react';
import { useLocation } from 'wouter';
import SuperAdminLayout from '@/components/superadmin-layout';

interface Plan {
  _id: string;
  name: string;
  code: string;
  description: string;
  pricing: { monthly?: number; annual?: number; currency: string };
  limits: { vehicles: number; drivers: number; users: number };
  features: string[];
  trial: { enabled: boolean; daysCount: number };
  active: boolean;
  createdAt: string;
}

export default function PlansPage() {
  const [, setLocation] = useLocation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    pricing: { monthly: 0, annual: 0, currency: 'INR' },
    limits: { vehicles: 10, drivers: 5, users: 3 },
    features: [] as string[],
    trialDays: 14,
    setupFee: 0,
    taxPercent: 18,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      const response = await fetch('/api/admin/plans?limit=50', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPlans(Array.isArray(data.data) ? data.data : []);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({
          name: '',
          code: '',
          description: '',
          pricing: { monthly: 0, annual: 0, currency: 'INR' },
          limits: { vehicles: 10, drivers: 5, users: 3 },
          features: [],
          trialDays: 14,
          setupFee: 0,
          taxPercent: 18,
        });
        setShowCreateForm(false);
        await fetchPlans();
      }
    } catch (error) {
      console.error('Failed to create plan:', error);
    }
  }

  async function deletePlan(planId: string) {
    if (!confirm('Delete this plan?')) return;
    try {
      await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await fetchPlans();
    } catch (error) {
      console.error('Failed to delete plan:', error);
    }
  }

  return (
    <SuperAdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Pricing Plans</h1>
            <p className="text-gray-600">Manage subscription plans and pricing</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Plan
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Plan</h2>
            <form onSubmit={handleCreatePlan} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Plan Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Professional"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Plan Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., pro"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Plan description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Monthly Price (₹)</label>
                  <input
                    type="number"
                    value={formData.pricing.monthly}
                    onChange={(e) => setFormData({
                      ...formData,
                      pricing: { ...formData.pricing, monthly: parseFloat(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Annual Price (₹)</label>
                  <input
                    type="number"
                    value={formData.pricing.annual}
                    onChange={(e) => setFormData({
                      ...formData,
                      pricing: { ...formData.pricing, annual: parseFloat(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Max Vehicles</label>
                  <input
                    type="number"
                    value={formData.limits.vehicles}
                    onChange={(e) => setFormData({
                      ...formData,
                      limits: { ...formData.limits, vehicles: parseInt(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Max Drivers</label>
                  <input
                    type="number"
                    value={formData.limits.drivers}
                    onChange={(e) => setFormData({
                      ...formData,
                      limits: { ...formData.limits, drivers: parseInt(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Max Users</label>
                  <input
                    type="number"
                    value={formData.limits.users}
                    onChange={(e) => setFormData({
                      ...formData,
                      limits: { ...formData.limits, users: parseInt(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Trial Days</label>
                <input
                  type="number"
                  value={formData.trialDays}
                  onChange={(e) => setFormData({ ...formData, trialDays: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Create Plan
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Plans List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading plans...</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No plans created yet</div>
          ) : (
            plans.map((plan) => (
              <div key={plan._id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-gray-600">{plan.code}</p>
                </div>

                <p className="text-gray-600 text-sm mb-4">{plan.description}</p>

                <div className="mb-4 p-3 bg-blue-50 rounded">
                  <p className="text-sm text-gray-600">Monthly: <span className="font-bold">₹{plan.pricing.monthly}</span></p>
                  <p className="text-sm text-gray-600">Annual: <span className="font-bold">₹{plan.pricing.annual}</span></p>
                </div>

                <div className="mb-4 text-sm">
                  <p className="text-gray-600">🚗 {plan.limits.vehicles} Vehicles</p>
                  <p className="text-gray-600">👤 {plan.limits.drivers} Drivers</p>
                  <p className="text-gray-600">👥 {plan.limits.users} Users</p>
                </div>

                {plan.trial?.enabled && (
                  <div className="mb-4 text-sm bg-green-50 p-2 rounded">
                    <p className="text-green-700">✅ {plan.trial.daysCount} days trial</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button className="flex-1 p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    <Edit2 className="w-4 h-4 inline mr-1" /> Edit
                  </button>
                  <button
                    onClick={() => deletePlan(plan._id)}
                    className="flex-1 p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4 inline mr-1" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
