import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { apiRequest } from '@/lib/api';

const fmtMoney = (n: number) => `₹${n.toLocaleString('en-IN')}`;

interface Penalty {
  _id: string;
  driverId: string;
  driverName: string;
  penaltyType: 'damage' | 'challan' | 'cash_shortage' | 'fuel_excess' | 'attendance' | 'behavior' | 'other';
  amount: number;
  reason: string;
  date: string;
  status: 'pending' | 'approved' | 'deducted' | 'reversed';
  deductionMode: 'full_next_salary' | 'emi' | 'manual';
  installments?: number;
  appliedTo?: number;
  ledgerEntryId?: string;
  approvedBy?: { userId: string; role: string; timestamp: string };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Recovery {
  _id: string;
  driverId: string;
  driverName: string;
  recoveryType: 'advance' | 'loan' | 'penalty' | 'damage' | 'shortage' | 'fuel_excess' | 'other';
  amount: number;
  originalAmount?: number;
  description: string;
  startDate: string;
  expectedCompletionDate?: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  recoveryMode: 'single' | 'emi' | 'manual';
  installments?: number;
  emiAmount?: number;
  recoveredAmount: number;
  remainingAmount: number;
  ledgerEntries?: string[];
  createdAt: string;
  updatedAt: string;
}

interface LedgerEntry {
  _id: string;
  driverId: string;
  driverName: string;
  transactionType: string;
  amount: number;
  reason: string;
  referenceType: string;
  referenceId?: string;
  month: number;
  year: number;
  closingBalance: number;
  createdAt: string;
}

export default function PenaltyRecoveryManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddPenalty, setShowAddPenalty] = useState(false);
  const [showAddRecovery, setShowAddRecovery] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // Form states
  const [penaltyForm, setPenaltyForm] = useState({
    driverId: '',
    penaltyType: 'damage' as const,
    amount: 0,
    reason: '',
    deductionMode: 'full_next_salary' as const,
    installments: 1,
    notes: '',
  });

  const [recoveryForm, setRecoveryForm] = useState({
    driverId: '',
    recoveryType: 'advance' as const,
    amount: 0,
    description: '',
    recoveryMode: 'emi' as const,
    installments: 3,
  });

  // Fetch drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ['/api/drivers'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/drivers');
      return res.json();
    },
  });

  // Fetch penalties
  const { data: penalties = [], isLoading: penaltiesLoading } = useQuery({
    queryKey: ['/api/penalties', month, year],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/penalties?month=${month}&year=${year}`);
      return res.json();
    },
  });

  // Fetch recoveries
  const { data: recoveries = [], isLoading: recoveriesLoading } = useQuery({
    queryKey: ['/api/recoveries', selectedDriver],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/recoveries${selectedDriver ? `?driverId=${selectedDriver}` : ''}`);
      return res.json();
    },
  });

  // Fetch ledger entries
  const { data: ledgerEntries = [] } = useQuery({
    queryKey: ['/api/ledger', selectedDriver, month, year],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/ledger?driverId=${selectedDriver}&month=${month}&year=${year}`);
      return res.json();
    },
    enabled: !!selectedDriver,
  });

  // Add penalty mutation
  const addPenaltyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/penalties', {
        ...penaltyForm,
        amount: penaltyForm.amount * 100, // Convert to paise
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ description: 'Penalty added successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/penalties'] });
      setShowAddPenalty(false);
      setPenaltyForm({
        driverId: '',
        penaltyType: 'damage',
        amount: 0,
        reason: '',
        deductionMode: 'full_next_salary',
        installments: 1,
        notes: '',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error?.message || 'Failed to add penalty',
      });
    },
  });

  // Add recovery mutation
  const addRecoveryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/recoveries', {
        ...recoveryForm,
        amount: recoveryForm.amount * 100, // Convert to paise
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ description: 'Recovery initiated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/recoveries'] });
      setShowAddRecovery(false);
      setRecoveryForm({
        driverId: '',
        recoveryType: 'advance',
        amount: 0,
        description: '',
        recoveryMode: 'emi',
        installments: 3,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error?.message || 'Failed to initiate recovery',
      });
    },
  });

  // Approve penalty mutation
  const approvePenaltyMutation = useMutation({
    mutationFn: async (penaltyId: string) => {
      const res = await apiRequest('POST', `/api/penalties/${penaltyId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      toast({ description: 'Penalty approved' });
      queryClient.invalidateQueries({ queryKey: ['/api/penalties'] });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        description: error?.message || 'Failed to approve penalty',
      });
    },
  });

  // Calculate statistics
  const totalPenalties = penalties.reduce((sum: number, p: Penalty) => sum + p.amount, 0);
  const totalRecoveries = recoveries.reduce((sum: number, r: Recovery) => sum + r.amount, 0);
  const totalRecovered = recoveries.reduce((sum: number, r: Recovery) => sum + r.recoveredAmount, 0);
  const pendingPenalties = penalties.filter((p: Penalty) => p.status === 'pending').length;
  const activePenalties = penalties.filter((p: Penalty) => p.status === 'approved').length;

  // Chart data
  const penaltyTrend = penalties
    .slice(-12)
    .map((p: Penalty) => ({
      date: new Date(p.createdAt).toLocaleDateString('en-IN'),
      amount: p.amount / 100,
    }))
    .reduce((acc: any[], curr: any) => {
      const existing = acc.find((x) => x.date === curr.date);
      if (existing) {
        existing.amount += curr.amount;
      } else {
        acc.push(curr);
      }
      return acc;
    }, []);

  const penaltyByType = [
    ...new Set(penalties.map((p: Penalty) => p.penaltyType)),
  ].map((type) => ({
    name: type.replace(/_/g, ' ').toUpperCase(),
    value: penalties
      .filter((p: Penalty) => p.penaltyType === type)
      .reduce((sum: number, p: Penalty) => sum + p.amount, 0) / 100,
  }));

  const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4'];

  const recoveryProgress = recoveries
    .filter((r: Recovery) => r.status === 'active')
    .map((r: Recovery) => ({
      name: r.driverName,
      recovered: r.recoveredAmount / 100,
      remaining: r.remainingAmount / 100,
    }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent dark:from-red-400 dark:to-orange-400">
            🚨 Penalty & Recovery Management
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Track penalties, manage recoveries, and monitor ledger entries
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 border-red-200 dark:border-red-700">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Penalties</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">{fmtMoney(totalPenalties / 100)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{penalties.length} records</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20 border-orange-200 dark:border-orange-700">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Pending Approval</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-2">{pendingPenalties}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Active Recoveries</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{recoveries.filter((r: Recovery) => r.status === 'active').length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">In progress</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 border-green-200 dark:border-green-700">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Recovery Amount</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">{fmtMoney(totalRecoveries / 100)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Outstanding</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Amount Recovered</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">{fmtMoney(totalRecovered / 100)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Collected so far</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">📊 Overview</TabsTrigger>
            <TabsTrigger value="penalties">⚠️ Penalties</TabsTrigger>
            <TabsTrigger value="recoveries">💰 Recoveries</TabsTrigger>
            <TabsTrigger value="ledger">📋 Ledger</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Penalty Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📈 Penalty Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {penaltyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={penaltyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => fmtMoney(value as number)} />
                        <Legend />
                        <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2} name="Penalty Amount" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-8 text-gray-500">No penalty data available</p>
                  )}
                </CardContent>
              </Card>

              {/* Penalty by Type */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🎯 Penalties by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  {penaltyByType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={penaltyByType} cx="50%" cy="50%" labelLine={false} label={(entry) => entry.name} outerRadius={80} fill="#ef4444" dataKey="value">
                          {penaltyByType.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => fmtMoney(value as number)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-8 text-gray-500">No penalty type data</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recovery Progress */}
            {recoveryProgress.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📊 Recovery Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={recoveryProgress}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => fmtMoney(value as number)} />
                      <Legend />
                      <Bar dataKey="recovered" fill="#10b981" name="Recovered" />
                      <Bar dataKey="remaining" fill="#ef4444" name="Remaining" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Penalties Tab */}
          <TabsContent value="penalties">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">⚠️ Penalty Records</CardTitle>
                <Button
                  onClick={() => setShowAddPenalty(true)}
                  className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                >
                  + Add Penalty
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex gap-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Month/Year</label>
                    <div className="flex gap-2 mt-2">
                      <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell>Driver</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Reason</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Deduction Mode</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {penaltiesLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                        </TableRow>
                      ) : penalties.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">No penalties found</TableCell>
                        </TableRow>
                      ) : (
                        penalties.map((penalty: Penalty) => (
                          <TableRow key={penalty._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                            <TableCell className="font-semibold">{penalty.driverName}</TableCell>
                            <TableCell>
                              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                {penalty.penaltyType.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-bold">{fmtMoney(penalty.amount / 100)}</TableCell>
                            <TableCell className="text-sm">{penalty.reason}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  penalty.status === 'deducted'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : penalty.status === 'approved'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                    : penalty.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300'
                                }
                              >
                                {penalty.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {penalty.deductionMode === 'emi' && penalty.installments
                                ? `EMI (${penalty.installments})`
                                : penalty.deductionMode}
                            </TableCell>
                            <TableCell>
                              {penalty.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approvePenaltyMutation.mutate(penalty._id)}
                                  disabled={approvePenaltyMutation.isPending}
                                  className="text-xs"
                                >
                                  Approve
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recoveries Tab */}
          <TabsContent value="recoveries">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">💰 Recovery Records</CardTitle>
                <Button
                  onClick={() => setShowAddRecovery(true)}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                >
                  + Add Recovery
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Driver</label>
                  <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="">All Drivers</option>
                    {drivers.map((driver: any) => (
                      <option key={driver._id} value={driver._id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell>Driver</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Total Amount</TableCell>
                        <TableCell>Recovered</TableCell>
                        <TableCell>Remaining</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Progress</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recoveriesLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                        </TableRow>
                      ) : recoveries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">No recoveries found</TableCell>
                        </TableRow>
                      ) : (
                        recoveries.map((recovery: Recovery) => {
                          const progress = (recovery.recoveredAmount / recovery.amount) * 100;
                          return (
                            <TableRow key={recovery._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                              <TableCell className="font-semibold">{recovery.driverName}</TableCell>
                              <TableCell>
                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                  {recovery.recoveryType}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold">{fmtMoney(recovery.amount / 100)}</TableCell>
                              <TableCell className="text-green-600 dark:text-green-400 font-semibold">
                                {fmtMoney(recovery.recoveredAmount / 100)}
                              </TableCell>
                              <TableCell className="text-red-600 dark:text-red-400 font-semibold">
                                {fmtMoney(recovery.remainingAmount / 100)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    recovery.status === 'completed'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                      : recovery.status === 'active'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300'
                                  }
                                >
                                  {recovery.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500"
                                    style={{ width: `${progress}%` }}
                                  ></div>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{progress.toFixed(1)}%</p>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ledger Tab */}
          <TabsContent value="ledger">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📋 Salary Ledger (Penalties & Recoveries)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex gap-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Driver</label>
                    <select
                      value={selectedDriver}
                      onChange={(e) => setSelectedDriver(e.target.value)}
                      className="mt-2 w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                    >
                      <option value="">Select Driver...</option>
                      {drivers.map((driver: any) => (
                        <option key={driver._id} value={driver._id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Month</label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className="mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Year</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!selectedDriver ? (
                  <p className="text-center py-8 text-gray-500">Please select a driver to view ledger</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Transaction Type</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Closing Balance</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerEntries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                              No ledger entries for this period
                            </TableCell>
                          </TableRow>
                        ) : (
                          ledgerEntries
                            .filter((entry: LedgerEntry) =>
                              ['penalty', 'damage_recovery', 'challan_recovery', 'cash_shortage', 'fuel_excess'].includes(entry.transactionType)
                            )
                            .map((entry: LedgerEntry) => (
                              <TableRow key={entry._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                <TableCell className="text-sm">
                                  {new Date(entry.createdAt).toLocaleDateString('en-IN')}
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                    {entry.transactionType.replace(/_/g, ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{entry.reason}</TableCell>
                                <TableCell className="font-bold text-red-600 dark:text-red-400">
                                  -{fmtMoney(entry.amount / 100)}
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {fmtMoney(entry.closingBalance / 100)}
                                </TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Penalty Dialog */}
        <Dialog open={showAddPenalty} onOpenChange={setShowAddPenalty}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Penalty</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Driver</label>
                <select
                  value={penaltyForm.driverId}
                  onChange={(e) => setPenaltyForm({ ...penaltyForm, driverId: e.target.value })}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                >
                  <option value="">Select Driver...</option>
                  {drivers.map((driver: any) => (
                    <option key={driver._id} value={driver._id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Penalty Type</label>
                <select
                  value={penaltyForm.penaltyType}
                  onChange={(e) => setPenaltyForm({ ...penaltyForm, penaltyType: e.target.value as any })}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                >
                  <option value="damage">Damage</option>
                  <option value="challan">Challan/Fine</option>
                  <option value="cash_shortage">Cash Shortage</option>
                  <option value="fuel_excess">Fuel Excess</option>
                  <option value="attendance">Attendance</option>
                  <option value="behavior">Behavior</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Amount (₹)</label>
                <Input
                  type="number"
                  value={penaltyForm.amount}
                  onChange={(e) => setPenaltyForm({ ...penaltyForm, amount: Number(e.target.value) })}
                  className="mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reason</label>
                <Input
                  type="text"
                  value={penaltyForm.reason}
                  onChange={(e) => setPenaltyForm({ ...penaltyForm, reason: e.target.value })}
                  className="mt-2"
                  placeholder="Describe the penalty..."
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Deduction Mode</label>
                <select
                  value={penaltyForm.deductionMode}
                  onChange={(e) => setPenaltyForm({ ...penaltyForm, deductionMode: e.target.value as any })}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                >
                  <option value="full_next_salary">Full Next Salary</option>
                  <option value="emi">EMI</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              {penaltyForm.deductionMode === 'emi' && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Number of Installments</label>
                  <Input
                    type="number"
                    min="2"
                    max="12"
                    value={penaltyForm.installments}
                    onChange={(e) => setPenaltyForm({ ...penaltyForm, installments: Number(e.target.value) })}
                    className="mt-2"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Notes (Optional)</label>
                <Input
                  type="text"
                  value={penaltyForm.notes}
                  onChange={(e) => setPenaltyForm({ ...penaltyForm, notes: e.target.value })}
                  className="mt-2"
                  placeholder="Add notes..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddPenalty(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => addPenaltyMutation.mutate()}
                disabled={!penaltyForm.driverId || penaltyForm.amount === 0 || addPenaltyMutation.isPending}
                className="bg-red-500 hover:bg-red-600"
              >
                {addPenaltyMutation.isPending ? 'Adding...' : 'Add Penalty'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Recovery Dialog */}
        <Dialog open={showAddRecovery} onOpenChange={setShowAddRecovery}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Initiate Recovery</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Driver</label>
                <select
                  value={recoveryForm.driverId}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, driverId: e.target.value })}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                >
                  <option value="">Select Driver...</option>
                  {drivers.map((driver: any) => (
                    <option key={driver._id} value={driver._id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recovery Type</label>
                <select
                  value={recoveryForm.recoveryType}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, recoveryType: e.target.value as any })}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                >
                  <option value="advance">Advance</option>
                  <option value="loan">Loan</option>
                  <option value="penalty">Penalty</option>
                  <option value="damage">Damage</option>
                  <option value="shortage">Shortage</option>
                  <option value="fuel_excess">Fuel Excess</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Amount (₹)</label>
                <Input
                  type="number"
                  value={recoveryForm.amount}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, amount: Number(e.target.value) })}
                  className="mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Description</label>
                <Input
                  type="text"
                  value={recoveryForm.description}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, description: e.target.value })}
                  className="mt-2"
                  placeholder="Describe the recovery..."
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recovery Mode</label>
                <select
                  value={recoveryForm.recoveryMode}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, recoveryMode: e.target.value as any })}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800"
                >
                  <option value="single">Single Payment</option>
                  <option value="emi">EMI</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              {recoveryForm.recoveryMode === 'emi' && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Number of Installments</label>
                  <Input
                    type="number"
                    min="2"
                    max="24"
                    value={recoveryForm.installments}
                    onChange={(e) => setRecoveryForm({ ...recoveryForm, installments: Number(e.target.value) })}
                    className="mt-2"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddRecovery(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => addRecoveryMutation.mutate()}
                disabled={!recoveryForm.driverId || recoveryForm.amount === 0 || addRecoveryMutation.isPending}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {addRecoveryMutation.isPending ? 'Creating...' : 'Create Recovery'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
