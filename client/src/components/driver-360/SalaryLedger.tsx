/**
 * PHASE 8: Driver 360 - Salary Ledger Component
 * Displays immutable transaction ledger for driver
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LedgerEntry {
  _id: string;
  transactionType: string;
  amount: number;
  reason: string;
  createdAt: string;
  closingBalance: number;
  createdBy: { userId: string; role: string };
}

export function SalaryLedger({ driverId }: { driverId: string }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLedgerEntries();
  }, [driverId]);

  const fetchLedgerEntries = async () => {
    try {
      setLoading(true);
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const response = await fetch(`/api/driver-salary/ledger/${driverId}?month=${month}&year=${year}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ledger');
      }

      const data = await response.json();
      setEntries(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionColor = (type: string) => {
    if (['salary_earned', 'manual_credit'].includes(type)) {
      return 'text-green-600'; // Credit
    }
    return 'text-red-600'; // Debit
  };

  const formatTransactionType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-200 rounded"></div>
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
          <CardTitle>Transaction Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No transactions recorded</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Ledger (Immutable)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 px-2">Date</th>
                <th className="text-left py-2 px-2">Type</th>
                <th className="text-left py-2 px-2">Description</th>
                <th className="text-right py-2 px-2">Debit</th>
                <th className="text-right py-2 px-2">Credit</th>
                <th className="text-right py-2 px-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isCredit = ['salary_earned', 'manual_credit'].includes(entry.transactionType);
                return (
                  <tr key={entry._id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-2">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {formatTransactionType(entry.transactionType)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs">{entry.reason}</td>
                    <td className={`text-right py-2 px-2 font-semibold ${!isCredit ? 'text-red-600' : ''}`}>
                      {!isCredit ? `₹${entry.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className={`text-right py-2 px-2 font-semibold ${isCredit ? 'text-green-600' : ''}`}>
                      {isCredit ? `₹${entry.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className={`text-right py-2 px-2 font-bold ${getTransactionColor(entry.transactionType)}`}>
                      ₹{entry.closingBalance?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0.00'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
