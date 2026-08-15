import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

export default function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch('/api/saas/admin/support-tickets')
      .then(r => r.json())
      .then(data => {
        setTickets(data.tickets || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch tickets:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Loading tickets...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">🎧 Support Tickets</h1>
        <p className="text-gray-600">{tickets.length} total tickets</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Subject</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Tenant</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Priority</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Created</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(ticket => (
              <tr key={ticket.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-sm">{ticket.id}</td>
                <td className="px-6 py-4 cursor-pointer text-blue-600 hover:underline"
                    onClick={() => setLocation(`/superadmin/support/tickets/${ticket.id}`)}>
                  {ticket.subject}
                </td>
                <td className="px-6 py-4 text-sm">{ticket.tenantId}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                    ticket.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {ticket.priority}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                    {ticket.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">{ticket.createdAt}</td>
                <td className="px-6 py-4">
                  <button className="text-blue-600 hover:underline text-sm">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
