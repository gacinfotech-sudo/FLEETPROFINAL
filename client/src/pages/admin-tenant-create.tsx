import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AdminTenantCreate() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<any>(null);

  // Tenant form state
  const [tenantData, setTenantData] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    address: '',
    subscriptionPlan: 'basic',
    maxDrivers: 50,
    maxVehicles: 50,
    maxManagers: 5
  });

  // User form state
  const [userData, setUserData] = useState({
    userId: '',
    password: '',
    firstName: '',
    lastName: '',
    email: ''
  });

  // Create tenant mutation
  const createTenantMutation = useMutation({
    mutationFn: async () => {
      if (!tenantData.name || !tenantData.businessName) {
        throw new Error('Company name and business name are required');
      }

      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(tenantData)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to create tenant');
      }

      return res.json();
    },
    onSuccess: (result) => {
      setCreatedTenant(result);
      setShowSuccessDialog(true);
      toast({ description: '✅ Tenant created successfully!' });

      // Reset forms
      setTenantData({
        name: '',
        businessName: '',
        email: '',
        phone: '',
        address: '',
        subscriptionPlan: 'basic',
        maxDrivers: 50,
        maxVehicles: 50,
        maxManagers: 5
      });
      setUserData({
        userId: '',
        password: '',
        firstName: '',
        lastName: '',
        email: ''
      });

      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message || 'Failed to create tenant' });
    }
  });

  // Create user for tenant (admin only)
  const createUserMutation = useMutation({
    mutationFn: async () => {
      if (!userData.userId || !userData.password) {
        throw new Error('User ID and password are required');
      }

      if (userData.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...userData,
          role: 'client',
          tenantId: createdTenant?._id || createdTenant?.id
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to create user');
      }

      return res.json();
    },
    onSuccess: () => {
      toast({ description: '✅ User created successfully!' });
      setUserData({
        userId: '',
        password: '',
        firstName: '',
        lastName: '',
        email: ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message || 'Failed to create user' });
    }
  });

  const handleTenantChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTenantData(prev => ({
      ...prev,
      [name]: name.includes('max') ? parseInt(value) : value
    }));
  };

  const handleUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateTenant = () => {
    createTenantMutation.mutate();
  };

  const handleCreateUser = () => {
    if (!createdTenant) {
      toast({ variant: 'destructive', description: 'Please create a tenant first' });
      return;
    }
    createUserMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg p-8">
          <h1 className="text-4xl font-bold mb-2">🏢 Create New Tenant</h1>
          <p className="text-blue-100">Set up a new tenant account with admin user</p>
        </div>

        {/* Two-step process */}
        <Tabs defaultValue="tenant" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tenant" className="text-base">Step 1: Tenant Details</TabsTrigger>
            <TabsTrigger value="user" disabled={!createdTenant} className="text-base">Step 2: Create User</TabsTrigger>
          </TabsList>

          {/* Step 1: Tenant Creation */}
          <TabsContent value="tenant">
            <Card>
              <CardHeader>
                <CardTitle>Tenant Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Company Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="e.g., ABC Travels"
                      value={tenantData.name}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      name="businessName"
                      placeholder="e.g., ABC Fleet Management"
                      value={tenantData.businessName}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="contact@abc.com"
                      value={tenantData.email}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="9876543210"
                      value={tenantData.phone}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      name="address"
                      placeholder="123 Main St, City"
                      value={tenantData.address}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="subscriptionPlan">Subscription Plan</Label>
                    <select
                      id="subscriptionPlan"
                      name="subscriptionPlan"
                      value={tenantData.subscriptionPlan}
                      onChange={handleTenantChange}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="basic">Basic</option>
                      <option value="professional">Professional</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="maxDrivers">Max Drivers</Label>
                    <Input
                      id="maxDrivers"
                      name="maxDrivers"
                      type="number"
                      value={tenantData.maxDrivers}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="maxVehicles">Max Vehicles</Label>
                    <Input
                      id="maxVehicles"
                      name="maxVehicles"
                      type="number"
                      value={tenantData.maxVehicles}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="maxManagers">Max Managers</Label>
                    <Input
                      id="maxManagers"
                      name="maxManagers"
                      type="number"
                      value={tenantData.maxManagers}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCreateTenant}
                  disabled={createTenantMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
                >
                  {createTenantMutation.isPending ? '⏳ Creating...' : '✅ Create Tenant'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Step 2: User Creation */}
          <TabsContent value="user">
            <Card>
              <CardHeader>
                <CardTitle>Create Admin User for Tenant</CardTitle>
                <p className="text-sm text-gray-500 mt-2">Tenant: {createdTenant?.name}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="userId">User ID *</Label>
                    <Input
                      id="userId"
                      name="userId"
                      placeholder="admin_user"
                      value={userData.userId}
                      onChange={handleUserChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Password (min 8 chars) *</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={userData.password}
                      onChange={handleUserChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder="Admin"
                      value={userData.firstName}
                      onChange={handleUserChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="User"
                      value={userData.lastName}
                      onChange={handleUserChange}
                      className="mt-1"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="userEmail">Email</Label>
                    <Input
                      id="userEmail"
                      name="email"
                      type="email"
                      placeholder="admin@tenant.com"
                      value={userData.email}
                      onChange={handleUserChange}
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
                >
                  {createUserMutation.isPending ? '⏳ Creating...' : '✅ Create User'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Success Dialog */}
        <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>✅ Tenant Created Successfully!</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm font-medium">Tenant Details:</p>
                <p className="text-lg font-bold text-green-700">{createdTenant?.name}</p>
                <p className="text-sm text-gray-600">ID: {createdTenant?._id || createdTenant?.id}</p>
              </div>
              <p className="text-sm text-gray-600">Now create an admin user for this tenant in Step 2</p>
              <Button onClick={() => setShowSuccessDialog(false)} className="w-full">
                Continue
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
