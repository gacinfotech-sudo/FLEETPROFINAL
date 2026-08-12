/**
 * PHASE 8: Driver 360 - Salary History Component
 * Displays past 12 months salary records
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';

interface SalaryRecord {
  _id: string;
  salaryPeriodStart: string;
  salaryPeriodEnd: string;
  netPayable: number;
  totalPaid: number;
  remainingBalance: number;
  status: string;
  paidAt?: string;
}

export function SalaryHistory({ driverId }: { driverId: string }) {
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchSalaryHistory();
  }, [driverId]);

  const fetchSalaryHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/drivers/${driverId}/salary-history`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch salary history');
      }

      const data = await response.json();
      setSalaries(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSalaries([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partially_paid':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMonthLabel = (startDate: string) => {
    const date = new Date(startDate);
    return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Salary History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Salary History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (salaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Salary History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No salary records found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salary History (Last 12 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {salaries.map((salary) => (
            <div key={salary._id} className="border rounded-lg">
              <button
                onClick={() => setExpandedId(expandedId === salary._id ? null : salary._id)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{getMonthLabel(salary.salaryPeriodStart)}</span>
                    <Badge className={getStatusColor(salary.status)}>
                      {salary.status?.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">₹{salary.netPayable?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                </div>
                <ChevronDown
                  size={20}
                  className={`transition-transform ${expandedId === salary._id ? 'rotate-180' : ''}`}
                />
              </button>

              {expandedId === salary._id && (
                <div className="border-t bg-gray-50 p-4 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-600">Period</p>
                      <p className="font-semibold">
                        {new Date(salary.salaryPeriodStart).toLocaleDateString()} - {new Date(salary.salaryPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Net Payable</p>
                      <p className="font-semibold text-green-600">₹{salary.netPayable?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Paid Amount</p>
                      <p className="font-semibold text-blue-600">₹{salary.totalPaid?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Remaining</p>
                      <p className={`font-semibold ${salary.remainingBalance > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                        ₹{salary.remainingBalance?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  {salary.paidAt && (
                    <div className="text-xs text-gray-500 pt-2 border-t">
                      Paid on: {new Date(salary.paidAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
