// ============================================================================
// CRITICAL ALERT POPUP - Cannot be dismissed without action
// Phase 3: UI Components
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface CriticalAlertProps {
  onClose: () => void;
}

interface CriticalAlert {
  id: string;
  vehicleId: string;
  licensePlate: string;
  documentType: string;
  daysRemaining: number;
  expiryDate: string;
}

/**
 * Modal that shows critical alerts and cannot be dismissed
 * unless user takes action (view, upload, mark in progress)
 */
export const CriticalAlertPopup: React.FC<CriticalAlertProps> = ({ onClose }) => {
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  // Fetch critical alerts
  const { data: alertsData } = useQuery({
    queryKey: ['critical-alerts'],
    queryFn: async () => {
      const response = await fetch('/api/alerts/critical?limit=5');
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
  });

  const alerts = alertsData?.data || [];
  const currentAlert = alerts[currentAlertIndex];

  if (!currentAlert) {
    return null;
  }

  const handleAcknowledge = async () => {
    try {
      await fetch(`/api/alerts/${currentAlert.id}/acknowledge`, {
        method: 'POST',
      });
      setHasAcknowledged(true);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleNext = () => {
    if (currentAlertIndex < alerts.length - 1) {
      setCurrentAlertIndex(currentAlertIndex + 1);
      setHasAcknowledged(false);
    } else {
      onClose();
    }
  };

  const handleViewVehicle = () => {
    window.location.href = `/vehicles/${currentAlert.vehicleId}`;
  };

  const handleUploadDocument = () => {
    window.location.href = `/vehicles/${currentAlert.vehicleId}/documents/upload?type=${currentAlert.documentType}`;
  };

  const handleMarkRenewalInProgress = async () => {
    try {
      await fetch(`/api/documents/${currentAlert.documentType}/start-renewal`, {
        method: 'POST',
      });
      handleNext();
    } catch (error) {
      console.error('Failed to mark renewal:', error);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40"></div>

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full animate-pulse-subtle">
          {/* Header - Red Alert */}
          <div className="bg-red-600 text-white p-6 rounded-t-lg">
            <div className="flex items-center gap-2">
              <span className="text-4xl">🚨</span>
              <div>
                <h2 className="text-2xl font-bold">VEHICLE COMPLIANCE ALERT</h2>
                <p className="text-red-100 text-sm mt-1">Immediate attention required</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* Vehicle Info */}
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600">License Plate</p>
              <p className="text-2xl font-bold text-red-700 mt-1">
                {currentAlert.licensePlate}
              </p>
            </div>

            {/* Document Status */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 font-semibold mb-2">Document Expiring:</p>
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3">
                <p className="font-bold text-gray-800">{currentAlert.documentType}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {currentAlert.daysRemaining < 0
                    ? `EXPIRED ${Math.abs(currentAlert.daysRemaining)} days ago`
                    : currentAlert.daysRemaining === 0
                      ? 'EXPIRES TODAY'
                      : `Expires in ${currentAlert.daysRemaining} days`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Expiry: {new Date(currentAlert.expiryDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">
                <strong>Cannot proceed with bookings</strong> until this document is renewed.
                This vehicle is marked as{' '}
                <strong>NOT ROAD READY</strong>.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 mb-4">
              <button
                onClick={handleUploadDocument}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                📤 Upload/Renew Document
              </button>
              <button
                onClick={handleMarkRenewalInProgress}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                ⏱️ Mark Renewal In Progress
              </button>
              <button
                onClick={handleViewVehicle}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                👁️ View Vehicle Details
              </button>
            </div>

            {/* Acknowledge Checkbox */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg mb-4">
              <input
                type="checkbox"
                id="acknowledge"
                checked={hasAcknowledged}
                onChange={(e) => setHasAcknowledged(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="acknowledge" className="text-sm text-gray-700 cursor-pointer">
                I acknowledge this alert and will take action
              </label>
            </div>

            {/* Alert Counter */}
            <p className="text-xs text-gray-500 text-center mb-4">
              Alert {currentAlertIndex + 1} of {alerts.length}
            </p>

            {/* Next Button - Only enabled after acknowledgment */}
            <button
              onClick={handleNext}
              disabled={!hasAcknowledged}
              className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
                hasAcknowledged
                  ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
            >
              {currentAlertIndex < alerts.length - 1 ? 'Next Alert →' : 'Close'}
            </button>
          </div>

          {/* Note */}
          <div className="bg-gray-50 p-4 rounded-b-lg border-t">
            <p className="text-xs text-gray-600 italic">
              ℹ️ This alert cannot be dismissed without taking action. Please renew your document
              or mark it as in progress.
            </p>
          </div>
        </div>
      </div>

      {/* Pulse Animation */}
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { animation: none; }
          50% { box-shadow: 0 0 20px rgba(220, 38, 38, 0.3); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </>
  );
};

export default CriticalAlertPopup;
