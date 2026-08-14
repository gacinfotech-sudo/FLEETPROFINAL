import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Download, CheckSquare, SquareX } from 'lucide-react';

const fmtMoney = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function DriverSalaryPayrollEnhanced() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDriverDetails, setShowDriverDetails] = useState(false);
  const [selectedDriverPayroll, setSelectedDriverPayroll] = useState<any>(null);
  const [paymentData, setPaymentData] = useState({ driverId: '', paidAmount: 0, paymentMode: 'cash' });
  const [csrfToken, setCsrfToken] = useState('');

  // Bulk select state
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  useEffect(() => {
    fetch('/api/csrf-token', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setCsrfToken(data.csrfToken))
      .catch(err => console.error('CSRF token fetch failed:', err));
  }, []);

  const { data: payrolls = [], isLoading } = useQuery({
    queryKey: ['/api/payroll', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/payroll?month=${month}&year=${year}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch payroll');
      return res.json();
    }
  });

  const currentPayroll = payrolls.find((p: any) => p.month === month && p.year === year);

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (driverIds: string[]) => {
      const res = await fetch('/api/payroll/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ driverIds, payrollId: currentPayroll._id })
      });
      if (!res.ok) throw new Error('Failed to delete payroll entries');
      return res.json();
    },
    onSuccess: () => {
      toast({ description: `✅ Deleted ${selectedDrivers.size} driver payroll entries` });
      setSelectedDrivers(new Set());
      setShowBulkDeleteDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/payroll', month, year] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message || 'Failed to delete' });
    }
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ month, year })
      });
      if (!res.ok) throw new Error('Failed to calculate payroll');
      return res.json();
    },
    onSuccess: () => {
      toast({ description: '✅ Payroll calculated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/payroll', month, year] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', description: error.message });
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (payrollId: string) => {
      const res = await fetch(`/api/payroll/${payrollId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
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

  const closeMutation = useMutation({
    mutationFn: async (payrollId: string) => {
      const res = await fetch(`/api/payroll/${payrollId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
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
      toast({ variant: 'destructive', description: error.message });
    }
  });

  const downloadSalarySlip = async (salaryId: string, driverName: string) => {
    try {
      const res = await fetch(`/api/driver-salary/${salaryId}/slip`, { credentials: 'include' });
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
      toast({ variant: 'destructive', description: 'Failed to download salary slip' });
    }
  };

  const handleSelectAll = () => {
    if (selectedDrivers.size === currentPayroll?.driverPayrolls?.length) {
      setSelectedDrivers(new Set());
    } else {
      const allIds = new Set(currentPayroll?.driverPayrolls?.map((d: any) => d.driverId?.toString?.() || d.driverId) || []);
      setSelectedDrivers(allIds);
    }
  };

  const handleSelectDriver = (driverId: string) => {
    const newSelected = new Set(selectedDrivers);
    if (newSelected.has(driverId)) {
      newSelected.delete(driverId);
    } else {
      newSelected.add(driverId);
    }
    setSelectedDrivers(newSelected);
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
  const isAllSelected = selectedDrivers.size === currentPayroll?.driverPayrolls?.length && selectedDrivers.size > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h1 className="text-3xl sm:text-4xl font-bold mb-1">💰 Driver Salary Payroll</h1>
          <p className="text-indigo-100 text-sm sm:text-base">Manage monthly payroll, payments, and settlements</p>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Month/Year Selector */}
        <Card className="p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Month</label>
              <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {new Date(new Date().getFullYear(), m - 1).toLocaleString('default', { month: 'short' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
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

        {/* KPI Cards - Responsive Grid */}
        {currentPayroll && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <Card className="p-3 sm:p-4 border-l-4 border-blue-500">
              <p className="text-xs text-gray-500 font-semibold">DRIVERS</p>
              <p className="text-xl sm:text-2xl font-bold">{currentPayroll.driverCount}</p>
            </Card>
            <Card className="p-3 sm:p-4 border-l-4 border-green-500">
              <p className="text-xs text-gray-500 font-semibold">GROSS</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600">{fmtMoney(currentPayroll.totalGrossSalary)}</p>
            </Card>
            <Card className="p-3 sm:p-4 border-l-4 border-orange-500">
              <p className="text-xs text-gray-500 font-semibold">DEDUCTIONS</p>
              <p className="text-lg sm:text-2xl font-bold text-orange-600">{fmtMoney(currentPayroll.totalDeductions)}</p>
            </Card>
            <Card className="p-3 sm:p-4 border-l-4 border-purple-500">
              <p className="text-xs text-gray-500 font-semibold">NET PAYABLE</p>
              <p className="text-lg sm:text-2xl font-bold text-purple-600">{fmtMoney(currentPayroll.totalNetSalary)}</p>
            </Card>
            <Card className="p-3 sm:p-4 border-l-4 border-red-500">
              <p className="text-xs text-gray-500 font-semibold">PENDING</p>
              <p className="text-lg sm:text-2xl font-bold text-red-600">{fmtMoney(currentPayroll.totalPending)}</p>
            </Card>
          </div>
        )}

        {/* Action Buttons */}
        <Card className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {!currentPayroll || currentPayroll.status === 'draft' ? (
              <Button
                onClick={() => calculateMutation.mutate()}
                disabled={calculateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-sm sm:text-base"
              >
                {calculateMutation.isPending ? '⏳...' : '📊 Calculate'}
              </Button>
            ) : currentPayroll.status === 'calculated' ? (
              <Button
                onClick={() => approveMutation.mutate(currentPayroll._id)}
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-sm sm:text-base"
              >
                {approveMutation.isPending ? '⏳...' : '✅ Approve'}
              </Button>
            ) : currentPayroll.status === 'approved' || currentPayroll.status === 'partially_paid' ? (
              <Button
                onClick={() => setShowPaymentDialog(true)}
                className="bg-purple-600 hover:bg-purple-700 text-sm sm:text-base"
              >
                💳 Payment
              </Button>
            ) : null}
          </div>
        </Card>

        {/* Bulk Actions Toolbar */}
        {selectedDrivers.size > 0 && (
          <Card className="p-3 sm:p-4 bg-blue-50 border-blue-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm font-medium text-blue-900">
                {selectedDrivers.size} driver{selectedDrivers.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={bulkDeleteMutation.isPending}
                  className="text-xs sm:text-sm"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDrivers(new Set())}
                  className="text-xs sm:text-sm"
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Payroll Table - Responsive Container */}
        {currentPayroll && currentPayroll.driverPayrolls && currentPayroll.driverPayrolls.length > 0 ? (
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-bold mb-4">Payroll Summary ({currentPayroll.driverPayrolls.length} drivers)</h2>
            <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow className="border-b-2">
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="min-w-40">Driver</TableHead>
                    <TableHead className="text-right min-w-24">Base</TableHead>
                    <TableHead className="text-right min-w-24">Gross</TableHead>
                    <TableHead className="text-right min-w-24">Deductions</TableHead>
                    <TableHead className="text-right min-w-24">Net</TableHead>
                    <TableHead className="text-right min-w-24">Paid</TableHead>
                    <TableHead className="text-right min-w-24">Pending</TableHead>
                    <TableHead className="min-w-20">Status</TableHead>
                    <TableHead className="text-center min-w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPayroll.driverPayrolls.map((dp: any) => {
                    const driverId = dp.driverId?.toString?.() || dp.driverId;
                    const isSelected = selectedDrivers.has(driverId);
                    return (
                      <TableRow key={driverId} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleSelectDriver(driverId)}
                            className="cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{dp.driverName || 'Unknown'}</TableCell>
                        <TableCell className="text-right text-sm">{fmtMoney(dp.baseSalary || 0)}</TableCell>
                        <TableCell className="text-right text-sm">{fmtMoney(dp.grossSalary || 0)}</TableCell>
                        <TableCell className="text-right text-sm text-orange-600">{fmtMoney(dp.totalDeductions || 0)}</TableCell>
                        <TableCell className="text-right text-sm font-bold">{fmtMoney(dp.netSalary || 0)}</TableCell>
                        <TableCell className="text-right text-sm text-green-600">{fmtMoney(dp.totalPaid || 0)}</TableCell>
                        <TableCell className="text-right text-sm text-red-600">{fmtMoney(dp.remainingAmount || 0)}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(dp.paymentStatus || 'not_paid')} className="text-xs">
                            {(dp.paymentStatus || 'not_paid').replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadSalarySlip(dp.salaryId, dp.driverName)}
                            title="Download salary slip"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : currentPayroll ? (
          <Card className="p-6 text-center text-gray-500">
            No driver payroll data available
          </Card>
        ) : (
          <Card className="p-6 text-center text-gray-500">
            No payroll found for selected month
          </Card>
        )}
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Payroll Entries?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete payroll entries for {selectedDrivers.size} driver{selectedDrivers.size !== 1 ? 's' : ''}?
            </p>
            <p className="text-xs text-red-600 mt-2">⚠️ This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedDrivers))}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
