import React, { useState, useEffect } from 'react';
import { ChevronDown, Check, AlertCircle } from 'lucide-react';
import { apiClient } from '../utils/api-client';

interface Manager {
  userId: string;
  name: string;
  mobile: string;
  whatsapp?: string;
  role: string;
  designation: string;
}

interface Props {
  bookingId?: string;
  onManagerSelected?: (manager: Manager) => void;
  showDefault?: boolean;
  disabled?: boolean;
}

export default function BookingManagerSelector({
  bookingId,
  onManagerSelected,
  showDefault = false,
  disabled = false
}: Props) {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [defaultManager, setDefaultManager] = useState<Manager | null>(null);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignLoading, setAssignLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchManagers();
    if (bookingId) {
      fetchBookingManager();
    }
  }, [bookingId]);

  const fetchManagers = async () => {
    try {
      setLoading(true);
      const [managersRes, defaultRes] = await Promise.all([
        apiClient.get('/tenant/booking-managers'),
        apiClient.get('/tenant/booking-managers/default')
      ]);

      setManagers(managersRes.managers || []);
      if (defaultRes.defaultManager) {
        setDefaultManager(defaultRes.defaultManager);
        setSelectedManager(defaultRes.defaultManager);
      }
    } catch (err) {
      console.error('Failed to fetch managers:', err);
      setError('Failed to load managers');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingManager = async () => {
    try {
      if (!bookingId) return;
      const response = await apiClient.get(`/bookings/${bookingId}/manager`);
      if (response.manager) {
        setSelectedManager(response.manager);
      }
    } catch (err) {
      console.error('Failed to fetch booking manager:', err);
    }
  };

  const handleSelectManager = async (manager: Manager) => {
    setSelectedManager(manager);
    setIsOpen(false);

    if (bookingId) {
      try {
        setAssignLoading(true);
        await apiClient.post(`/bookings/${bookingId}/assign-manager`, {
          managerUserId: manager.userId
        });
        onManagerSelected?.(manager);
      } catch (err) {
        console.error('Failed to assign manager:', err);
        setError('Failed to assign manager');
      } finally {
        setAssignLoading(false);
      }
    } else {
      onManagerSelected?.(manager);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading managers...</div>;
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Booking Manager {!disabled && <span className="text-red-500">*</span>}
      </label>

      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 text-red-700 rounded text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
        >
          <span>
            {selectedManager ? (
              <span>
                <span className="font-medium">{selectedManager.name}</span>
                <span className="text-sm text-gray-500 ml-2">({selectedManager.designation})</span>
                {selectedManager === defaultManager && showDefault && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded inline-block">
                    Default
                  </span>
                )}
              </span>
            ) : (
              <span className="text-gray-400">Select a manager...</span>
            )}
          </span>
          <ChevronDown size={16} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && !disabled && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
            {managers.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                {managers.map(manager => (
                  <button
                    key={manager.userId}
                    onClick={() => handleSelectManager(manager)}
                    disabled={assignLoading}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 disabled:opacity-50 flex items-center justify-between border-b last:border-b-0"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{manager.name}</p>
                      <p className="text-xs text-gray-500">
                        {manager.designation} • {manager.mobile}
                      </p>
                    </div>
                    {selectedManager?.userId === manager.userId && (
                      <Check size={16} className="text-blue-600 flex-shrink-0" />
                    )}
                    {manager === defaultManager && showDefault && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-gray-500">No managers available</div>
            )}
          </div>
        )}
      </div>

      {selectedManager && (
        <div className="text-xs text-gray-600 space-y-1">
          <p>📱 {selectedManager.mobile}</p>
          {selectedManager.whatsapp && selectedManager.whatsapp !== selectedManager.mobile && (
            <p>💬 {selectedManager.whatsapp}</p>
          )}
        </div>
      )}

      {assignLoading && (
        <div className="text-xs text-blue-600">Assigning manager...</div>
      )}
    </div>
  );
}
