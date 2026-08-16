import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Eye, FileText } from 'lucide-react';
import { useLocation } from 'wouter';
import SuperAdminLayout from '@/components/superadmin-layout';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName?: string;
  planId: string;
  billingPeriod: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  outstanding: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOID';
  createdAt: string;
}

export default function BillingPage() {
  const [, setLocation] = useLocation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PAID' | 'PENDING' | 'OVERDUE'>('all');

  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    outstandingAmount: 0,
    invoiceCount: 0,
    paidPercentage: 0,
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    try {
      // Mock data for now - real implementation would fetch from API
      const mockInvoices: Invoice[] = [
        {
          _id: '1',
          invoiceNumber: 'INV-2026-001',
          tenantId: 'tenant-1',
          tenantName: 'FleetPro QA',
          planId: 'plan-1',
          billingPeriod: 'August 2026',
          invoiceDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          subtotal: 9900,
          tax: 1782,
          total: 11682,
          paid: 11682,
          outstanding: 0,
          status: 'PAID',
          createdAt: new Date().toISOString(),
        },
        {
          _id: '2',
          invoiceNumber: 'INV-2026-002',
          tenantId: 'tenant-2',
          tenantName: 'Aradhya Travels',
          planId: 'plan-2',
          billingPeriod: 'August 2026',
          invoiceDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          subtotal: 19900,
          tax: 3582,
          total: 23482,
          paid: 0,
          outstanding: 23482,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        },
      ];

      setInvoices(mockInvoices);

      // Calculate metrics
      const totalRev = mockInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const outstanding = mockInvoices.reduce((sum, inv) => sum + inv.outstanding, 0);
      const paid = mockInvoices.filter(inv => inv.status === 'PAID').length;

      setMetrics({
        totalRevenue: totalRev,
        outstandingAmount: outstanding,
        invoiceCount: mockInvoices.length,
        paidPercentage: Math.round((paid / mockInvoices.length) * 100),
      });
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      case 'PARTIAL': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredInvoices = filter === 'all'
    ? invoices
    : filter === 'PENDING'
    ? invoices.filter(inv => inv.outstanding > 0)
    : invoices.filter(inv => inv.status === filter);

  return (
    <SuperAdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => setLocation('/superadmin')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Billing & Invoices</h1>
          <p className="text-gray-600">Manage SaaS billing, invoices, and payments</p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900">₹{metrics.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Outstanding</p>
            <p className="text-3xl font-bold text-red-600">₹{metrics.outstandingAmount.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Total Invoices</p>
            <p className="text-3xl font-bold text-gray-900">{metrics.invoiceCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Paid %</p>
            <p className="text-3xl font-bold text-green-600">{metrics.paidPercentage}%</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {(['all', 'PAID', 'PENDING', 'OVERDUE'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              }`}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>

        {/* Invoices Table */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No invoices found</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Invoice #</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Tenant</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Period</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Total</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Paid</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Outstanding</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Due Date</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{invoice.invoiceNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{invoice.tenantName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{invoice.billingPeriod}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{invoice.total.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-medium">₹{invoice.paid.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm font-medium" style={{ color: invoice.outstanding > 0 ? '#dc2626' : '#16a34a' }}>
                        ₹{invoice.outstanding.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-green-600 hover:bg-green-50 rounded" title="Download PDF">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
