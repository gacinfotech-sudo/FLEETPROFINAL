import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Clock, DollarSign, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PaymentSettlementProps {
  booking: any;
}

export default function PaymentSettlement({ booking }: PaymentSettlementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState<'customer' | 'vendor' | 'driver' | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [vendorId, setVendorId] = useState('');
  const [collectorName, setCollectorName] = useState('');

  // Fetch settlement breakdown
  const settlementQuery = useQuery({
    queryKey: [`/api/bookings/${booking._id || booking.id}/settlement`],
    enabled: !!(booking._id || booking.id),
  });

  const settlement = settlementQuery.data as any;

  // Record customer payment
  const customerPaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/bookings/${booking._id || booking.id}/payment/customer`, {
        amount: parseFloat(amount),
        paymentMode,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bookings/${booking._id || booking.id}/settlement`] });
      toast({ title: `₹${amount} customer payment recorded` });
      setAmount('');
      setPaymentMode('cash');
      setDialogOpen(null);
    },
    onError: (err: any) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });

  // Record vendor payment
  const vendorPaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/bookings/${booking._id || booking.id}/payment/vendor`, {
        vendorId,
        amount: parseFloat(amount),
        paymentMode,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bookings/${booking._id || booking.id}/settlement`] });
      toast({ title: `₹${amount} vendor payment recorded` });
      setAmount('');
      setPaymentMode('cash');
      setVendorId('');
      setDialogOpen(null);
    },
    onError: (err: any) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });

  // Record driver collection
  const driverCollectionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/bookings/${booking._id || booking.id}/payment/driver-collection`, {
        amount: parseFloat(amount),
        collectedBy: collectorName,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bookings/${booking._id || booking.id}/settlement`] });
      toast({ title: `₹${amount} driver collection recorded` });
      setAmount('');
      setCollectorName('');
      setDialogOpen(null);
    },
    onError: (err: any) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });

  if (!settlement) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'settled':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'partial':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="border rounded-lg p-2 space-y-2">
      <div className="flex items-center gap-2 font-medium text-sm text-gray-900">
        <DollarSign className="w-3 h-3" />
        Payment Settlement
      </div>

      {/* Settlement Status - Compact */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs">
        {getStatusIcon(settlement.settlement.status)}
        <div className="flex-1">
          <div className="font-medium capitalize">{settlement.settlement.status}</div>
        </div>
      </div>

      {/* Customer Payment - Compact */}
      <div className="border rounded p-2 bg-gray-50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">Customer</span>
          <span className="text-xs font-semibold">₹{settlement.customerPayment.received}/₹{settlement.customerPayment.total}</span>
        </div>
        <div className="w-full bg-gray-300 rounded-full h-1.5 mb-1">
          <div
            className={`h-1.5 rounded-full ${getProgressColor(settlement.customerPayment.percentage)}`}
            style={{ width: `${Math.min(100, settlement.customerPayment.percentage)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600 mb-2">
          <span>{Math.round(settlement.customerPayment.percentage)}%</span>
          <span>₹{settlement.customerPayment.pending} pending</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogOpen('customer')}
          className="w-full h-7 text-xs"
        >
          Record Payment
        </Button>
      </div>

      {/* Vendor Settlement - Compact */}
      {booking.fulfilmentType === 'vendor' && (
        <div className="border rounded p-2 bg-gray-50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Vendor</span>
            <span className="text-xs font-semibold">₹{settlement.vendorSettlement.paid}/₹{settlement.vendorSettlement.total}</span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-1.5 mb-1">
            <div
              className={`h-1.5 rounded-full ${getProgressColor(settlement.vendorSettlement.percentage)}`}
              style={{ width: `${Math.min(100, settlement.vendorSettlement.percentage)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span>{Math.round(settlement.vendorSettlement.percentage)}%</span>
            <span>₹{settlement.vendorSettlement.pending} pending</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialogOpen('vendor')}
            className="w-full h-7 text-xs"
          >
            Record Payment
          </Button>
        </div>
      )}

      {/* Driver Collection - Compact */}
      {booking.fulfilmentType === 'vendor' && (
        <div className="border rounded p-2 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Driver Collection</span>
            <span className="text-xs font-semibold">₹{settlement.driverCollection.collected}</span>
          </div>
          {settlement.driverCollection.pending > 0 && (
            <div className="text-xs text-red-600 mb-2">
              ₹{settlement.driverCollection.pending} pending
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialogOpen('driver')}
            className="w-full h-7 text-xs"
          >
            Record Collection
          </Button>
        </div>
      )}

      {/* Tenant Profit - Compact */}
      <div className="border rounded p-2 bg-green-50 border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-green-600" />
            <span className="text-xs font-medium">Profit</span>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-green-700">₹{settlement.tenantProfit.amount}</div>
            <div className="text-xs text-green-600">
              {settlement.tenantProfit.status === 'received' ? '✓ Received' : '⏳ Pending'}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Payment Dialog */}
      <Dialog open={dialogOpen === 'customer'} onOpenChange={(open) => !open && setDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Customer Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Mode</label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => customerPaymentMutation.mutate()}
              disabled={!amount || customerPaymentMutation.isPending}
            >
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Payment Dialog */}
      <Dialog open={dialogOpen === 'vendor'} onOpenChange={(open) => !open && setDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Vendor Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Vendor</label>
              <Input
                type="text"
                value={booking.fulfilmentVendorId?.vendorName || 'Vendor'}
                disabled
                className="bg-gray-100"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Mode</label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setVendorId(booking.fulfilmentVendorId?._id || '');
                vendorPaymentMutation.mutate();
              }}
              disabled={!amount || vendorPaymentMutation.isPending}
            >
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Driver Collection Dialog */}
      <Dialog open={dialogOpen === 'driver'} onOpenChange={(open) => !open && setDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Driver Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount Collected</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Collected By (Driver Name)</label>
              <Input
                type="text"
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
                placeholder="Enter driver name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => driverCollectionMutation.mutate()}
              disabled={!amount || !collectorName || driverCollectionMutation.isPending}
            >
              Record Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
