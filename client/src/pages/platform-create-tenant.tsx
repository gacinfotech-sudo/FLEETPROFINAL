import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PlatformCreateTenant() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<any>(null);
  const [createdOwner, setCreatedOwner] = useState<any>(null);

  // Tenant form state
  const [tenantData, setTenantData] = useState({
    companyName: '',
    legalName: '',
    email: '',
    mobile: '',
    address: '',
    city: '',
    state: '',
    gst: '',
    pan: '',
    status: 'ACTIVE',
    plan: 'BASIC',
  });

  // Owner form state
  const [ownerData, setOwnerData] = useState({
    name: '',
    email: '',
    mobile: '',
  });

  // User form state
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    mobile: '',
    role: 'STAFF',
  });
  const [usersList, setUsersList] = useState<any[]>([]);

  // Create tenant mutation
  const createTenantMutation = useMutation({
    mutationFn: async () => {
      if (!tenantData.companyName || !tenantData.email) {
        throw new Error('Company name and email are required');
      }

      const res = await fetch('/api/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(tenantData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to create tenant');
      }

      return res.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        setCreatedTenant(result);
        toast({ description: '✅ Tenant created successfully!' });
        // Reset form
        setTenantData({
          companyName: '',
          legalName: '',
          email: '',
          mobile: '',
          address: '',
          city: '',
          state: '',
          gst: '',
          pan: '',
          status: 'ACTIVE',
          plan: 'BASIC',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/platform/tenants'] });
      }
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message || 'Failed to create tenant' });
    },
  });

  // Create owner mutation
  const createOwnerMutation = useMutation({
    mutationFn: async () => {
      if (!ownerData.name || !ownerData.email) {
        throw new Error('Owner name and email are required');
      }

      const res = await fetch(`/api/platform/tenants/${createdTenant.id}/owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(ownerData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to create owner');
      }

      return res.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        setCreatedOwner(result);
        setUsersList([result]);
        toast({ description: '✅ Tenant owner created successfully!' });
        // Reset form
        setOwnerData({
          name: '',
          email: '',
          mobile: '',
        });
      }
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message || 'Failed to create owner' });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async () => {
      if (!newUserData.name || !newUserData.email) {
        throw new Error('User name and email are required');
      }

      const res = await fetch(`/api/platform/tenants/${createdTenant.id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newUserData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to create user');
      }

      return res.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        setUsersList([...usersList, result]);
        toast({ description: '✅ User created successfully!' });
        // Reset form
        setNewUserData({
          name: '',
          email: '',
          mobile: '',
          role: 'STAFF',
        });
        setUserFormOpen(false);
      }
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message || 'Failed to create user' });
    },
  });

  const handleTenantChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTenantData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleOwnerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setOwnerData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlanChange = (value: string) => {
    setTenantData((prev) => ({ ...prev, plan: value }));
  };

  const handleRoleChange = (value: string) => {
    setNewUserData((prev) => ({ ...prev, role: value }));
  };

  const handleCreateTenant = () => {
    createTenantMutation.mutate();
  };

  const handleCreateOwner = () => {
    if (!createdTenant) {
      toast({ variant: 'destructive', description: 'Please create a tenant first' });
      return;
    }
    createOwnerMutation.mutate();
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg p-8">
          <h1 className="text-4xl font-bold mb-2">🏢 Platform Tenant Provisioning</h1>
          <p className="text-blue-100">Create new tenants and manage tenant users end-to-end</p>
        </div>

        {/* Main workflow */}
        <Tabs defaultValue="tenant" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tenant" className="text-base">
              Step 1: Create Tenant
            </TabsTrigger>
            <TabsTrigger value="owner" disabled={!createdTenant} className="text-base">
              Step 2: Create Owner
            </TabsTrigger>
            <TabsTrigger value="users" disabled={!createdOwner} className="text-base">
              Step 3: Manage Users
            </TabsTrigger>
          </TabsList>

          {/* Step 1: Create Tenant */}
          <TabsContent value="tenant">
            <Card>
              <CardHeader>
                <CardTitle>Create New Tenant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      name="companyName"
                      placeholder="e.g., ABC Fleet Services"
                      value={tenantData.companyName}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="legalName">Legal Name</Label>
                    <Input
                      id="legalName"
                      name="legalName"
                      placeholder="Legal entity name"
                      value={tenantData.legalName}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="contact@company.com"
                      value={tenantData.email}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="mobile">Mobile</Label>
                    <Input
                      id="mobile"
                      name="mobile"
                      placeholder="9876543210"
                      value={tenantData.mobile}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      name="address"
                      placeholder="123 Main St"
                      value={tenantData.address}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      placeholder="City"
                      value={tenantData.city}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      name="state"
                      placeholder="State"
                      value={tenantData.state}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gst">GST</Label>
                    <Input
                      id="gst"
                      name="gst"
                      placeholder="GST Number"
                      value={tenantData.gst}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="pan">PAN</Label>
                    <Input
                      id="pan"
                      name="pan"
                      placeholder="PAN"
                      value={tenantData.pan}
                      onChange={handleTenantChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="plan">Plan</Label>
                    <Select value={tenantData.plan} onValueChange={handlePlanChange}>
                      <SelectTrigger id="plan">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BASIC">Basic</SelectItem>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="PREMIUM">Premium</SelectItem>
                      </SelectContent>
                    </Select>
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

          {/* Step 2: Create Owner */}
          <TabsContent value="owner">
            <Card>
              <CardHeader>
                <CardTitle>Create Tenant Owner</CardTitle>
                <p className="text-sm text-gray-500 mt-2">Tenant: {createdTenant?.companyName}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ownerName">Owner Name *</Label>
                    <Input
                      id="ownerName"
                      name="name"
                      placeholder="Full Name"
                      value={ownerData.name}
                      onChange={handleOwnerChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="ownerEmail">Email *</Label>
                    <Input
                      id="ownerEmail"
                      name="email"
                      type="email"
                      placeholder="owner@company.com"
                      value={ownerData.email}
                      onChange={handleOwnerChange}
                      className="mt-1"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="ownerMobile">Mobile</Label>
                    <Input
                      id="ownerMobile"
                      name="mobile"
                      placeholder="9876543210"
                      value={ownerData.mobile}
                      onChange={handleOwnerChange}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900">
                    The owner will receive a setup link to complete their account setup.
                  </p>
                </div>

                <Button
                  onClick={handleCreateOwner}
                  disabled={createOwnerMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
                >
                  {createOwnerMutation.isPending ? '⏳ Creating...' : '✅ Create Owner'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Step 3: Manage Users */}
          <TabsContent value="users">
            <div className="space-y-6">
              {/* Users List */}
              <Card>
                <CardHeader>
                  <CardTitle>Tenant Users</CardTitle>
                  <p className="text-sm text-gray-500 mt-2">Tenant: {createdTenant?.companyName}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {usersList.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left">Name</th>
                            <th className="px-4 py-2 text-left">Email</th>
                            <th className="px-4 py-2 text-left">Role</th>
                            <th className="px-4 py-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usersList.map((user: any, idx: number) => (
                            <tr key={idx} className="border-b">
                              <td className="px-4 py-2">{user.email?.split('@')[0] || 'N/A'}</td>
                              <td className="px-4 py-2">{user.email}</td>
                              <td className="px-4 py-2 capitalize">{user.role}</td>
                              <td className="px-4 py-2">
                                <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                  Active
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500">No users yet</p>
                  )}

                  <Button
                    onClick={() => setUserFormOpen(!userFormOpen)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {userFormOpen ? '✕ Close' : '+ Add User'}
                  </Button>
                </CardContent>
              </Card>

              {/* Add User Form */}
              {userFormOpen && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add New User</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="userName">User Name *</Label>
                        <Input
                          id="userName"
                          name="name"
                          placeholder="Full Name"
                          value={newUserData.name}
                          onChange={handleUserChange}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="userEmail">Email *</Label>
                        <Input
                          id="userEmail"
                          name="email"
                          type="email"
                          placeholder="user@company.com"
                          value={newUserData.email}
                          onChange={handleUserChange}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="userMobile">Mobile</Label>
                        <Input
                          id="userMobile"
                          name="mobile"
                          placeholder="9876543210"
                          value={newUserData.mobile}
                          onChange={handleUserChange}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="userRole">Role</Label>
                        <Select value={newUserData.role} onValueChange={handleRoleChange}>
                          <SelectTrigger id="userRole">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MANAGER">Manager</SelectItem>
                            <SelectItem value="AGENT">Agent</SelectItem>
                            <SelectItem value="STAFF">Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      onClick={handleCreateUser}
                      disabled={createUserMutation.isPending}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {createUserMutation.isPending ? '⏳ Creating...' : '✅ Add User'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ Tenant Setup Complete!</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm font-medium">Tenant Details:</p>
              <p className="text-lg font-bold text-green-700">{createdTenant?.companyName}</p>
              <p className="text-sm text-gray-600">ID: {createdTenant?.id}</p>
            </div>
            <p className="text-sm text-gray-600">All steps completed successfully!</p>
            <Button onClick={() => setShowSuccessDialog(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
