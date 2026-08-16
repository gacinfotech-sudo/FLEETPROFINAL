import { useState, useEffect } from 'react';
import { Users, TrendingUp, Plus } from 'lucide-react';
import { useLocation } from 'wouter';

interface TenantStats {
  total: number;
  active: number;
  inactive: number;
}

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<TenantStats>({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('https://localhost:5050/api/admin/tenants/stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchStats();
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Root Admin Dashboard</h1>
          <p className="text-gray-600">Manage your FleetPro Tenants</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Tenants */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                <p className="text-4xl font-bold text-gray-900 mt-2">
                  {loading ? '—' : stats.total}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          {/* Active Tenants */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Tenants</p>
                <p className="text-4xl font-bold text-green-600 mt-2">
                  {loading ? '—' : stats.active}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          {/* Inactive Tenants */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive Tenants</p>
                <p className="text-4xl font-bold text-yellow-600 mt-2">
                  {loading ? '—' : stats.inactive}
                </p>
              </div>
              <Users className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Primary Action */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <button
            onClick={() => setLocation('/superadmin/tenants/create')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create New Tenant
          </button>
        </div>
      </div>
    </div>
  );
}
