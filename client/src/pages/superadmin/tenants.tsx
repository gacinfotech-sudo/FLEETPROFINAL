import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Eye, Edit, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  subscriptionPlan: string;
  isActive: boolean;
  createdAt: string;
  limits: { vehicles: number; drivers: number; managers: number };
}

export default function SuperAdminTenants() {
  const { toast } = useToast();

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['superadmin-tenants'],
    queryFn: async () => {
      const res = await fetch('/api/superadmin/tenants', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch tenants');
      return res.json();
    },
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-600">Failed to load tenants</p>
        </div>
      </div>
    );
  }

  const tenants: Tenant[] = response?.data?.tenants || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">📋 All Tenants</h1>
              <p className="text-blue-100">{tenants.length} customer companies</p>
            </div>
            <Button
              className="bg-white text-blue-600 hover:bg-blue-50"
              onClick={() => window.location.href = '/dashboard/admin-tenant-create'}
            >
              + Create Tenant
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            <p className="mt-4 text-gray-600">Loading tenants...</p>
          </div>
        ) : tenants.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No tenants found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Company Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Plan</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Limits</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-semibold text-gray-900">{tenant.name}</p>
                        <p className="text-xs text-gray-500">{tenant.businessName}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{tenant.email || '-'}</td>
                    <td className="py-4 px-4">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {tenant.subscriptionPlan}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {tenant.isActive ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600">Active</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="text-sm text-red-600">Inactive</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-sm">
                      <div className="text-xs text-gray-600">
                        <p>🚗 {tenant.limits.vehicles} vehicles</p>
                        <p>👤 {tenant.limits.drivers} drivers</p>
                        <p>⚙️ {tenant.limits.managers} managers</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          title="View Tenant 360"
                          onClick={() => window.location.href = `/dashboard/superadmin/tenants/${tenant.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          title="Edit"
                          onClick={() => window.location.href = `/dashboard/admin-tenant-create?edit=${tenant.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
