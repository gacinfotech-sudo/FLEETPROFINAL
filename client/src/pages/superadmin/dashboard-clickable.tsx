import { useLocation } from 'wouter';
import { Users, TrendingUp, Clock, Lock, DollarSign, AlertCircle, CheckCircle, Clock as ClockIcon, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    fetch('/api/root/dashboard')
      .then(r => r.json())
      .then(data => {
        setStats({
          totalTenants: data.tenants?.total || 0,
          activeTenants: data.tenants?.active || 0,
          trialTenants: data.tenants?.trial || 0,
          lockedTenants: data.tenants?.suspended || 0,
          monthlyRevenue: data.revenue?.total || 0,
          openTickets: data.support?.open || 0,
          criticalErrors: data.errors?.critical || 0,
          paymentsDue: data.billing?.paymentsDue || 0,
          renewalsDue: data.billing?.renewalsDue || 0,
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching dashboard:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const metrics = [
    { 
      title: 'Total Tenants', 
      value: stats?.totalTenants || 0, 
      icon: Users, 
      color: 'bg-blue-50', 
      iconColor: 'text-blue-600',
      onClick: () => setLocation('/superadmin/tenants')
    },
    { 
      title: 'Active Tenants', 
      value: stats?.activeTenants || 0, 
      icon: TrendingUp, 
      color: 'bg-green-50', 
      iconColor: 'text-green-600',
      onClick: () => setLocation('/superadmin/tenants?filter=active')
    },
    { 
      title: 'Trial Tenants', 
      value: stats?.trialTenants || 0, 
      icon: Clock, 
      color: 'bg-yellow-50', 
      iconColor: 'text-yellow-600',
      onClick: () => setLocation('/superadmin/tenants?filter=trial')
    },
    { 
      title: 'Locked Tenants', 
      value: stats?.lockedTenants || 0, 
      icon: Lock, 
      color: 'bg-red-50', 
      iconColor: 'text-red-600',
      onClick: () => setLocation('/superadmin/tenants?filter=locked')
    },
    { 
      title: 'Monthly Revenue', 
      value: `₹${(stats?.monthlyRevenue || 0).toLocaleString()}`, 
      icon: DollarSign, 
      color: 'bg-purple-50', 
      iconColor: 'text-purple-600',
      onClick: () => setLocation('/superadmin/billing')
    },
    { 
      title: 'Open Tickets', 
      value: stats?.openTickets || 0, 
      icon: AlertCircle, 
      color: 'bg-orange-50', 
      iconColor: 'text-orange-600',
      onClick: () => setLocation('/superadmin/support')
    }
  ];

  const alerts = [
    { 
      title: 'Critical Errors', 
      value: stats?.criticalErrors || 0, 
      onClick: () => setLocation('/superadmin/errors')
    },
    { 
      title: 'Payments Due', 
      value: stats?.paymentDue || 0, 
      onClick: () => setLocation('/superadmin/subscriptions')
    },
    { 
      title: 'Renewals Due', 
      value: stats?.renewalsDue || 0, 
      onClick: () => setLocation('/superadmin/subscriptions')
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">🚀 SaaS Platform Admin</h1>
          <p className="text-gray-600">Platform overview and management</p>
        </div>
        <Button
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700 transition-all h-10 px-4"
          onClick={handleLogout}
        >
          <LogOut size={18} className="mr-2" />
          Logout
        </Button>
      </div>

      {/* MAIN METRICS - ALL CLICKABLE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {metrics.map((card, idx) => {
          const Icon = card.icon;
          return (
            <button
              key={idx}
              onClick={card.onClick}
              className={`${card.color} rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-lg hover:scale-105 transition-all cursor-pointer text-left`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
                </div>
                <Icon className={`${card.iconColor} w-8 h-8`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* ALERTS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {alerts.map((alert, idx) => (
          <button
            key={idx}
            onClick={alert.onClick}
            className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-red-300 transition-all text-left cursor-pointer"
          >
            <p className="text-gray-600 text-sm font-medium">{alert.title}</p>
            <p className={`text-3xl font-bold mt-2 ${alert.value > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {alert.value}
            </p>
          </button>
        ))}
      </div>

      {/* FEATURES SECTION */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Platform Features</h2>
        <p className="text-gray-600 mb-4">Click any card above to navigate. Available features:</p>

        {/* SaaS Admin Dashboard Features */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-cyan-700 mb-3">📊 SaaS Admin Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm bg-cyan-50 p-4 rounded-lg border border-cyan-200 mb-4">
            <a href="/saas/admin" className="flex items-center gap-2 hover:text-cyan-700 font-medium cursor-pointer">
              <CheckCircle className="w-5 h-5 text-cyan-600" />
              <span>SaaS Admin Dashboard - Complete platform control</span>
            </a>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-cyan-600" />
              <span>Real-time analytics & metrics</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-cyan-600" />
              <span>Tenant lifecycle management</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-cyan-600" />
              <span>Revenue tracking & analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-cyan-600" />
              <span>Support ticket management</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-cyan-600" />
              <span>Plan & subscription management</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-cyan-600" />
              <span>Data sync & aggregation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-cyan-600" />
              <span>Multi-tab interface</span>
            </div>
          </div>
        </div>

        {/* Legacy SaaS Features */}
        <div>
          <h3 className="text-lg font-semibold text-blue-700 mb-3">🔧 Legacy SaaS Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Dashboard - Real-time platform metrics</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Tenants - Manage all customer tenants</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Tenant 360 - Complete tenant overview</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Plans - Subscription plans & pricing</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Subscriptions - Active subscriptions</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Billing - Revenue & payments</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Support - Customer support tickets</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Errors - Error reporting & tracking</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
