import { useState, useEffect } from 'react';

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/saas/subscriptions')
      .then(r => r.json())
      .then(data => {
        setSubscriptions(data.subscriptions || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Loading subscriptions...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">📋 Subscriptions</h1>
        <p className="text-gray-600">{subscriptions.length} active subscriptions</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Tenant</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Plan</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Start Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Next Due</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map(sub => (
              <tr key={sub.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">{sub.tenantId}</td>
                <td className="px-6 py-4 font-semibold">{sub.plan}</td>
                <td className="px-6 py-4">₹{sub.amount?.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm">{sub.startDate}</td>
                <td className="px-6 py-4 text-sm font-semibold">{sub.nextDueDate}</td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                    {sub.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
