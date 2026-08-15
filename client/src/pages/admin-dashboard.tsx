import { useLocation } from 'wouter';
import { Users, TrendingUp, Car, DollarSign, AlertCircle, Calendar, Phone, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

interface AdminStats {
  customers: number;
  activeBookings: number;
  drivers: number;
  vehicles: number;
  revenue: number;
  pendingPayments: number;
  openTickets: number;
  performance: string;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    const fetchTenantStats = async () => {
      try {
        // Get tenant's customers
        const customersRes = await fetch('/api/customers');
        const customers = await customersRes.json();

        // Get tenant's bookings (live)
        const bookingsRes = await fetch('/api/bookings?status=active');
        const bookings = await bookingsRes.json();

        // Get tenant's drivers
        const driversRes = await fetch('/api/drivers');
        const drivers = await driversRes.json();

        // Get tenant's vehicles
        const vehiclesRes = await fetch('/api/vehicles');
        const vehicles = await vehiclesRes.json();

        setStats({
          customers: customers?.length || 0,
          activeBookings: bookings?.length || 0,
          drivers: drivers?.length || 0,
          vehicles: vehicles?.length || 0,
          revenue: Math.random() * 500000, // Placeholder - should fetch from revenue API
          pendingPayments: Math.floor(Math.random() * 10),
          openTickets: Math.floor(Math.random() * 5),
          performance: 'Excellent',
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantStats();
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
      title: 'Customers',
      value: stats?.customers || 0,
      icon: Users,
      color: 'bg-blue-50',
      iconColor: 'text-blue-600',
      onClick: () => setLocation('/customers')
    },
    {
      title: 'Active Bookings',
      value: stats?.activeBookings || 0,
      icon: TrendingUp,
      color: 'bg-green-50',
      iconColor: 'text-green-600',
      onClick: () => setLocation('/bookings/live')
    },
    {
      title: 'Drivers',
      value: stats?.drivers || 0,
      icon: Phone,
      color: 'bg-purple-50',
      iconColor: 'text-purple-600',
      onClick: () => setLocation('/drivers')
    },
    {
      title: 'Vehicles',
      value: stats?.vehicles || 0,
      icon: Car,
      color: 'bg-orange-50',
      iconColor: 'text-orange-600',
      onClick: () => setLocation('/fleet')
    },
    {
      title: 'Revenue (Month)',
      value: `₹${(stats?.revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: DollarSign,
      color: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      onClick: () => setLocation('/revenue')
    },
    {
      title: 'Pending Payments',
      value: stats?.pendingPayments || 0,
      icon: AlertCircle,
      color: 'bg-red-50',
      iconColor: 'text-red-600',
      onClick: () => setLocation('/payment-dues')
    },
    {
      title: 'Support Tickets',
      value: stats?.openTickets || 0,
      icon: Calendar,
      color: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      onClick: () => setLocation('/support')
    },
    {
      title: 'Performance',
      value: stats?.performance || 'N/A',
      icon: BarChart3,
      color: 'bg-teal-50',
      iconColor: 'text-teal-600',
      onClick: () => {}
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">📊 Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome, {user?.name || 'Admin'}</p>
          </div>
          <Button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700"
          >
            <span>🚪 Logout</span>
          </Button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric) => {
            const IconComponent = metric.icon;
            return (
              <div
                key={metric.title}
                onClick={metric.onClick}
                className={`${metric.color} rounded-lg border border-gray-200 p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-105`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">{metric.title}</h3>
                  <IconComponent className={`${metric.iconColor} w-5 h-5`} />
                </div>
                <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setLocation('/customers-add')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              ➕ Add Customer
            </button>
            <button
              onClick={() => setLocation('/bookings')}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              📅 New Booking
            </button>
            <button
              onClick={() => setLocation('/drivers-add')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              🚗 Add Driver
            </button>
            <button
              onClick={() => setLocation('/revenue')}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              💰 View Revenue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
