// ============================================================================
// FLEET COMPLIANCE DASHBOARD - Main compliance overview
// Phase 3: UI Components
// ============================================================================

import React, { useState, useEffect } from 'react';
import ComplianceStatusCard from './compliance-status-card';
import CriticalAlertPopup from './critical-alert-popup';
import { useQuery } from '@tanstack/react-query';
import { VehicleReadiness } from '../../types/fleet-compliance.types';

interface DashboardData {
  totalVehicles: number;
  compliantVehicles: number;
  expiringIn30Days: number;
  expiringIn7Days: number;
  critical: number;
  expired: number;
  missing: number;
  roadReady: number;
  attentionRequired: number;
  notRoadReady: number;
}

interface VehicleComplianceData {
  vehicleId: string;
  licensePlate: string;
  overallStatus: VehicleReadiness;
  compliancePercentage: number;
  documents: Array<{
    documentType: string;
    status: string;
    daysRemaining: number;
  }>;
  criticalAlerts: number;
}

/**
 * Main fleet compliance dashboard
 */
export const FleetComplianceDashboard: React.FC = () => {
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleComplianceData | null>(null);
  const [filterStatus, setFilterStatus] = useState<VehicleReadiness | 'ALL'>('ALL');
  const [showCriticalAlert, setShowCriticalAlert] = useState(false);

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ['fleet-compliance-dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/fleet/compliance-dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      return response.json();
    },
  });

  // Fetch vehicle compliance list
  const { data: vehiclesList, isLoading: vehiclesLoading } = useQuery<
    VehicleComplianceData[]
  >({
    queryKey: ['fleet-vehicles-compliance'],
    queryFn: async () => {
      const response = await fetch('/api/vehicles/compliance-list');
      if (!response.ok) throw new Error('Failed to fetch vehicles');
      return response.json();
    },
  });

  // Check for critical alerts on mount
  useEffect(() => {
    const checkCriticalAlerts = async () => {
      try {
        const response = await fetch('/api/alerts/critical?limit=1');
        if (response.ok) {
          const data = await response.json();
          if (data.count > 0) {
            setShowCriticalAlert(true);
          }
        }
      } catch (error) {
        console.error('Failed to check critical alerts:', error);
      }
    };

    checkCriticalAlerts();
  }, []);

  // Filter vehicles
  const filteredVehicles =
    filterStatus === 'ALL'
      ? vehiclesList || []
      : (vehiclesList || []).filter((v) => v.overallStatus === filterStatus);

  if (dashboardLoading || vehiclesLoading) {
    return <div className="p-6 text-center">Loading compliance data...</div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Critical Alert Popup */}
      {showCriticalAlert && (
        <CriticalAlertPopup onClose={() => setShowCriticalAlert(false)} />
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Fleet Compliance Dashboard</h1>
        <p className="text-gray-600 mt-1">Monitor vehicle document expiry and compliance status</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard
          label="Total Vehicles"
          value={dashboardData?.totalVehicles || 0}
          icon="🚗"
          color="bg-blue-50 border-blue-200"
        />
        <KPICard
          label="Road Ready"
          value={dashboardData?.roadReady || 0}
          icon="✅"
          color="bg-green-50 border-green-200"
        />
        <KPICard
          label="Needs Attention"
          value={dashboardData?.attentionRequired || 0}
          icon="⚠️"
          color="bg-yellow-50 border-yellow-200"
        />
        <KPICard
          label="Critical"
          value={dashboardData?.critical || 0}
          icon="🚫"
          color="bg-red-50 border-red-200"
        />
      </div>

      {/* Expiry Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-orange-500">
          <h3 className="font-bold text-orange-700">Expiring in 30 Days</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">
            {dashboardData?.expiringIn30Days || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Documents requiring attention</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-yellow-500">
          <h3 className="font-bold text-yellow-700">Expiring in 7 Days</h3>
          <p className="text-3xl font-bold text-yellow-600 mt-2">
            {dashboardData?.expiringIn7Days || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Urgent renewal needed</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-red-500">
          <h3 className="font-bold text-red-700">Expired</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">
            {dashboardData?.expired || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Immediate action required</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <FilterButton
          label="All Vehicles"
          isActive={filterStatus === 'ALL'}
          onClick={() => setFilterStatus('ALL')}
        />
        <FilterButton
          label="Road Ready"
          isActive={filterStatus === VehicleReadiness.ROAD_READY}
          onClick={() => setFilterStatus(VehicleReadiness.ROAD_READY)}
          icon="✅"
          color="green"
        />
        <FilterButton
          label="Attention Required"
          isActive={filterStatus === VehicleReadiness.ATTENTION_REQUIRED}
          onClick={() => setFilterStatus(VehicleReadiness.ATTENTION_REQUIRED)}
          icon="⚠️"
          color="yellow"
        />
        <FilterButton
          label="Not Road Ready"
          isActive={filterStatus === VehicleReadiness.NOT_ROAD_READY}
          onClick={() => setFilterStatus(VehicleReadiness.NOT_ROAD_READY)}
          icon="🚫"
          color="red"
        />
      </div>

      {/* Vehicles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVehicles.map((vehicle) => (
          <ComplianceStatusCard
            key={vehicle.vehicleId}
            licensePlate={vehicle.licensePlate}
            overallStatus={vehicle.overallStatus}
            compliancePercentage={vehicle.compliancePercentage}
            documents={vehicle.documents}
            criticalCount={vehicle.criticalAlerts}
            onViewDetails={() => setSelectedVehicle(vehicle)}
          />
        ))}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No vehicles found with selected filter</p>
        </div>
      )}
    </div>
  );
};

/**
 * KPI Card Component
 */
interface KPICardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, icon, color }) => (
  <div className={`${color} border rounded-lg p-4 shadow-sm`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      </div>
      <span className="text-3xl">{icon}</span>
    </div>
  </div>
);

/**
 * Filter Button Component
 */
interface FilterButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon?: string;
  color?: string;
}

const FilterButton: React.FC<FilterButtonProps> = ({ label, isActive, onClick, icon, color }) => {
  const colorClass =
    color === 'green'
      ? 'bg-green-100 border-green-300 text-green-700'
      : color === 'yellow'
        ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
        : color === 'red'
          ? 'bg-red-100 border-red-300 text-red-700'
          : 'bg-gray-100 border-gray-300 text-gray-700';

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
        isActive
          ? `${colorClass} font-bold`
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
      }`}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {label}
    </button>
  );
};

export default FleetComplianceDashboard;
