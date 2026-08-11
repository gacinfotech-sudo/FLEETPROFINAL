import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const fmtMoney = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function DriverSalaryPayroll() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
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

  // Calculate action
  const calculateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ month, year })
      });
      if (!res.ok) throw new Error('Failed to calculate payroll');
      return res.json();
    },
    onSuccess: () => {
      toast({ description: 'Payroll calculated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/payroll', month, year] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message });
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
      toast({ description: 'Payroll approved' });
      queryClient.invalidateQueries({ queryKey: ['/api/payroll', month, year] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message });
    }
  });

  // Payment action
  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
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
      if (!res.ok) throw new Error('Failed to record payment');
      return res.json();
    },
    onSuccess: () => {
      toast({ description: 'Payment recorded' });
      setShowPaymentDialog(false);
      setPaymentData({ driverId: '', paidAmount: 0, paymentMode: 'cash' });
      queryClient.invalidateQueries({ queryKey: ['/api/payroll', month, year] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message });
    }
  });

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
                      {new Date(2026, m - 1).toLocaleString('default', { month: 'long' })}
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
        <Card className="mb-8 p-6 flex gap-4">
          {!currentPayroll || currentPayroll.status === 'draft' ? (
            <Button onClick={() => calculateMutation.mutate()} disabled={calculateMutation.isPending}>
              Calculate Payroll
            </Button>
          ) : currentPayroll.status === 'calculated' ? (
            <Button onClick={() => approveMutation.mutate(currentPayroll._id)} disabled={approveMutation.isPending}>
              Approve Payroll
            </Button>
          ) : currentPayroll.status === 'approved' || currentPayroll.status === 'partially_paid' ? (
            <>
              <Button onClick={() => setShowPaymentDialog(true)}>
                Record Payment
              </Button>
              <Button variant="outline">Mark as Closed</Button>
            </>
          ) : null}
        </Card>

        {/* Payroll Table */}
        {currentPayroll && (
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4">Payroll Summary</h2>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPayroll.driverPayrolls.map((dp: any) => (
                    <TableRow key={dp.driverId}>
                      <TableCell className="font-medium">{dp.driverName}</TableCell>
                      <TableCell className="text-right">{fmtMoney(dp.baseSalary)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(dp.grossSalary)}</TableCell>
                      <TableCell className="text-right text-orange-600">{fmtMoney(dp.totalDeductions)}</TableCell>
                      <TableCell className="text-right font-bold">{fmtMoney(dp.netSalary)}</TableCell>
                      <TableCell className="text-right text-green-600">{fmtMoney(dp.totalPaid)}</TableCell>
                      <TableCell className="text-right text-red-600">{fmtMoney(dp.remainingAmount)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(dp.paymentStatus)}>
                          {dp.paymentStatus.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

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
                  {currentPayroll?.driverPayrolls.map((dp: any) => (
                    <option key={dp.driverId} value={dp.driverId}>
                      {dp.driverName} (Pending: {fmtMoney(dp.remainingAmount)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={paymentData.paidAmount}
                  onChange={(e) => setPaymentData({ ...paymentData, paidAmount: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Mode</label>
                <select
                  className="w-full p-2 border rounded"
                  value={paymentData.paymentMode}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMode: e.target.value })}
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => paymentMutation.mutate(paymentData)} disabled={paymentMutation.isPending}>
                Record Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
