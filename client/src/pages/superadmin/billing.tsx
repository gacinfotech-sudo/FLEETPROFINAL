import { useState, useEffect } from 'react';

export default function Billing() {
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/saas/admin/billing')
      .then(r => r.json())
      .then(data => {
        setBilling(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch billing:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Loading billing...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">💰 Billing & Revenue</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-600 text-sm">Monthly Revenue</p>
          <p className="text-3xl font-bold mt-2">₹{billing?.revenue?.monthly?.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-600 text-sm">Annual Revenue</p>
          <p className="text-3xl font-bold mt-2">₹{billing?.revenue?.annual?.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-600 text-sm">Outstanding</p>
          <p className="text-3xl font-bold mt-2">₹0</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold mb-4">Recent Invoices</h3>
        <p className="text-gray-600 text-sm">No invoices yet</p>
      </div>
    </div>
  );
}
