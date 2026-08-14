import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Building2, Users, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';

interface DashboardMetrics {
  tenants: {
    total: number;
    active: number;
    trial: number;
    inactive: number;
  };
  byPlan: {
    starter: number;
    pro: number;
    custom: number;
  };
  metrics: {
    mrrEstimate: string;
    renewalsThisMonth: number;
    renewalsNextMonth: number;
    paymentsPending: number;
    overdueTenants: number;
  };
  support: {
    openTickets: number;
    highPriority: number;
    slaOverdue: number;
  };
  timestamp: string;
}

export default function SuperAdminDashboard() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  // Fetch dashboard metrics
  const { isLoading, error } = useQuery({
    queryKey: ['superadmin-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/superadmin/dashboard', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setMetrics(data.data);
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  useEffect(() => {
    if (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to load dashboard metrics',
      });
    }
  }, [error, toast]);

  if (isLoading || !metrics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
        <div className="text-center py-12">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">🎛️ Platform Dashboard</h1>
          <p className="text-blue-100">FleetPro SaaS Control Center</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Tenant Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Total Tenants */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Total Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{metrics.tenants.total}</div>
              <p className="text-xs text-gray-500 mt-1">{metrics.tenants.active} active</p>
            </CardContent>
          </Card>

          {/* Active Tenants */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{metrics.tenants.active}</div>
              <p className="text-xs text-gray-500 mt-1">Paying customers</p>
            </CardContent>
          </Card>

          {/* Trial Tenants */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Trial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{metrics.tenants.trial}</div>
              <p className="text-xs text-gray-500 mt-1">Evaluating</p>
            </CardContent>
          </Card>

          {/* Inactive Tenants */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Inactive
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{metrics.tenants.inactive}</div>
              <p className="text-xs text-gray-500 mt-1">Not subscribed</p>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Plans Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Plans Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-blue-600 mb-2">{metrics.byPlan.starter}</div>
                <p className="text-gray-600">Starter Plan</p>
                <div className="w-full bg-gray-200 h-1 mt-3 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full"
                    style={{
                      width: `${(metrics.byPlan.starter / metrics.tenants.total) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="text-center">
                <div className="text-5xl font-bold text-green-600 mb-2">{metrics.byPlan.pro}</div>
                <p className="text-gray-600">Pro Plan</p>
                <div className="w-full bg-gray-200 h-1 mt-3 rounded-full overflow-hidden">
                  <div
                    className="bg-green-600 h-full"
                    style={{
                      width: `${(metrics.byPlan.pro / metrics.tenants.total) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="text-center">
                <div className="text-5xl font-bold text-purple-600 mb-2">{metrics.byPlan.custom}</div>
                <p className="text-gray-600">Custom Plan</p>
                <div className="w-full bg-gray-200 h-1 mt-3 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full"
                    style={{
                      width: `${(metrics.byPlan.custom / metrics.tenants.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="border-l-4 border-l-blue-600 pl-4">
                <p className="text-gray-600 text-sm">Renewals This Month</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{metrics.metrics.renewalsThisMonth}</p>
              </div>

              <div className="border-l-4 border-l-green-600 pl-4">
                <p className="text-gray-600 text-sm">Renewals Next Month</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{metrics.metrics.renewalsNextMonth}</p>
              </div>

              <div className="border-l-4 border-l-amber-600 pl-4">
                <p className="text-gray-600 text-sm">Payments Pending</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.metrics.paymentsPending}</p>
              </div>

              <div className="border-l-4 border-l-red-600 pl-4">
                <p className="text-gray-600 text-sm">Overdue Tenants</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{metrics.metrics.overdueTenants}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Support Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-700">Open Tickets</span>
                <span className="text-2xl font-bold text-blue-600">{metrics.support.openTickets}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-700">High Priority</span>
                <span className="text-2xl font-bold text-red-600">{metrics.support.highPriority}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-700">SLA Overdue</span>
                <span className="text-2xl font-bold text-orange-600">{metrics.support.slaOverdue}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button
                className="w-full justify-between"
                variant="outline"
                onClick={() => window.location.href = '/dashboard/superadmin/tenants'}
              >
                <span>View All Tenants</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button
                className="w-full justify-between"
                variant="outline"
                onClick={() => window.location.href = '/dashboard/superadmin/company-profile'}
              >
                <span>Company Profile</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button
                className="w-full justify-between"
                variant="outline"
                onClick={() => window.location.href = '/dashboard/superadmin/audit-log'}
              >
                <span>Audit Log</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button
                className="w-full justify-between bg-blue-600 hover:bg-blue-700"
                onClick={() => window.location.href = '/dashboard/admin-tenant-create'}
              >
                <span>Create Tenant</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Last Updated */}
        <div className="text-center text-sm text-gray-500">
          Last updated: {new Date(metrics.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
