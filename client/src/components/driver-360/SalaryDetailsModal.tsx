import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle } from 'lucide-react';

interface SalaryDetailsModalProps {
  driverId: string;
  driverName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PayrollDetails {
  currentMonth: {
    base: number;
    incentives: number;
    deductions: number;
    net: number;
    paid: number;
    pending: number;
    paidPercentage: number;
  };
  details: {
    baseSalary: number;
    allowances: {
      nightDuty: number;
      outstation: number;
      food: number;
      other: number;
    };
    advancesDeduction: number;
    penaltyDeduction: number;
    attendanceBonus: number;
    incentives: number;
  };
  paymentHistory: {
    date: string;
    amount: number;
    mode: string;
    reference: string;
  }[];
  lastPayment: {
    date: string | null;
    amount: number;
    status: string;
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
  };
  status: {
    color: 'green' | 'yellow' | 'red';
    label: string;
    message: string;
  };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};

const formatDate = (date: string | Date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export default function SalaryDetailsModal({
  driverId,
  driverName,
  open,
  onOpenChange
}: SalaryDetailsModalProps) {
  const [selectedMonth, setSelectedMonth] = useState('current');

  const { data, isLoading, error } = useQuery<any>({
    queryKey: [`/api/drivers/${driverId}/payroll-details`, selectedMonth],
    enabled: open,
    staleTime: 5 * 60 * 1000
  });

  const payroll: PayrollDetails | undefined = data?.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Salary Details - {driverName}</DialogTitle>
          <DialogDescription>
            Comprehensive salary breakdown, payment history, and earnings comparison
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>
        ) : error || !payroll ? (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-600">Failed to load salary details</p>
          </div>
        ) : (
          <Tabs defaultValue="breakdown" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="comparison">Comparison</TabsTrigger>
            </TabsList>

            {/* BREAKDOWN TAB */}
            <TabsContent value="breakdown" className="space-y-6">
              {/* Current Month Status */}
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">Current Month Status</CardTitle>
                      <p className="text-xs text-gray-600 mt-1">
                        {formatDate(new Date())}
                      </p>
                    </div>
                    <Badge variant={payroll.status.color === 'green' ? 'default' : 'secondary'}>
                      {payroll.status.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-gray-700 font-medium">Gross Salary</span>
                      <span className="font-bold text-lg text-gray-900">
                        {formatCurrency(
                          payroll.currentMonth.base + payroll.currentMonth.incentives
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-gray-700">Total Deductions</span>
                      <span className="font-semibold text-red-600">
                        -{formatCurrency(payroll.currentMonth.deductions)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 bg-white rounded px-2">
                      <span className="text-gray-900 font-bold text-lg">Net Payable</span>
                      <span className="font-bold text-xl text-green-600">
                        {formatCurrency(payroll.currentMonth.net)}
                      </span>
                    </div>
                  </div>

                  {payroll.currentMonth.pending > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm font-medium text-yellow-900">
                        Pending Payment: {formatCurrency(payroll.currentMonth.pending)}
                      </p>
                      <p className="text-xs text-yellow-800 mt-1">
                        Due: {formatDate(payroll.nextPayment.date)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Earnings Components */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Earnings</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">Base Salary</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(payroll.details.baseSalary)}
                    </span>
                  </div>

                  {payroll.details.allowances.nightDuty > 0 && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Night Duty Allowance</span>
                      <span className="font-semibold text-green-600">
                        +{formatCurrency(payroll.details.allowances.nightDuty)}
                      </span>
                    </div>
                  )}

                  {payroll.details.allowances.outstation > 0 && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Outstation Allowance</span>
                      <span className="font-semibold text-green-600">
                        +{formatCurrency(payroll.details.allowances.outstation)}
                      </span>
                    </div>
                  )}

                  {payroll.details.allowances.food > 0 && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Food Allowance</span>
                      <span className="font-semibold text-green-600">
                        +{formatCurrency(payroll.details.allowances.food)}
                      </span>
                    </div>
                  )}

                  {payroll.details.allowances.other > 0 && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Other Allowances</span>
                      <span className="font-semibold text-green-600">
                        +{formatCurrency(payroll.details.allowances.other)}
                      </span>
                    </div>
                  )}

                  {payroll.details.attendanceBonus > 0 && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Attendance Bonus</span>
                      <span className="font-semibold text-green-600">
                        +{formatCurrency(payroll.details.attendanceBonus)}
                      </span>
                    </div>
                  )}

                  {payroll.details.incentives > 0 && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">KM Incentive</span>
                      <span className="font-semibold text-green-600">
                        +{formatCurrency(payroll.details.incentives)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Deductions */}
              {(payroll.details.advancesDeduction > 0 || payroll.details.penaltyDeduction > 0) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Deductions</h3>
                  <div className="space-y-2">
                    {payroll.details.advancesDeduction > 0 && (
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                        <span className="text-gray-700">Salary Advances</span>
                        <span className="font-semibold text-red-600">
                          -{formatCurrency(payroll.details.advancesDeduction)}
                        </span>
                      </div>
                    )}

                    {payroll.details.penaltyDeduction > 0 && (
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                        <span className="text-gray-700">Penalties/Recoveries</span>
                        <span className="font-semibold text-red-600">
                          -{formatCurrency(payroll.details.penaltyDeduction)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* HISTORY TAB */}
            <TabsContent value="history" className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Payments</h3>

                {payroll.paymentHistory && payroll.paymentHistory.length > 0 ? (
                  <div className="space-y-2">
                    {payroll.paymentHistory.map((payment, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-xs text-gray-600">
                            {formatDate(payment.date)} • {payment.mode}
                            {payment.reference && ` • Ref: ${payment.reference}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          ✓ Paid
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 italic">No payments this month</p>
                )}
              </div>

              {payroll.nextPayment && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Next Payment</h3>
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Estimated Amount</span>
                          <span className="font-bold text-lg text-gray-900">
                            {formatCurrency(payroll.nextPayment.estimatedAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Expected Date</span>
                          <span className="font-semibold text-gray-900">
                            {formatDate(payroll.nextPayment.date)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Days Until</span>
                          <span className="font-semibold text-blue-600">
                            {payroll.nextPayment.daysUntil} days
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* COMPARISON TAB */}
            <TabsContent value="comparison" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Year-to-Date Comparison</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">This Year (YTD)</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(payroll.ytdEarnings.total)}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Last Year (YTD)</p>
                    <p className="text-2xl font-bold text-gray-600">
                      {formatCurrency(payroll.ytdEarnings.previousYearTotal)}
                    </p>
                  </div>

                  <Separator />

                  <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Change vs Last Year</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-3xl font-bold ${
                        payroll.ytdEarnings.changePercentage > 0
                          ? 'text-green-600'
                          : payroll.ytdEarnings.changePercentage < 0
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}>
                        {payroll.ytdEarnings.changePercentage > 0 ? '+' : ''}
                        {payroll.ytdEarnings.changePercentage.toFixed(1)}%
                      </span>
                      <span className="text-sm text-gray-600">
                        {payroll.ytdEarnings.changePercentage > 0
                          ? 'increase from last year'
                          : payroll.ytdEarnings.changePercentage < 0
                          ? 'decrease from last year'
                          : 'same as last year'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
