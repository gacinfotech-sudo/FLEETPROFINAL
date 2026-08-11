import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardOverview from "./overview";
import WidgetManager from "./widget-manager";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";

interface PremiumDashboardProps {
  onNavigate: (view: string) => void;
  onViewBooking: (booking: any) => void;
  onSelectCustomer: (customerId: string) => void;
  onFleetStatusClick: (status: string) => void;
  onDriverStatusClick: (status: string) => void;
  canViewRevenue: boolean;
}

export default function PremiumDashboard({
  onNavigate,
  onViewBooking,
  onSelectCustomer,
  onFleetStatusClick,
  onDriverStatusClick,
  canViewRevenue,
}: PremiumDashboardProps) {
  const { widgets, isLoading, toggleWidget, resetLayout } = useDashboardLayout();
  const [showManager, setShowManager] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div>
      {/* Premium Header */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 rounded-2xl p-8 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Welcome Back! 👋</h1>
              <p className="text-blue-100 mt-2 text-lg">Your fleet operations at a glance</p>
            </div>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={() => setShowManager(true)}
              title="Customize dashboard"
            >
              <Settings className="w-5 h-5 mr-2" />
              Customize
            </Button>
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="space-y-6">
        {/* Top Row - KPIs with Colorful Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue Card */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">💰</span>
              </div>
              <div className="text-xs font-semibold text-green-700 bg-green-200 px-3 py-1 rounded-full">
                +12%
              </div>
            </div>
            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">Revenue Today</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">₹45,230</p>
          </div>

          {/* Bookings Card */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">📅</span>
              </div>
              <div className="text-xs font-semibold text-blue-700 bg-blue-200 px-3 py-1 rounded-full">
                +8
              </div>
            </div>
            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">Active Bookings</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">24 Trips</p>
          </div>

          {/* Fleet Card */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">🚗</span>
              </div>
              <div className="text-xs font-semibold text-purple-700 bg-purple-200 px-3 py-1 rounded-full">
                92%
              </div>
            </div>
            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">Available Vehicles</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">18/20</p>
          </div>

          {/* Drivers Card */}
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">👨</span>
              </div>
              <div className="text-xs font-semibold text-orange-700 bg-orange-200 px-3 py-1 rounded-full">
                15
              </div>
            </div>
            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">Active Drivers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">14 On Duty</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Revenue Chart - Full Width */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Revenue Trend</h3>
                <p className="text-sm text-gray-500">Last 30 days performance</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                  7D
                </button>
                <button className="px-3 py-1 text-xs font-medium text-gray-600 rounded-lg hover:bg-gray-100">
                  30D
                </button>
                <button className="px-3 py-1 text-xs font-medium text-gray-600 rounded-lg hover:bg-gray-100">
                  90D
                </button>
              </div>
            </div>
            <div className="bg-gradient-to-b from-blue-50 to-purple-50 rounded-lg p-4 h-64">
              <div className="h-full flex items-center justify-center text-gray-400">
                <p>📊 Revenue Chart Visualization</p>
              </div>
            </div>
          </div>

          {/* Status Cards */}
          <div className="lg:col-span-4 space-y-4">
            {/* GPS Status */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">GPS Status</p>
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              </div>
              <p className="text-2xl font-bold text-teal-700">18/20</p>
              <p className="text-xs text-teal-600 mt-1">Devices Online</p>
            </div>

            {/* Alerts */}
            <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border border-red-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">Alerts</p>
                <span className="px-2 py-1 text-xs font-bold text-white bg-red-500 rounded-full">3</span>
              </div>
              <p className="text-xs text-red-600">2 Urgent • 1 Warning</p>
            </div>

            {/* Efficiency */}
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">Efficiency</p>
                <span className="text-xs font-bold text-orange-600">85%</span>
              </div>
              <div className="w-full bg-yellow-200 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: "85%" }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Graphs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Booking Activity */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Booking Activity</h3>
            <div className="bg-gradient-to-b from-indigo-50 to-blue-50 rounded-lg p-4 h-48">
              <div className="h-full flex items-center justify-center text-gray-400">
                <p>📈 Activity Chart</p>
              </div>
            </div>
          </div>

          {/* Fleet Status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Fleet Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Available</span>
                </div>
                <span className="text-lg font-bold text-green-600">18</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">On Trip</span>
                </div>
                <span className="text-lg font-bold text-blue-600">2</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Maintenance</span>
                </div>
                <span className="text-lg font-bold text-orange-600">0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Full Width Dashboard Overview */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <DashboardOverview
            onNavigate={onNavigate}
            onViewBooking={onViewBooking}
            onSelectCustomer={onSelectCustomer}
            onFleetStatusClick={onFleetStatusClick}
            onDriverStatusClick={onDriverStatusClick}
            canViewRevenue={canViewRevenue}
          />
        </div>
      </div>

      {/* Widget Manager Modal */}
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
