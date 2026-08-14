/**
 * DRIVER 360: SALARY DETAILS SECTION
 * ===================================
 * Comprehensive salary master information card
 * Displays: Current Salary, Joining Salary, Effective Date, Food Allowance
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Calendar, DollarSign, TrendingUp, Edit2 } from 'lucide-react';
import { DriverSalarySetupPanel } from '@/components/onboarding';

interface SalaryDetailsData {
  joiningBaseSalary: number;
  currentBaseSalary: number;
  foodAllowance?: number;
  salaryStartDate: string;
  salaryType: string;
  employmentType: string;
  status: string;
  lastUpdated?: string;
}

interface Props {
  driverId: string;
}

export function SalaryDetailsSection({ driverId }: Props) {
  const [data, setData] = useState<SalaryDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [driverName, setDriverName] = useState('Driver');

  useEffect(() => {
    fetchSalaryDetails();
  }, [driverId]);

  const fetchSalaryDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/driver-salary/master/${driverId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError('Salary configuration not found for this driver');
        } else {
          throw new Error('Failed to fetch salary details');
        }
      } else {
        const result = await response.json();
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      console.error('[SalaryDetailsSection] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch salary details');
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverName = async () => {
    try {
      const response = await fetch(`/api/drivers/${driverId}`);
      if (response.ok) {
        const result = await response.json();
        setDriverName(result.data?.name || 'Driver');
      }
    } catch (err) {
      console.error('Failed to fetch driver name:', err);
    }
  };

  const handleSalarySetupComplete = () => {
    setShowEditForm(false);
    fetchSalaryDetails();
  };

  useEffect(() => {
    fetchDriverName();
  }, [driverId]);

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return 'N/A';
    return `₹${(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const getSalaryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'fixed_monthly': 'Fixed Monthly',
      'daily': 'Daily Wage',
      'per_trip': 'Per Trip',
      'fixed_incentive': 'Fixed + Incentive',
      'custom': 'Custom'
    };
    return labels[type] || type;
  };

  const getEmploymentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'permanent': 'Permanent',
      'contract': 'Contract',
      'probation': 'Probation',
      'temporary': 'Temporary',
      'casual': 'Casual'
    };
    return labels[type] || type;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'terminated':
        return 'bg-red-100 text-red-800';
      case 'on_leave':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <h3 className="font-medium text-orange-800">Salary Information</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditForm(true)}
                className="gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Create Salary
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-700">{error}</p>
            <p className="text-xs text-orange-600 mt-2">Click "Create Salary" to set up salary configuration for this driver</p>
          </CardContent>
        </Card>

        {/* Edit/Create Salary Form Dialog */}
        <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Salary Configuration</DialogTitle>
            </DialogHeader>
            <DriverSalarySetupPanel
              driverId={driverId}
              driverName={driverName}
              onSalarySetupComplete={handleSalarySetupComplete}
              onCancel={() => setShowEditForm(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500">No salary data available</p>
        </CardContent>
      </Card>
    );
  }

  // Check if joining and current salary are the same
  const salaryIncrement = data.currentBaseSalary - data.joiningBaseSalary;
  const hasIncrement = salaryIncrement > 0;

  return (
    <div className="space-y-4">
      {/* Main Salary Card */}
      <Card className="border-2 border-blue-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Salary Details</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditForm(true)}
                className="gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Edit Salary
              </Button>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(data.status)}`}>
                {data.status.toUpperCase()}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary Salary Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Salary */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm text-blue-700 font-medium">Current Salary</span>
                {hasIncrement && (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                )}
              </div>
              <p className="text-3xl font-bold text-blue-900">
                {formatCurrency(data.currentBaseSalary)}
              </p>
              <p className="text-xs text-blue-600 mt-2">Per Month</p>
            </div>

            {/* Joining Salary */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm text-gray-700 font-medium">Joining Salary</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(data.joiningBaseSalary)}
              </p>
              <p className="text-xs text-gray-600 mt-2">At time of joining</p>
            </div>
          </div>

          {/* Salary Increment Information (if applicable) */}
          {hasIncrement && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-4 rounded-lg">
              <p className="text-sm font-medium text-green-900 mb-1">Salary Increment</p>
              <p className="text-2xl font-bold text-green-600">
                +{formatCurrency(salaryIncrement)}
              </p>
              <p className="text-xs text-green-700 mt-2">
                Growth since joining: {((salaryIncrement / data.joiningBaseSalary) * 100).toFixed(1)}%
              </p>
            </div>
          )}

          {/* Effective Date and Food Allowance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            {/* Effective Date */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-purple-700 font-medium">Effective Date</span>
              </div>
              <p className="text-base font-semibold text-purple-900">
                {formatDate(data.salaryStartDate)}
              </p>
              <p className="text-xs text-purple-600 mt-1">Salary started on this date</p>
            </div>

            {/* Food Allowance */}
            <div className="bg-amber-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700 font-medium">Food Allowance</span>
              </div>
              <p className="text-base font-semibold text-amber-900">
                {data.foodAllowance ? formatCurrency(data.foodAllowance) : 'Not Applicable'}
              </p>
              {data.foodAllowance && (
                <p className="text-xs text-amber-600 mt-1">Per month</p>
              )}
            </div>
          </div>

          {/* Employment Details */}
          <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 font-medium mb-1">Salary Type</p>
              <p className="text-gray-900">{getSalaryTypeLabel(data.salaryType)}</p>
            </div>
            <div>
              <p className="text-gray-600 font-medium mb-1">Employment Type</p>
              <p className="text-gray-900">{getEmploymentTypeLabel(data.employmentType)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Salary Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Salary Type</span>
              <span className="font-medium text-gray-900">{getSalaryTypeLabel(data.salaryType)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Employment Type</span>
              <span className="font-medium text-gray-900">{getEmploymentTypeLabel(data.employmentType)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Status</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(data.status)}`}>
                {data.status.toUpperCase()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Salary Form Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Salary Configuration</DialogTitle>
          </DialogHeader>
          <DriverSalarySetupPanel
            driverId={driverId}
            driverName={driverName}
            onSalarySetupComplete={handleSalarySetupComplete}
            onCancel={() => setShowEditForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SalaryDetailsSection;
