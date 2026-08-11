// ============================================================================
// COMPLIANCE STATUS CARD - Vehicle readiness indicator
// Phase 3: UI Components
// ============================================================================

import React from 'react';
import {
  VehicleReadiness,
  DocumentStatus,
  AlertSeverity,
} from '../../types/fleet-compliance.types';

interface ComplianceStatusCardProps {
  licensePlate: string;
  overallStatus: VehicleReadiness;
  compliancePercentage: number;
  documents: {
    documentType: string;
    status: DocumentStatus;
    daysRemaining: number;
  }[];
  criticalCount: number;
  onViewDetails: () => void;
}

/**
 * Displays vehicle compliance status with visual indicators
 */
export const ComplianceStatusCard: React.FC<ComplianceStatusCardProps> = ({
  licensePlate,
  overallStatus,
  compliancePercentage,
  documents,
  criticalCount,
  onViewDetails,
}) => {
  // Determine colors based on status
  const getStatusColor = (status: VehicleReadiness): string => {
    switch (status) {
      case VehicleReadiness.ROAD_READY:
        return 'bg-green-100 border-green-500 text-green-700';
      case VehicleReadiness.ATTENTION_REQUIRED:
        return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      case VehicleReadiness.NOT_ROAD_READY:
        return 'bg-red-100 border-red-500 text-red-700';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  const getStatusIcon = (status: VehicleReadiness): string => {
    switch (status) {
      case VehicleReadiness.ROAD_READY:
        return '✅';
      case VehicleReadiness.ATTENTION_REQUIRED:
        return '⚠️';
      case VehicleReadiness.NOT_ROAD_READY:
        return '🚫';
      default:
        return '❓';
    }
  };

  const getStatusLabel = (status: VehicleReadiness): string => {
    switch (status) {
      case VehicleReadiness.ROAD_READY:
        return 'Road Ready';
      case VehicleReadiness.ATTENTION_REQUIRED:
        return 'Attention Required';
      case VehicleReadiness.NOT_ROAD_READY:
        return 'Not Road Ready';
      default:
        return 'Unknown';
    }
  };

  // Count document statuses
  const validDocs = documents.filter((d) => d.status === DocumentStatus.VALID).length;
  const expiringDocs = documents.filter(
    (d) => d.status === DocumentStatus.EXPIRING_SOON
  ).length;
  const expiredDocs = documents.filter((d) => d.status === DocumentStatus.EXPIRED).length;

  return (
    <div
      className={`border-l-4 p-4 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow ${getStatusColor(
        overallStatus
      )}`}
      onClick={onViewDetails}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getStatusIcon(overallStatus)}</span>
          <div>
            <h3 className="font-bold text-lg">{licensePlate}</h3>
            <p className="text-sm font-semibold">{getStatusLabel(overallStatus)}</p>
          </div>
        </div>
        {criticalCount > 0 && (
          <div className="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
            {criticalCount}
          </div>
        )}
      </div>

      {/* Compliance Percentage */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span>Compliance</span>
          <span className="font-bold">{compliancePercentage}%</span>
        </div>
        <div className="w-full bg-gray-300 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              compliancePercentage === 100
                ? 'bg-green-500'
                : compliancePercentage >= 75
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${compliancePercentage}%` }}
          />
        </div>
      </div>

      {/* Document Summary */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="text-center">
          <div className="font-bold text-green-600">{validDocs}</div>
          <div className="text-xs">Valid</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-yellow-600">{expiringDocs}</div>
          <div className="text-xs">Expiring</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-red-600">{expiredDocs}</div>
          <div className="text-xs">Expired</div>
        </div>
      </div>

      {/* View Details Link */}
      <div className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-800">
        View Details →
      </div>
    </div>
  );
};

export default ComplianceStatusCard;
