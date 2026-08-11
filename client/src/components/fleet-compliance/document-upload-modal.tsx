// ============================================================================
// DOCUMENT UPLOAD MODAL - Upload and renew documents
// Phase 3: UI Components
// ============================================================================

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

interface DocumentUploadModalProps {
  vehicleId: string;
  licensePlate: string;
  documentType: string;
  onSuccess: () => void;
  onClose: () => void;
}

/**
 * Modal for uploading and renewing vehicle documents
 */
export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  vehicleId,
  licensePlate,
  documentType,
  onSuccess,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    documentNumber: '',
    issueDate: '',
    validFrom: '',
    expiryDate: '',
    issuingAuthority: '',
    file: null as File | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const formDataToSend = new FormData();
      formDataToSend.append('documentType', documentType);
      formDataToSend.append('documentNumber', data.documentNumber);
      formDataToSend.append('issueDate', data.issueDate);
      formDataToSend.append('validFrom', data.validFrom);
      formDataToSend.append('expiryDate', data.expiryDate);
      formDataToSend.append('issuingAuthority', data.issuingAuthority || '');
      if (data.file) {
        formDataToSend.append('file', data.file);
      }

      const response = await fetch(`/api/vehicles/${vehicleId}/documents`, {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      return response.json();
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;
    if (name === 'file') {
      setFormData({ ...formData, file: files?.[0] || null });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    // Clear error for this field
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.documentNumber) newErrors.documentNumber = 'Document number is required';
    if (!formData.issueDate) newErrors.issueDate = 'Issue date is required';
    if (!formData.validFrom) newErrors.validFrom = 'Valid from date is required';
    if (!formData.expiryDate) newErrors.expiryDate = 'Expiry date is required';
    if (!formData.file) newErrors.file = 'Document file is required';

    // Date validations
    if (formData.issueDate && formData.validFrom) {
      if (new Date(formData.issueDate) > new Date(formData.validFrom)) {
        newErrors.issueDate = 'Issue date must be before valid from date';
      }
    }

    if (formData.validFrom && formData.expiryDate) {
      if (new Date(formData.validFrom) >= new Date(formData.expiryDate)) {
        newErrors.expiryDate = 'Expiry date must be after valid from date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      uploadMutation.mutate(formData);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Upload {documentType}</h2>
              <p className="text-blue-100 text-sm mt-1">{licensePlate}</p>
            </div>
            <button
              onClick={onClose}
              className="text-2xl font-bold hover:text-blue-200 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Document Number */}
            <FormField
              label="Document Number"
              name="documentNumber"
              value={formData.documentNumber}
              onChange={handleChange}
              placeholder="e.g., DL01AB1234"
              error={errors.documentNumber}
              required
            />

            {/* Issue Date */}
            <FormField
              label="Issue Date"
              name="issueDate"
              type="date"
              value={formData.issueDate}
              onChange={handleChange}
              error={errors.issueDate}
              required
            />

            {/* Valid From Date */}
            <FormField
              label="Valid From"
              name="validFrom"
              type="date"
              value={formData.validFrom}
              onChange={handleChange}
              error={errors.validFrom}
              required
            />

            {/* Expiry Date */}
            <FormField
              label="Expiry Date"
              name="expiryDate"
              type="date"
              value={formData.expiryDate}
              onChange={handleChange}
              error={errors.expiryDate}
              required
            />

            {/* Issuing Authority */}
            <FormField
              label="Issuing Authority"
              name="issuingAuthority"
              value={formData.issuingAuthority}
              onChange={handleChange}
              placeholder="e.g., Regional Transport Office"
            />

            {/* File Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Document File *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  name="file"
                  onChange={handleChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  id="file-input"
                  required
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <div className="text-2xl mb-2">📄</div>
                  <p className="text-sm text-gray-600">
                    {formData.file ? (
                      <span className="text-green-600 font-semibold">{formData.file.name}</span>
                    ) : (
                      <>
                        <span className="text-blue-600">Click to upload</span> or drag and drop
                        <br />
                        <span className="text-xs text-gray-500">PDF, JPG, or PNG (max 10MB)</span>
                      </>
                    )}
                  </p>
                </label>
              </div>
              {errors.file && <p className="text-red-600 text-sm mt-1">{errors.file}</p>}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploadMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 cursor-pointer"
              >
                {uploadMutation.isPending ? '⏳ Uploading...' : '✓ Upload'}
              </button>
            </div>

            {uploadMutation.isError && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  ❌ {(uploadMutation.error as Error)?.message || 'Failed to upload document'}
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
};

/**
 * Reusable Form Field Component
 */
interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required,
}) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      {label}
      {required && <span className="text-red-600 ml-1">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-300 focus:ring-blue-500'
      }`}
    />
    {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
  </div>
);

export default DocumentUploadModal;
