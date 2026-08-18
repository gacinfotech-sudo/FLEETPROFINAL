import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { MessageSquare, Plus, Search, Filter, Clock, AlertCircle, CheckCircle, TrendingUp, MoreVertical, Send, X, Tag, User, Calendar, Priority } from 'lucide-react';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Waiting Customer' | 'Resolved' | 'Closed';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  tenant: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  responseTime: string;
  resolutionTime?: string;
  category: string;
}

interface TicketMetric {
  month: string;
  created: number;
  resolved: number;
  avgResolutionTime: number;
}

export default function SupportTicketingDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');

  // Sample tickets data
  const tickets: Ticket[] = [
    {
      id: 'TKT-001',
      title: 'API Rate Limit Exceeded',
      description: 'Customer reporting 429 errors on API endpoints',
      status: 'In Progress',
      priority: 'Critical',
      tenant: 'Acme Corp',
      assignedTo: 'John Smith',
      createdAt: '2026-08-15 09:30',
      updatedAt: '2026-08-16 14:20',
      responseTime: '2 hours',
      resolutionTime: 'In progress',
      category: 'Technical',
    },
    {
      id: 'TKT-002',
      title: 'Subscription Upgrade Help',
      description: 'Need assistance upgrading from Professional to Enterprise plan',
      status: 'Waiting Customer',
      priority: 'High',
      tenant: 'TechStart Inc',
      assignedTo: 'Sarah Johnson',
      createdAt: '2026-08-14 15:45',
      updatedAt: '2026-08-16 10:15',
      responseTime: '1 hour',
      category: 'Billing',
    },
    {
      id: 'TKT-003',
      title: 'Authentication Issue',
      description: 'SSO integration not working after recent update',
      status: 'Open',
      priority: 'High',
      tenant: 'Global Solutions',
      assignedTo: 'Unassigned',
      createdAt: '2026-08-16 08:00',
      updatedAt: '2026-08-16 08:00',
      responseTime: '3 hours',
      category: 'Technical',
    },
    {
      id: 'TKT-004',
      title: 'API Documentation Clarification',
      description: 'Need clarification on webhook payload format',
      status: 'Resolved',
      priority: 'Medium',
      tenant: 'Digital Pro',
      assignedTo: 'Mike Chen',
      createdAt: '2026-08-10 12:00',
      updatedAt: '2026-08-12 16:30',
      responseTime: '30 mins',
      resolutionTime: '2 days',
      category: 'Documentation',
    },
    {
      id: 'TKT-005',
      title: 'Invoice Not Received',
      description: 'Monthly invoice for August not received in email',
      status: 'Resolved',
      priority: 'Medium',
      tenant: 'Cloud Systems',
      assignedTo: 'Emily Davis',
      createdAt: '2026-08-15 14:20',
      updatedAt: '2026-08-15 18:45',
      responseTime: '1 hour',
      resolutionTime: '4 hours',
      category: 'Billing',
    },
    {
      id: 'TKT-006',
      title: 'Feature Request: Export Reports',
      description: 'Request ability to export analytics reports to PDF',
      status: 'Open',
      priority: 'Low',
      tenant: 'Acme Corp',
      assignedTo: 'John Smith',
      createdAt: '2026-08-14 11:30',
      updatedAt: '2026-08-14 11:30',
      responseTime: '2 days',
      category: 'Feature Request',
    },
  ];

  // Ticket metrics
  const ticketMetrics: TicketMetric[] = [
    { month: 'May', created: 24, resolved: 20, avgResolutionTime: 8 },
    { month: 'June', created: 31, resolved: 28, avgResolutionTime: 7 },
    { month: 'July', created: 38, resolved: 35, avgResolutionTime: 6 },
    { month: 'August', created: 42, resolved: 38, avgResolutionTime: 5 },
  ];

  // Filter tickets
  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.tenant.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'All' || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Calculate stats
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'Open').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved').length,
    avgResponseTime: '1.5 hours',
    avgResolutionTime: '2.3 days',
    satisfaction: '4.8/5',
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-red-100 text-red-800 border border-red-300';
      case 'In Progress': return 'bg-blue-100 text-blue-800 border border-blue-300';
      case 'Waiting Customer': return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'Resolved': return 'bg-green-100 text-green-800 border border-green-300';
      case 'Closed': return 'bg-gray-100 text-gray-800 border border-gray-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open': return <AlertCircle size={16} />;
      case 'In Progress': return <Clock size={16} />;
      case 'Waiting Customer': return <Clock size={16} />;
      case 'Resolved': return <CheckCircle size={16} />;
      case 'Closed': return <CheckCircle size={16} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <MessageSquare size={32} />
            Support Ticketing System
          </h1>
          <p className="text-blue-100">Manage customer support tickets, track SLAs, and resolve issues efficiently</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-medium">Total Tickets</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
            <p className="text-xs text-gray-600 mt-1">All time</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <p className="text-gray-600 text-sm font-medium">Open</p>
            <p className="text-2xl font-bold text-red-600 mt-2">{stats.open}</p>
            <p className="text-xs text-gray-600 mt-1">Awaiting response</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <p className="text-gray-600 text-sm font-medium">In Progress</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.inProgress}</p>
            <p className="text-xs text-gray-600 mt-1">Being worked on</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium">Resolved</p>
            <p className="text-2xl font-bold text-green-600 mt-2">{stats.resolved}</p>
            <p className="text-xs text-gray-600 mt-1">Closed</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm font-medium">Avg Response</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">{stats.avgResponseTime}</p>
            <p className="text-xs text-gray-600 mt-1">SLA target</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-pink-500">
            <p className="text-gray-600 text-sm font-medium">Satisfaction</p>
            <p className="text-2xl font-bold text-pink-600 mt-2">{stats.satisfaction}</p>
            <p className="text-xs text-gray-600 mt-1">CSAT rating</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'tickets'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Tickets
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Analytics
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Critical & High Priority */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Urgent Tickets</h3>
                <div className="space-y-3">
                  {tickets
                    .filter(t => t.priority === 'Critical' || t.priority === 'High')
                    .slice(0, 3)
                    .map(ticket => (
                      <div key={ticket.id} className="p-3 border-l-4 border-orange-400 bg-orange-50 rounded hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{ticket.id}: {ticket.title}</p>
                            <p className="text-xs text-gray-600 mt-1">{ticket.tenant}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs font-bold rounded ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Metrics</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">SLA Compliance</span>
                      <span className="text-sm font-bold text-green-600">94%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '94%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">Resolution Rate</span>
                      <span className="text-sm font-bold text-blue-600">90%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: '90%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">First Response Time</span>
                      <span className="text-sm font-bold">1.5 hrs avg</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">Target: 2 hours</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Workload */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Support Team Workload</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { name: 'John Smith', assigned: 8, resolved: 6, rating: '4.9/5' },
                  { name: 'Sarah Johnson', assigned: 5, resolved: 5, rating: '4.8/5' },
                  { name: 'Mike Chen', assigned: 6, resolved: 4, rating: '4.7/5' },
                  { name: 'Emily Davis', assigned: 4, resolved: 3, rating: '4.6/5' },
                ].map(agent => (
                  <div key={agent.name} className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                    <p className="font-semibold text-gray-900">{agent.name}</p>
                    <div className="space-y-2 mt-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Assigned:</span>
                        <span className="font-bold">{agent.assigned}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Resolved:</span>
                        <span className="font-bold text-green-600">{agent.resolved}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rating:</span>
                        <span className="font-bold">{agent.rating}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            {/* Search & Filters */}
            <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by ID, title, or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option>All Status</option>
                <option>Open</option>
                <option>In Progress</option>
                <option>Waiting Customer</option>
                <option>Resolved</option>
                <option>Closed</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option>All Priority</option>
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>

            {/* Tickets List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Ticket</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Customer</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Priority</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Assigned To</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map(ticket => (
                      <tr key={ticket.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-gray-900">{ticket.id}</p>
                            <p className="text-sm text-gray-600 mt-1">{ticket.title}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{ticket.tenant}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(ticket.status)}`}>
                            {getStatusIcon(ticket.status)}
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{ticket.assignedTo}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{ticket.createdAt}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => setSelectedTicket(ticket)}
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Ticket Volume & Resolution Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={ticketMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="created" stroke="#3B82F6" strokeWidth={2} name="Created" />
                  <Line yAxisId="left" type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} name="Resolved" />
                  <Line yAxisId="right" type="monotone" dataKey="avgResolutionTime" stroke="#F59E0B" strokeWidth={2} name="Avg Resolution (days)" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h4 className="font-bold text-gray-900 mb-4">Tickets by Category</h4>
                <div className="space-y-3">
                  {[
                    { name: 'Technical', count: 18, percent: 45 },
                    { name: 'Billing', count: 12, percent: 30 },
                    { name: 'Documentation', count: 6, percent: 15 },
                    { name: 'Feature Request', count: 4, percent: 10 },
                  ].map(cat => (
                    <div key={cat.name}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-900">{cat.name}</span>
                        <span className="text-sm font-bold">{cat.count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${cat.percent}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h4 className="font-bold text-gray-900 mb-4">Status Distribution</h4>
                <div className="space-y-3">
                  {[
                    { status: 'Open', count: 4, color: 'bg-red-500' },
                    { status: 'In Progress', count: 6, color: 'bg-blue-500' },
                    { status: 'Waiting Customer', count: 3, color: 'bg-yellow-500' },
                    { status: 'Resolved', count: 25, color: 'bg-green-500' },
                  ].map(item => (
                    <div key={item.status} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                      <span className="text-sm text-gray-900">{item.status}</span>
                      <span className="ml-auto text-sm font-bold">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h4 className="font-bold text-gray-900 mb-4">SLA Performance</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-900">Response Time</span>
                      <span className="text-sm font-bold text-green-600">98%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '98%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-900">Resolution Time</span>
                      <span className="text-sm font-bold text-green-600">91%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '91%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedTicket.id}</h2>
                <p className="text-gray-600 mt-1">{selectedTicket.title}</p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 font-semibold">Status</p>
                  <span className={`inline-block mt-2 px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(selectedTicket.status)}`}>
                    {selectedTicket.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-semibold">Priority</p>
                  <span className={`inline-block mt-2 px-3 py-1 text-xs font-bold rounded-full ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-semibold">Assigned To</p>
                  <p className="mt-2 text-gray-900">{selectedTicket.assignedTo}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-semibold">Customer</p>
                  <p className="mt-2 text-gray-900">{selectedTicket.tenant}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-semibold">Response Time</p>
                  <p className="mt-2 text-gray-900">{selectedTicket.responseTime}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-semibold">Category</p>
                  <p className="mt-2 text-gray-900">{selectedTicket.category}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm text-gray-600 font-semibold mb-2">Description</p>
                <p className="text-gray-900 bg-gray-50 p-4 rounded-lg">{selectedTicket.description}</p>
              </div>

              {/* Reply Box */}
              <div>
                <p className="text-sm text-gray-600 font-semibold mb-2">Add Reply</p>
                <div className="space-y-3">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your response here..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                  ></textarea>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setSelectedTicket(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2">
                      <Send size={16} />
                      Send Reply
                    </button>
                  </div>
                </div>
              </div>

              {/* Change Status */}
              <div>
                <p className="text-sm text-gray-600 font-semibold mb-2">Change Status</p>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>{selectedTicket.status}</option>
                  <option>Open</option>
                  <option>In Progress</option>
                  <option>Waiting Customer</option>
                  <option>Resolved</option>
                  <option>Closed</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
