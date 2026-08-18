/**
 * BOOKING DRAFT FORM WITH AUTO-SAVE
 * Demonstrates integration of phone lookup + draft system
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSession } from '../../contexts/SessionContext';
import apiClient from '../../utils/api-client';
import { normalizeIndianPhone } from '../../utils/phone-normalization';

interface Customer {
  _id: string;
  name: string;
  email: string;
  phone: string;
  lastBookingDate?: string;
  bookingCount?: number;
}

interface BookingDraft {
  draftId: string;
  customerName?: string;
  customerPhone?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupDate?: string;
  progressStep: number;
}

export const BookingDraftForm: React.FC = () => {
  const { user } = useSession();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    pickupLocation: '',
    dropoffLocation: '',
    pickupDate: '',
    vehicleCategory: '',
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draftCreateStatus, setDraftCreateStatus] = useState<'idle' | 'creating' | 'created' | 'error'>('idle');

  // Initialize draft on component mount
  useEffect(() => {
    initializeDraft();
  }, []);

  const initializeDraft = async () => {
    try {
      setDraftCreateStatus('creating');
      const result = await apiClient.post<{ draftId: string; isNew: boolean }>(
        '/tenant/bookings/draft/start',
        {}
      );
      setDraftId(result.draftId);
      setDraftCreateStatus('created');
    } catch (err) {
      console.error('Error creating draft:', err);
      setDraftCreateStatus('error');
    }
  };

  // Auto-save draft (debounced)
  useEffect(() => {
    if (!draftId || !user) return;

    const timer = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        await apiClient.post(`/tenant/bookings/draft/${draftId}/save`, {
          ...formData,
          customerPhone,
          progressStep: 3,
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Error saving draft:', err);
        setSaveStatus('error');
      }
    }, 2000); // Debounce 2 seconds

    return () => clearTimeout(timer);
  }, [formData, customerPhone, draftId, user]);

  // Customer lookup
  const handleLookupCustomer = async () => {
    if (!customerPhone) {
      setLookupError('Please enter a phone number');
      return;
    }

    try {
      setLookupLoading(true);
      setLookupError(null);

      const normalized = normalizeIndianPhone(customerPhone);
      if (!normalized) {
        setLookupError('Invalid phone number format');
        return;
      }

      const result = await apiClient.get<{ found: boolean; customer?: Customer }>(
        '/tenant/customers/lookup',
        { params: { mobile: normalized } }
      );

      if (result.found && result.customer) {
        setCustomer(result.customer);
        setFormData((prev) => ({
          ...prev,
          // Could pre-fill other customer data here
        }));
      } else {
        setCustomer(null);
        // New customer
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitBooking = async () => {
    if (!draftId || !customerPhone) {
      alert('Please complete all required fields');
      return;
    }

    try {
      const result = await apiClient.post<{ bookingId: string }>(
        `/tenant/bookings/draft/${draftId}/finalize`,
        {
          ...formData,
          customerPhone,
        }
      );

      alert(`Booking created: ${result.bookingId}`);
      // Reset form
      setFormData({
        pickupLocation: '',
        dropoffLocation: '',
        pickupDate: '',
        vehicleCategory: '',
      });
      setCustomer(null);
      setCustomerPhone('');
      initializeDraft();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create booking');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Create Booking</h1>

      {/* Draft Info */}
      {draftId && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            Draft ID: <code className="font-mono">{draftId}</code>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Auto-saving enabled. Your progress is saved automatically.
          </p>
        </div>
      )}

      {/* Save Status */}
      {saveStatus !== 'idle' && (
        <div
          className={`mb-4 p-3 rounded-md text-sm ${
            saveStatus === 'saving'
              ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
              : saveStatus === 'saved'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {saveStatus === 'saving' && '💾 Saving...'}
          {saveStatus === 'saved' && '✅ Saved'}
          {saveStatus === 'error' && '❌ Save failed'}
        </div>
      )}

      {/* Customer Lookup Section */}
      <div className="mb-6 pb-6 border-b">
        <h2 className="text-lg font-semibold mb-4">Customer Information</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="tel"
            placeholder="Enter customer phone (e.g., 9876543210)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleLookupCustomer}
            disabled={lookupLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {lookupLoading ? 'Looking up...' : 'Lookup'}
          </button>
        </div>

        {lookupError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm mb-4">
            {lookupError}
          </div>
        )}

        {customer && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="font-semibold text-green-900">✅ Customer Found</p>
            <p className="text-sm text-green-800 mt-2">
              Name: <span className="font-medium">{customer.name}</span>
            </p>
            <p className="text-sm text-green-800">
              Email: <span className="font-medium">{customer.email}</span>
            </p>
            {customer.bookingCount && (
              <p className="text-sm text-green-800">
                Previous bookings: <span className="font-medium">{customer.bookingCount}</span>
              </p>
            )}
          </div>
        )}

        {!customer && customerPhone && !lookupLoading && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              ℹ️ New customer. Fill in the details below to create a new booking.
            </p>
          </div>
        )}
      </div>

      {/* Booking Details Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Booking Details</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pickup Location
            </label>
            <input
              type="text"
              value={formData.pickupLocation}
              onChange={(e) => handleFormChange('pickupLocation', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Airport Terminal 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dropoff Location
            </label>
            <input
              type="text"
              value={formData.dropoffLocation}
              onChange={(e) => handleFormChange('dropoffLocation', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Hotel Downtown"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pickup Date & Time
            </label>
            <input
              type="datetime-local"
              value={formData.pickupDate}
              onChange={(e) => handleFormChange('pickupDate', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle Category
            </label>
            <select
              value={formData.vehicleCategory}
              onChange={(e) => handleFormChange('vehicleCategory', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option value="sedan">Sedan</option>
              <option value="suv">SUV</option>
              <option value="tempo">Tempo Traveller</option>
            </select>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleSubmitBooking}
          disabled={!customerPhone || !formData.pickupLocation}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors font-semibold"
        >
          Create Booking
        </button>
        <button
          onClick={() => {
            setFormData({
              pickupLocation: '',
              dropoffLocation: '',
              pickupDate: '',
              vehicleCategory: '',
            });
            setCustomer(null);
            setCustomerPhone('');
          }}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-semibold"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default BookingDraftForm;
