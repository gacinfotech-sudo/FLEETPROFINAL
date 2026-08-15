import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

export default function TenantsList() {
  const [, setLocation] = useLocation();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch tenants from API
    fetch('/api/platform/tenants')
      .then(r => r.json())
      .then(data => {
        setTenants(Array.isArray(data) ? data : data.tenants || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Loading tenants...</div>;
  if (!tenants.length) return <div className="p-8">No tenants found</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🏢 Tenants</h1>
          <p className="text-gray-600 mt-1">{tenants.length} total tenants</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">Add Tenant</button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Tenant</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Owner</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Plan</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Users</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Next Due</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(tenant => (
              <tr key={tenant.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-semibold cursor-pointer text-blue-600 hover:underline"
                    onClick={() => setLocation(`/superadmin/tenants/${tenant.id}`)}>
                  {tenant.name}
                </td>
                <td className="px-6 py-4">{tenant.owner}</td>
                <td className="px-6 py-4">{tenant.plan}</td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    {tenant.status}
                  </span>
                </td>
                <td className="px-6 py-4">{tenant.users}</td>
                <td className="px-6 py-4">{new Date(tenant.nextDueDate).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <button onClick={() => setLocation(`/superadmin/tenants/${tenant.id}`)}
                          className="text-blue-600 hover:underline text-sm">
                    View 360
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
