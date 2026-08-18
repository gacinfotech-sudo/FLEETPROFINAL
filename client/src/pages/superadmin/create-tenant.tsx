import { useState } from 'react';
import { useLocation } from 'wouter';
import { AlertCircle, CheckCircle } from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin-layout';

interface FormData {
  businessName: string;
  ownerName: string;
  ownerMobile: string;
  ownerEmail: string;
  city: string;
  status: 'active' | 'inactive';
}

interface FormErrors {
  [key: string]: string;
}

export default function CreateTenant() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    ownerName: '',
    ownerMobile: '',
    ownerEmail: '',
    city: '',
    status: 'active',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  function validateForm(): boolean {
    // ULTRA FAST: All fields optional - users can fill in later
    // No validation blocking, allow creating tenant with minimal data
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.businessName,
          businessName: formData.businessName,
          ownerName: formData.ownerName,
          ownerEmail: formData.ownerEmail,
          ownerMobile: formData.ownerMobile,
          city: formData.city,
          status: formData.status,
        }),
      });

      const data = await response.json();

      if (response.ok || response.status === 201) {
        setSuccess(true);
        setSuccessMessage(`Tenant "${formData.businessName}" created successfully!`);
        setTimeout(() => {
          setLocation('/superadmin/tenants');
        }, 2000);
      } else {
        setErrors({ submit: data.message || 'Failed to create tenant' });
      }
    } catch (error: any) {
      setErrors({ submit: error.message || 'Failed to create tenant. Please try again.' });
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center p-4 min-h-full">
        <div className="bg-white rounded-lg border border-green-200 p-8 text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Tenant Created!</h2>
          <p className="text-gray-600 mb-6">{successMessage}</p>
          <p className="text-sm text-gray-500">Redirecting to tenant list...</p>
        </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="max-w-2xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create New Tenant</h1>
          <p className="text-gray-600">Add a new customer tenant to the platform</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.businessName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., ABC Transportation Ltd"
              />
              {errors.businessName && (
                <p className="text-red-600 text-sm mt-1">{errors.businessName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Owner Name *
              </label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.ownerName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Rajesh Kumar"
              />
              {errors.ownerName && (
                <p className="text-red-600 text-sm mt-1">{errors.ownerName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Mobile *
              </label>
              <input
                type="tel"
                value={formData.ownerMobile}
                onChange={(e) => setFormData({ ...formData, ownerMobile: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.ownerMobile ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., +919876543210"
              />
              {errors.ownerMobile && (
                <p className="text-red-600 text-sm mt-1">{errors.ownerMobile}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Email / Login ID *
              </label>
              <input
                type="email"
                value={formData.ownerEmail}
                onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.ownerEmail ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., owner@company.com"
              />
              {errors.ownerEmail && (
                <p className="text-red-600 text-sm mt-1">{errors.ownerEmail}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Delhi"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800">{errors.submit}</p>
              </div>
            )}

            <div className="flex items-center gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Creating...' : 'Create Tenant'}
              </button>
              <button
                type="button"
                onClick={() => setLocation('/superadmin/tenants')}
                className="flex-1 bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
