/**
 * HELP DESK DASHBOARD
 * Support agent workbench with ticket management and analytics
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Ticket {
  ticketId: string;
  customerName: string;
  subject: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed' | 'reopened';
  assignedAgentName?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Dashboard {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgResolutionTime: number;
  satisfactionScore: number;
  tickets: Ticket[];
  volumeTrends: { date: string; count: number }[];
  priorityDistribution: { priority: string; count: number }[];
}

export const HelpDeskDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'all', priority: 'all' });
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [filter]);

  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/support/dashboard', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const PRIORITY_COLORS = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };

  if (loading) {
    return <div className="p-4 text-center">Loading dashboard...</div>;
  }

  if (!dashboard) {
    return <div className="p-4 text-center">Failed to load dashboard</div>;
  }

  const filteredTickets = dashboard.tickets.filter(t => {
    const statusMatch = filter.status === 'all' || t.status === filter.status;
    const priorityMatch = filter.priority === 'all' || t.priority === filter.priority;
    return statusMatch && priorityMatch;
  });

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard label="Total Tickets" value={dashboard.totalTickets} color="blue" />
        <MetricCard label="Open" value={dashboard.openTickets} color="orange" />
        <MetricCard label="Resolved" value={dashboard.resolvedTickets} color="green" />
        <MetricCard label="Avg Resolution" value={`${Math.round(dashboard.avgResolutionTime / 3600)}h`} color="purple" />
        <MetricCard label="CSAT Score" value={`${Math.round(dashboard.satisfactionScore)}%`} color="pink" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Ticket Volume Trends">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dashboard.volumeTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Priority Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={dashboard.priorityDistribution} dataKey="count" label nameKey="priority" cx="50%" cy="50%">
                {dashboard.priorityDistribution.map((entry, i) => (
                  <Cell key={i} fill={PRIORITY_COLORS[entry.priority as keyof typeof PRIORITY_COLORS]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Recent Tickets</h3>
          <div className="flex gap-2">
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="px-3 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={filter.priority}
              onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
              className="px-3 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b dark:border-gray-600">
              <tr>
                <th className="text-left py-2">Ticket ID</th>
                <th className="text-left py-2">Customer</th>
                <th className="text-left py-2">Subject</th>
                <th className="text-left py-2">Priority</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Agent</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map(ticket => (
                <tr
                  key={ticket.ticketId}
                  onClick={() => setSelectedTicket(ticket)}
                  className="border-b dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <td className="py-2 font-mono text-xs">{ticket.ticketId.slice(0, 8)}</td>
                  <td className="py-2">{ticket.customerName}</td>
                  <td className="py-2 truncate">{ticket.subject}</td>
                  <td className="py-2">
                    <PriorityBadge priority={ticket.priority} />
                  </td>
                  <td className="py-2">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="py-2">{ticket.assignedAgentName || 'Unassigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTicket && (
        <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => {
  const colorClasses: { [key: string]: string } = {
    blue: 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100',
    orange: 'bg-orange-100 dark:bg-orange-900 text-orange-900 dark:text-orange-100',
    green: 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100',
    purple: 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100',
    pink: 'bg-pink-100 dark:bg-pink-900 text-pink-900 dark:text-pink-100',
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
};

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <h3 className="text-lg font-semibold mb-4">{title}</h3>
    {children}
  </div>
);

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const classes: { [key: string]: string } = {
    critical: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    high: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
    medium: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    low: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${classes[priority] || classes.low}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const classes: { [key: string]: string } = {
    open: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    in_progress: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
    waiting_customer: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200',
    resolved: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    closed: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${classes[status] || classes.open}`}>
      {status.replace(/_/g, ' ').charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
    </span>
  );
};

const TicketDetailModal: React.FC<{ ticket: Ticket; onClose: () => void }> = ({ ticket, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full mx-4 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold">{ticket.subject}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{ticket.ticketId}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Customer</p>
            <p className="font-medium">{ticket.customerName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Assigned Agent</p>
            <p className="font-medium">{ticket.assignedAgentName || 'Unassigned'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Priority</p>
            <PriorityBadge priority={ticket.priority} />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
            <StatusBadge status={ticket.status} />
          </div>
        </div>

        <div className="border-t dark:border-gray-600 pt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
          <p>{new Date(ticket.createdAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

export default HelpDeskDashboard;
