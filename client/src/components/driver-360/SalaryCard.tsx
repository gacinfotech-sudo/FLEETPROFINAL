import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import SalaryDetailsModal from './SalaryDetailsModal';

interface SalaryCardProps {
  driverId: string;
  driverName: string;
}

interface PayrollSummary {
  currentMonth: {
    base: number;
    incentives: number;
    deductions: number;
    net: number;
    paid: number;
    pending: number;
    paidPercentage: number;
  };
  lastPayment: {
    date: string | null;
    amount: number;
    status: 'paid' | 'pending' | 'none';
  };
  nextPayment: {
    date: string;
    estimatedAmount: number;
    daysUntil: number;
  };
  ytdEarnings: {
    total: number;
    previousYearTotal: number;
    changePercentage: number;
    trend: 'increasing' | 'decreasing' | 'flat';
  };
  status: {
    color: 'green' | 'yellow' | 'red';
    label: 'on_track' | 'pending' | 'overdue';
    message: string;
  };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};

const getStatusColor = (color: string) => {
  switch (color) {
    case 'green':
      return 'bg-green-50 border-green-200';
    case 'yellow':
      return 'bg-yellow-50 border-yellow-200';
    case 'red':
      return 'bg-red-50 border-red-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
};

const getStatusBadgeVariant = (color: string) => {
  switch (color) {
    case 'green':
      return 'default';
    case 'yellow':
      return 'secondary';
    case 'red':
      return 'destructive';
    default:
      return 'outline';
  }
};

export default function SalaryCard({ driverId, driverName }: SalaryCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: [`/api/drivers/${driverId}/payroll-summary`],
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  const payroll: PayrollSummary | undefined = data?.data;

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">💰 Salary Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !payroll) {
    return (
      <Card className="w-full border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Salary Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">
            Unable to load salary data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`w-full border ${getStatusColor(payroll.status.color)}`}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">💰 Salary Information</CardTitle>
            <Badge variant={getStatusBadgeVariant(payroll.status.color)}>
              {payroll.status.label === 'on_track' && '✓ On Track'}
              {payroll.status.label === 'pending' && '⏳ Pending'}
              {payroll.status.label === 'overdue' && '⚠️ Overdue'}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 mt-1">{payroll.status.message}</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Current Month Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-600 font-medium">Base Salary</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(payroll.currentMonth.base)}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-600 font-medium">Incentives</p>
              <p className="text-lg font-semibold text-green-600">
                +{formatCurrency(payroll.currentMonth.incentives)}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-600 font-medium">Deductions</p>
              <p className="text-lg font-semibold text-red-600">
                -{formatCurrency(payroll.currentMonth.deductions)}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-600 font-medium">Net Payable</p>
              <p className="text-lg font-bold text-blue-600">
                {formatCurrency(payroll.currentMonth.net)}
              </p>
            </div>
          </div>

          {/* Payment Status */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-gray-600 font-medium flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Paid This Month
                </p>
                <p className="text-base font-semibold text-gray-900">
                  {formatCurrency(payroll.currentMonth.paid)}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-green-500 h-1.5 rounded-full"
                    style={{
                      width: `${Math.min(100, payroll.currentMonth.paidPercentage)}%`
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {payroll.currentMonth.paidPercentage.toFixed(0)}% paid
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-gray-600 font-medium">Pending</p>
                <p className={`text-base font-semibold ${
                  payroll.currentMonth.pending > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatCurrency(payroll.currentMonth.pending)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-gray-600 font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Next Payment
                </p>
                <p className="text-base font-semibold text-gray-900">
                  {payroll.nextPayment.daysUntil === 0
                    ? 'Today'
                    : payroll.nextPayment.daysUntil === 1
                    ? 'Tomorrow'
                    : `${payroll.nextPayment.daysUntil} days`
                  }
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(payroll.nextPayment.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Last Payment */}
          {payroll.lastPayment.date && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-gray-600 font-medium mb-1">Last Payment</p>
              <p className="text-sm text-gray-900">
                {formatCurrency(payroll.lastPayment.amount)} on{' '}
                {new Date(payroll.lastPayment.date).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* YTD Earnings */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3" />
                  Year-to-Date Earnings
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(payroll.ytdEarnings.total)}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-600">
                    Previous Year: {formatCurrency(payroll.ytdEarnings.previousYearTotal)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      payroll.ytdEarnings.trend === 'increasing' ? 'bg-green-100 text-green-700' :
                      payroll.ytdEarnings.trend === 'decreasing' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {payroll.ytdEarnings.changePercentage > 0 ? '+' : ''}
                      {payroll.ytdEarnings.changePercentage.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-600">
                      vs last year
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* View Details Button */}
          <Button
            onClick={() => setShowDetails(true)}
            variant="outline"
            className="w-full"
          >
            View Detailed Breakdown
          </Button>
        </CardContent>
      </Card>

      {/* Details Modal */}
      <SalaryDetailsModal
        driverId={driverId}
        driverName={driverName}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
}
