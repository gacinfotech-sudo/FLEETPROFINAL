import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Archive, AlertCircle, CheckCircle } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  code: string;
  description?: string;
  pricing: { monthly?: number; annual?: number; currency: string };
  limits: { vehicles: number; drivers: number; users: number };
  features: string[];
  status: string;
  isActive: boolean;
}

export default function SuperAdminPlans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    pricing_monthly: '',
    pricing_annual: '',
    limits_vehicles: '',
    limits_drivers: '',
    limits_users: '',
  });

  // Fetch plans
  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const res = await fetch('/api/plans/admin/all', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch plans');
      return res.json();
    },
  });

  // Create plan mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/plans/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          description: formData.description,
          pricing: {
            monthly: formData.pricing_monthly ? parseInt(formData.pricing_monthly) : undefined,
            annual: formData.pricing_annual ? parseInt(formData.pricing_annual) : undefined,
            currency: 'INR',
          },
          limits: {
            vehicles: parseInt(formData.limits_vehicles),
            drivers: parseInt(formData.limits_drivers),
            users: parseInt(formData.limits_users),
          },
          features: [],
          billingCycles: ['monthly', 'annual'],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ description: '✅ Plan created successfully' });
      setShowCreateForm(false);
      setFormData({
        name: '',
        code: '',
        description: '',
        pricing_monthly: '',
        pricing_annual: '',
        limits_vehicles: '',
        limits_drivers: '',
        limits_users: '',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    },
    onError: () => {
      toast({ variant: 'destructive', description: 'Failed to create plan' });
    },
  });

  // Archive plan mutation
  const archiveMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/plans/admin/${planId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to archive plan');
      return res.json();
    },
    onSuccess: () => {
      toast({ description: '✅ Plan archived successfully' });
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    },
    onError: () => {
      toast({ variant: 'destructive', description: 'Failed to archive plan' });
    },
  });

  const plans: Plan[] = response?.data?.plans || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">📋 Subscription Plans</h1>
              <p className="text-blue-100">{plans.length} plans configured</p>
            </div>
            <Button
              className="bg-white text-blue-600 hover:bg-blue-50 gap-2"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              <Plus className="w-4 h-4" />
              Create Plan
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Create Form */}
        {showCreateForm && (
          <Card className="border-2 border-blue-500">
            <CardHeader>
              <CardTitle>Create New Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Plan Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Professional"
                    />
                  </div>
                  <div>
                    <Label>Code</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="professional"
                    />
                  </div>
                </div>

                <div>
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enterprise-ready solution"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Monthly Price (₹)</Label>
                    <Input
                      type="number"
                      value={formData.pricing_monthly}
                      onChange={(e) => setFormData({ ...formData, pricing_monthly: e.target.value })}
                      placeholder="99999"
                    />
                  </div>
                  <div>
                    <Label>Annual Price (₹)</Label>
                    <Input
                      type="number"
                      value={formData.pricing_annual}
                      onChange={(e) => setFormData({ ...formData, pricing_annual: e.target.value })}
                      placeholder="999990"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Max Vehicles</Label>
                    <Input
                      type="number"
                      value={formData.limits_vehicles}
                      onChange={(e) => setFormData({ ...formData, limits_vehicles: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <Label>Max Drivers</Label>
                    <Input
                      type="number"
                      value={formData.limits_drivers}
                      onChange={(e) => setFormData({ ...formData, limits_drivers: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <Label>Max Users</Label>
                    <Input
                      type="number"
                      value={formData.limits_users}
                      onChange={(e) => setFormData({ ...formData, limits_users: e.target.value })}
                      placeholder="20"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Plan'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Plans Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            <p className="mt-4 text-gray-600">Loading plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No plans found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card key={plan.id} className={plan.isActive ? '' : 'opacity-50'}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{plan.name}</CardTitle>
                      <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                    </div>
                    {plan.isActive ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Pricing */}
                  <div className="border-b pb-4">
                    {plan.pricing.monthly && (
                      <p className="text-sm text-gray-600">
                        ₹{plan.pricing.monthly.toLocaleString()}/month
                      </p>
                    )}
                    {plan.pricing.annual && (
                      <p className="text-sm text-gray-600">
                        ₹{plan.pricing.annual.toLocaleString()}/year
                      </p>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-semibold">🚗 Vehicles:</span> {plan.limits.vehicles}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">👤 Drivers:</span> {plan.limits.drivers}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">⚙️ Users:</span> {plan.limits.users}
                    </p>
                  </div>

                  {/* Features Count */}
                  <div className="border-t pt-4">
                    <p className="text-xs text-gray-600">
                      {plan.features.length} features included
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    {plan.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-600"
                        onClick={() => archiveMutation.mutate(plan.id)}
                        disabled={archiveMutation.isPending}
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        Archive
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
