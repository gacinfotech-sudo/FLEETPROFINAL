import { useState } from "react";
import { Settings, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import WidgetManager from "./widget-manager";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";
import { RevenueChart, BookingActivityChart, FleetStatusChart, DriverStatusChart, PerformanceChart } from "./enhanced-charts";

interface BeautifulDashboardProps {
  onNavigate: (view: string) => void;
  onViewBooking: (booking: any) => void;
  onSelectCustomer: (customerId: string) => void;
  onFleetStatusClick: (status: string) => void;
  onDriverStatusClick: (status: string) => void;
  canViewRevenue: boolean;
}

export default function BeautifulDashboard({
  onNavigate,
  onViewBooking,
  onSelectCustomer,
  onFleetStatusClick,
  onDriverStatusClick,
  canViewRevenue,
}: BeautifulDashboardProps) {
  const { widgets, isLoading, toggleWidget, resetLayout } = useDashboardLayout();
  const [showManager, setShowManager] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div>
      {/* Gorgeous Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">⭐ Best View • Live overview of your fleet operations</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManager(true)}
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Customize
          </Button>
        </div>
      </div>

      {/* KPI Cards - Colorful Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Revenue Card */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">💰</span>
              <span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full">+12%</span>
            </div>
            <p className="text-sm text-gray-600 font-medium">REVENUE</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">₹45.2K</p>
            <p className="text-xs text-gray-500 mt-2">₹3.7L all-time</p>
          </CardContent>
        </Card>

        {/* Bookings Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">📅</span>
              <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">+8</span>
            </div>
            <p className="text-sm text-gray-600 font-medium">BOOKINGS</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">202</p>
            <p className="text-xs text-gray-500 mt-2">53 in pipeline</p>
          </CardContent>
        </Card>

        {/* Vehicles Card */}
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">🚗</span>
              <span className="text-xs font-bold text-purple-600 bg-purple-100 px-3 py-1 rounded-full">92%</span>
            </div>
            <p className="text-sm text-gray-600 font-medium">VEHICLES</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">63</p>
            <p className="text-xs text-gray-500 mt-2">26 available</p>
          </CardContent>
        </Card>

        {/* Drivers Card */}
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">👨</span>
              <span className="text-xs font-bold text-orange-600 bg-orange-100 px-3 py-1 rounded-full">15</span>
            </div>
            <p className="text-sm text-gray-600 font-medium">DRIVERS</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">82</p>
            <p className="text-xs text-gray-500 mt-2">38 available</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Trend - Full Width */}
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>

        {/* Fleet & Driver Status - Side by Side */}
        <FleetStatusChart />
        <DriverStatusChart />
      </div>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BookingActivityChart />
        <PerformanceChart />
      </div>

      {/* Widget Manager */}
      <WidgetManager
        widgets={widgets}
        onToggle={toggleWidget}
        onReset={resetLayout}
        isOpen={showManager}
        onClose={() => setShowManager(false)}
      />
    </div>
  );
}
