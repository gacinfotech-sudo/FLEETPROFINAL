/**
 * PHASE 8: DRIVER 360 INTEGRATION
 * Salary Summary Component
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Download, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SalarySummaryData {
  currentSalary: {
    id: string;
    period: string;
    baseMonthly: number;
    grossEarned: number;
    netPayable: number;
    totalPaid: number;
    remainingBalance: number;
    status: string;
  } | null;
  lastSalary: {
    id: string;
    period: string;
    netPayable: number;
    status: string;
  } | null;
  outstandingAdvances: {
    count: number;
    totalAmount: number;
    advances: Array<{
      id: string;
      amount: number;
      remaining: number;
      requestDate: string;
      type: string;
    }>;
  };
}

interface Props {
  driverId: string;
}

export function SalarySummary({ driverId }: Props) {
  const [data, setData] = useState<SalarySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSalarySummary();
  }, [driverId]);

  const fetchSalarySummary = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/driver-salary/driver/${driverId}/summary`
      );

      if (!response.ok) throw new Error('Failed to fetch salary summary');

      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const downloadSalarySlip = async (salaryId: string) => {
    try {
      const response = await fetch(`/api/driver-salary/${salaryId}/slip`);
      if (!response.ok) throw new Error('Failed to download slip');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salary-slip-${salaryId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading slip:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partially_paid':
        return 'bg-yellow-100 text-yellow-800';
      case 'calculated':
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6 flex gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
        </CardContent>
      </Card>
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

  return (
    <div className="space-y-4">
      {/* Current Month Salary */}
      {data.currentSalary && (
        <Card className="border-2 border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Current Month Salary</CardTitle>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(data.currentSalary.status)}`}>
                {data.currentSalary.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{data.currentSalary.period}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Base Salary</p>
                <p className="text-xl font-bold">
                  ₹{data.currentSalary.baseMonthly.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Gross Earned</p>
                <p className="text-xl font-bold">
                  ₹{data.currentSalary.grossEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="mb-3">
                <p className="text-sm text-gray-600">Net Payable</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{data.currentSalary.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Paid</p>
                  <p className="font-semibold">
                    ₹{data.currentSalary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Remaining</p>
                  <p className="font-semibold">
                    ₹{data.currentSalary.remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => downloadSalarySlip(data.currentSalary!.id)}
              className="w-full mt-2"
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Salary Slip
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Last Month Salary */}
      {data.lastSalary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Last Month Salary</CardTitle>
            <p className="text-xs text-gray-500 mt-1">{data.lastSalary.period}</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Net Payable</span>
              <span className="text-lg font-semibold">
                ₹{data.lastSalary.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outstanding Advances */}
      {data.outstandingAdvances.count > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-sm">Outstanding Advances</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-700">Total Outstanding</span>
              <span className="text-lg font-bold text-orange-600">
                ₹{data.outstandingAdvances.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.outstandingAdvances.advances.map((advance) => (
                <div key={advance.id} className="border-t pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">{advance.type}</span>
                    <span className="font-semibold">
                      ₹{advance.remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(advance.requestDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SalarySummary;
