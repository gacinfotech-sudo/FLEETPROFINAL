import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const fmtMoney = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function DriverSalaryPayroll() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDriverDetails, setShowDriverDetails] = useState(false);
  const [selectedDriverPayroll, setSelectedDriverPayroll] = useState<any>(null);
  const [paymentData, setPaymentData] = useState({ driverId: '', paidAmount: 0, paymentMode: 'cash' });

  // Fetch payroll
  const { data: payrolls = [], isLoading } = useQuery({
    queryKey: ['/api/payroll', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/payroll?month=${month}&year=${year}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch payroll');
      return res.json();
    }
  });

  const currentPayroll = payrolls.find((p: any) => p.month === month && p.year === year);

  // Fetch driver details
  const { data: driverDetails } = useQuery({
    queryKey: [`/api/drivers/${selectedDriverPayroll?.driverId}/complete-profile`],
    queryFn: async () => {
      if (!selectedDriverPayroll?.driverId) return null;
      const res = await fetch(`/api/drivers/${selectedDriverPayroll.driverId}/complete-profile`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch driver details');
      return res.json();
    },
    enabled: !!selectedDriverPayroll?.driverId && showDriverDetails
  });

  // Calculate action
  const calculateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ month, year })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to calculate payroll');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ description: 'Payroll calculated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/payroll', month, year] });
    },
    onError: (error: any) => {
      const errorMsg = error?.message || 'Failed to calculate payroll';
      console.error('Payroll calculation error:', error);
      toast({ variant: 'destructive', description: errorMsg });
    }
  });

  // Approve action
  const approveMutation = useMutation({
    mutationFn: async (payrollId: string) => {
      const res = await fetch(`/api/payroll/${payrollId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approvedBy: { userId: 'current-user', role: 'admin' } })
      });
      if (!res.ok) throw new Error('Failed to approve payroll');
      return res.json();
    },
    onSuccess: () => {
      toast({ description: '✅ Payroll approved successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/payroll', month, year] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message });
    }
  });

  // Close action
  const closeMutation = useMutation({
    mutationFn: async (payrollId: string) => {
      const res = await fetch(`/api/payroll/${payrollId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to close payroll');
      return res.json();
    },
    onSuccess: () => {
      toast({ description: '✅ Payroll closed successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/payroll', month, year] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error?.message || 'Failed to close payroll' });
    }
  });

  // Payment action
  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!currentPayroll) throw new Error('No payroll found');
      if (!currentPayroll._id) throw new Error('Payroll ID missing');
      if (!data.driverId) throw new Error('Please select a driver');
      if (!data.paidAmount || data.paidAmount <= 0) throw new Error('Please enter a valid amount');

      const res = await fetch(`/api/payroll/${currentPayroll._id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          driverId: data.driverId,
          paidAmount: data.paidAmount,
          paymentMode: data.paymentMode,
          paidBy: { userId: 'current-user', role: 'admin' }
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to record payment');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ description: '✅ Payment recorded successfully' });
      setShowPaymentDialog(false);
      setPaymentData({ driverId: '', paidAmount: 0, paymentMode: 'cash' });
      queryClient.invalidateQueries({ queryKey: ['/api/payroll', month, year] });
    },
    onError: (error: any) => {
      const errorMsg = error?.message || 'Failed to record payment';
      console.error('Payment error:', error);
      toast({ variant: 'destructive', description: errorMsg });
    }
  });

  // Salary slip download
  const downloadSalarySlip = async (salaryId: string, driverName: string) => {
    try {
      const res = await fetch(`/api/driver-salary/${salaryId}/slip`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to generate salary slip');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `salary-slip-${driverName}-${month}-${year}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ description: '✅ Salary slip downloaded' });
    } catch (error) {
      console.error('Error downloading salary slip:', error);
      toast({ variant: 'destructive', description: 'Failed to download salary slip' });
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'default';
      case 'partially_paid': return 'secondary';
      case 'not_paid': return 'outline';
      default: return 'default';
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-8">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-4xl font-bold mb-2">💰 Driver Salary Payroll</h1>
          <p className="text-indigo-100">Manage monthly payroll, payments, and settlements</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Month/Year Selector */}
        <Card className="mb-6 p-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Month</label>
              <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {new Date(new Date().getFullYear(), m - 1).toLocaleString('default', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Year</label>
              <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* KPI Cards */}
        {currentPayroll && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card className="p-4 border-l-4 border-blue-500">
              <p className="text-xs text-gray-500 font-semibold">DRIVERS</p>
              <p className="text-2xl font-bold">{currentPayroll.driverCount}</p>
            </Card>
            <Card className="p-4 border-l-4 border-green-500">
              <p className="text-xs text-gray-500 font-semibold">GROSS SALARY</p>
              <p className="text-2xl font-bold text-green-600">{fmtMoney(currentPayroll.totalGrossSalary)}</p>
            </Card>
            <Card className="p-4 border-l-4 border-orange-500">
              <p className="text-xs text-gray-500 font-semibold">DEDUCTIONS</p>
              <p className="text-2xl font-bold text-orange-600">{fmtMoney(currentPayroll.totalDeductions)}</p>
            </Card>
            <Card className="p-4 border-l-4 border-purple-500">
              <p className="text-xs text-gray-500 font-semibold">NET PAYABLE</p>
              <p className="text-2xl font-bold text-purple-600">{fmtMoney(currentPayroll.totalNetSalary)}</p>
            </Card>
            <Card className="p-4 border-l-4 border-red-500">
              <p className="text-xs text-gray-500 font-semibold">PENDING</p>
              <p className="text-2xl font-bold text-red-600">{fmtMoney(currentPayroll.totalPending)}</p>
            </Card>
          </div>
        )}

        {/* Action Buttons */}
        <Card className="mb-8 p-6 flex gap-4 flex-wrap">
          {!currentPayroll || currentPayroll.status === 'draft' ? (
            <Button
              onClick={() => calculateMutation.mutate()}
              disabled={calculateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {calculateMutation.isPending ? '⏳ Calculating...' : '📊 Calculate Payroll'}
            </Button>
          ) : currentPayroll.status === 'calculated' ? (
            <Button
              onClick={() => approveMutation.mutate(currentPayroll._id)}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? '⏳ Approving...' : '✅ Approve Payroll'}
            </Button>
          ) : currentPayroll.status === 'approved' || currentPayroll.status === 'partially_paid' ? (
            <>
              <Button
                onClick={() => setShowPaymentDialog(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                💳 Record Payment
              </Button>
              <Button
                variant="outline"
                onClick={() => closeMutation.mutate(currentPayroll._id)}
                disabled={closeMutation.isPending}
              >
                {closeMutation.isPending ? '⏳ Closing...' : '🔒 Mark as Closed'}
              </Button>
            </>
          ) : null}
        </Card>

        {/* Payroll Table */}
        {currentPayroll && currentPayroll.driverPayrolls && currentPayroll.driverPayrolls.length > 0 ? (
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4">Payroll Summary ({currentPayroll.driverPayrolls.length} drivers)</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPayroll.driverPayrolls.map((dp: any) => (
                    <TableRow
                      key={dp.driverId?.toString ? dp.driverId.toString() : dp.driverId}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedDriverPayroll(dp);
                        setShowDriverDetails(true);
                      }}
                    >
                      <TableCell className="font-medium">{dp.driverName || 'Unknown Driver'}</TableCell>
                      <TableCell className="text-right">{fmtMoney(dp.baseSalary || 0)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(dp.grossSalary || 0)}</TableCell>
                      <TableCell className="text-right text-orange-600">{fmtMoney(dp.totalDeductions || 0)}</TableCell>
                      <TableCell className="text-right font-bold">{fmtMoney(dp.netSalary || 0)}</TableCell>
                      <TableCell className="text-right text-green-600">{fmtMoney(dp.totalPaid || 0)}</TableCell>
                      <TableCell className="text-right text-red-600">{fmtMoney(dp.remainingAmount || 0)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(dp.paymentStatus || 'not_paid')}>
                          {(dp.paymentStatus || 'not_paid').replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (dp.salaryId) {
                              downloadSalarySlip(dp.salaryId, dp.driverName);
                            } else {
                              toast({ variant: 'destructive', description: 'Salary ID not found' });
                            }
                          }}
                        >
                          📄
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : currentPayroll ? (
          <Card className="p-6">
            <div className="text-center py-8 text-gray-500">
              <p>No driver payroll data available. Please calculate payroll first.</p>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="text-center py-8 text-gray-500">
              <p>No payroll found for {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year}</p>
            </div>
          </Card>
        )}

        {/* Driver Details Dialog */}
        <Dialog open={showDriverDetails} onOpenChange={setShowDriverDetails}>
          <DialogContent className="max-w-3xl max-h-96 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedDriverPayroll?.driverName} - Payroll Details
              </DialogTitle>
            </DialogHeader>

            {selectedDriverPayroll && (
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                {/* Summary Tab */}
                <TabsContent value="summary" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded">
                      <p className="text-xs text-gray-500">Base Salary</p>
                      <p className="text-2xl font-bold text-blue-600">{fmtMoney(selectedDriverPayroll.baseSalary)}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded">
                      <p className="text-xs text-gray-500">Gross Salary</p>
                      <p className="text-2xl font-bold text-green-600">{fmtMoney(selectedDriverPayroll.grossSalary)}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded">
                      <p className="text-xs text-gray-500">Deductions</p>
                      <p className="text-2xl font-bold text-orange-600">{fmtMoney(selectedDriverPayroll.totalDeductions)}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded">
                      <p className="text-xs text-gray-500">Net Payable</p>
                      <p className="text-2xl font-bold text-purple-600">{fmtMoney(selectedDriverPayroll.netSalary)}</p>
                    </div>
                    <div className="bg-green-100 p-4 rounded">
                      <p className="text-xs text-gray-500">Paid</p>
                      <p className="text-2xl font-bold text-green-700">{fmtMoney(selectedDriverPayroll.totalPaid)}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded">
                      <p className="text-xs text-gray-500">Pending</p>
                      <p className="text-2xl font-bold text-red-600">{fmtMoney(selectedDriverPayroll.remainingAmount)}</p>
                    </div>
                  </div>
                </TabsContent>

                {/* Breakdown Tab */}
                <TabsContent value="breakdown" className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>Base Salary</span>
                      <span className="font-bold">{fmtMoney(selectedDriverPayroll.baseSalary)}</span>
                    </div>
                    {selectedDriverPayroll.allowances > 0 && (
                      <div className="flex justify-between p-2 bg-green-50 rounded">
                        <span>Allowances</span>
                        <span className="font-bold text-green-600">+{fmtMoney(selectedDriverPayroll.allowances)}</span>
                      </div>
                    )}
                    {selectedDriverPayroll.incentives > 0 && (
                      <div className="flex justify-between p-2 bg-green-50 rounded">
                        <span>Incentives</span>
                        <span className="font-bold text-green-600">+{fmtMoney(selectedDriverPayroll.incentives)}</span>
                      </div>
                    )}
                    <div className="border-t-2 flex justify-between p-2 font-bold">
                      <span>Gross Salary</span>
                      <span>{fmtMoney(selectedDriverPayroll.grossSalary)}</span>
                    </div>
                    {selectedDriverPayroll.totalDeductions > 0 && (
                      <div className="flex justify-between p-2 bg-red-50 rounded">
                        <span>Deductions</span>
                        <span className="font-bold text-red-600">-{fmtMoney(selectedDriverPayroll.totalDeductions)}</span>
                      </div>
                    )}
                    <div className="border-t-2 flex justify-between p-2 font-bold text-lg bg-purple-50">
                      <span>Net Payable</span>
                      <span className="text-purple-600">{fmtMoney(selectedDriverPayroll.netSalary)}</span>
                    </div>
                  </div>
                </TabsContent>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-3">
                  {driverDetails?.data ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="font-medium">{driverDetails.data.driver.phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <Badge variant="default">{driverDetails.data.driver.status}</Badge>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Advances Outstanding</p>
                        <p className="text-lg font-bold text-orange-600">
                          {fmtMoney(driverDetails.data.advances.total)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Active Penalties</p>
                        <p className="text-lg font-bold text-red-600">
                          {fmtMoney(driverDetails.data.penalties.total)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">Loading profile...</div>
                  )}
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="space-y-2">
                  {driverDetails?.data?.payments?.recent?.length > 0 ? (
                    <div className="space-y-2">
                      {driverDetails.data.payments.recent.map((p: any) => (
                        <div key={p.id} className="border p-2 rounded text-sm">
                          <div className="flex justify-between">
                            <span>{new Date(p.date).toLocaleDateString()}</span>
                            <span className="font-bold">{fmtMoney(p.amount)}</span>
                          </div>
                          <div className="text-xs text-gray-500">{p.mode}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No payment history</div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Driver</label>
                <select
                  className="w-full p-2 border rounded"
                  value={paymentData.driverId}
                  onChange={(e) => setPaymentData({ ...paymentData, driverId: e.target.value })}
                >
                  <option value="">Select driver...</option>
                  {currentPayroll?.driverPayrolls && currentPayroll.driverPayrolls.length > 0 ? (
                    currentPayroll.driverPayrolls.map((dp: any) => (
                      <option key={dp.driverId?.toString ? dp.driverId.toString() : dp.driverId} value={dp.driverId?.toString ? dp.driverId.toString() : dp.driverId}>
                        {dp.driverName || 'Unknown Driver'} (Pending: {fmtMoney(dp.remainingAmount || 0)})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No drivers available</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                {currentPayroll && paymentData.driverId && (
                  (() => {
                    const selectedDriver = currentPayroll.driverPayrolls.find((dp: any) =>
                      (dp.driverId?.toString?.() || dp.driverId) === paymentData.driverId
                    );
                    const remaining = selectedDriver?.remainingAmount || 0;
                    return (
                      <p className="text-xs text-gray-600 mb-1">
                        Remaining: {fmtMoney(remaining)}
                      </p>
                    );
                  })()
                )}
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={paymentData.paidAmount}
                  onChange={(e) => setPaymentData({ ...paymentData, paidAmount: parseFloat(e.target.value) })}
                  min={0}
                  step={0.01}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Mode</label>
                <select
                  className="w-full p-2 border rounded"
                  value={paymentData.paymentMode}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMode: e.target.value })}
                >
                  <option value="cash">💵 Cash</option>
                  <option value="bank_transfer">🏦 Bank Transfer</option>
                  <option value="upi">📱 UPI</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => paymentMutation.mutate(paymentData)}
                disabled={paymentMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {paymentMutation.isPending ? '⏳ Recording...' : '✅ Record Payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
