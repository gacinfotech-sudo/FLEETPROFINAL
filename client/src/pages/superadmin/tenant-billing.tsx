import { useState } from 'react';
import { ArrowLeft, DollarSign, Calendar, CheckCircle, AlertCircle, RefreshCw, Download, Edit2 } from 'lucide-react';
import { useLocation, useRoute } from 'wouter';
import SuperAdminLayout from '@/components/superadmin-layout';

interface BillingData {
  subscriptionPlan: 'starter' | 'professional' | 'enterprise';
  monthlyAmount: number;
  billingCycle: 'monthly' | 'yearly';
  autoRenewal: boolean;
  renewalDate: string;
  paymentStatus: 'paid' | 'pending' | 'failed';
  paymentMethod: string;
  nextBillingDate: string;
  lastPaymentDate: string;
  totalAmountPaid: number;
  outstandingAmount: number;
  billingAddress: string;
  invoices: Array<{
    id: string;
    date: string;
    amount: number;
    status: 'paid' | 'pending' | 'overdue';
    invoiceUrl: string;
  }>;
}

const PLAN_DETAILS = {
  starter: { name: 'Starter', vehicles: 10, drivers: 20, price: 5000 },
  professional: { name: 'Professional', vehicles: 50, drivers: 100, price: 15000 },
  enterprise: { name: 'Enterprise', vehicles: 'Unlimited', drivers: 'Unlimited', price: 30000 },
};

export default function TenantBilling() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/superadmin/tenants/:tenantId/billing');
  const tenantId = params?.tenantId as string;

  const [billing, setBilling] = useState<BillingData>({
    subscriptionPlan: 'professional',
    monthlyAmount: 15000,
    billingCycle: 'monthly',
    autoRenewal: true,
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    paymentStatus: 'paid',
    paymentMethod: 'Credit Card ending in 4242',
    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastPaymentDate: new Date().toISOString(),
    totalAmountPaid: 150000,
    outstandingAmount: 0,
    billingAddress: '123 Business St, City, State 12345',
    invoices: [
      {
        id: 'INV-001',
        date: new Date().toISOString(),
        amount: 15000,
        status: 'paid',
        invoiceUrl: '/invoices/inv-001.pdf'
      },
      {
        id: 'INV-002',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 15000,
        status: 'paid',
        invoiceUrl: '/invoices/inv-002.pdf'
      },
      {
        id: 'INV-003',
        date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 15000,
        status: 'paid',
        invoiceUrl: '/invoices/inv-003.pdf'
      },
    ]
  });

  const plan = PLAN_DETAILS[billing.subscriptionPlan];

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => setLocation('/superadmin/tenants')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tenants
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">💳 Billing & Subscription Management</h1>
          <p className="text-gray-600">Manage subscription, payments, and invoices</p>
        </div>

        {/* Current Plan Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Plan Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">{plan.name} Plan</h2>
                <p className="text-gray-700 mt-2">Current subscription active</p>
              </div>
              <button className="p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors">
                <Edit2 className="w-5 h-5 text-blue-600" />
              </button>
            </div>

            <div className="bg-white rounded-lg p-6 mb-6">
              <p className="text-sm text-gray-600 mb-2">Monthly Billing Amount</p>
              <p className="text-4xl font-bold text-blue-600">₹{billing.monthlyAmount.toLocaleString()}</p>
              <p className="text-sm text-gray-600 mt-2">{billing.billingCycle === 'monthly' ? 'Per Month' : 'Per Year'}</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-2 uppercase font-semibold">Vehicles</p>
                <p className="text-2xl font-bold text-gray-900">{plan.vehicles}</p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-2 uppercase font-semibold">Drivers</p>
                <p className="text-2xl font-bold text-gray-900">{plan.drivers}</p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-2 uppercase font-semibold">Status</p>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6">
              <p className="text-sm text-green-700 font-semibold mb-2">Total Paid</p>
              <p className="text-3xl font-bold text-green-900">₹{billing.totalAmountPaid.toLocaleString()}</p>
              <p className="text-xs text-green-600 mt-2">All time</p>
            </div>

            <div className={`bg-gradient-to-br ${billing.outstandingAmount > 0 ? 'from-red-50 to-red-100' : 'from-green-50 to-green-100'} rounded-lg border ${billing.outstandingAmount > 0 ? 'border-red-200' : 'border-green-200'} p-6`}>
              <p className={`text-sm ${billing.outstandingAmount > 0 ? 'text-red-700' : 'text-green-700'} font-semibold mb-2`}>Outstanding</p>
              <p className={`text-3xl font-bold ${billing.outstandingAmount > 0 ? 'text-red-900' : 'text-green-900'}`}>₹{billing.outstandingAmount.toLocaleString()}</p>
              <p className={`text-xs ${billing.outstandingAmount > 0 ? 'text-red-600' : 'text-green-600'} mt-2`}>{billing.outstandingAmount > 0 ? 'Action needed' : 'All paid up'}</p>
            </div>
          </div>
        </div>

        {/* Billing Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Payment Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Payment Information
            </h3>
            <div className="space-y-4">
              <div className="pb-4 border-b border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Payment Method</p>
                <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <div className="w-8 h-5 bg-gradient-to-r from-blue-600 to-purple-600 rounded"></div>
                  {billing.paymentMethod}
                </p>
              </div>
              <div className="pb-4 border-b border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Last Payment Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(billing.lastPaymentDate).toLocaleDateString()}
                </p>
              </div>
              <div className="pb-4 border-b border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Next Billing Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(billing.nextBillingDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Payment Status</p>
                <span className={`inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold ${
                  billing.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                  billing.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {billing.paymentStatus === 'paid' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {billing.paymentStatus.charAt(0).toUpperCase() + billing.paymentStatus.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Billing Renewal */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-600" />
              Auto-Renewal Settings
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900">Auto-Renewal Status</span>
                  <button className={`relative inline-flex h-7 w-12 items-center rounded-full ${
                    billing.autoRenewal ? 'bg-green-600' : 'bg-gray-300'
                  }`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      billing.autoRenewal ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  {billing.autoRenewal
                    ? 'Your subscription will automatically renew on the renewal date.'
                    : 'Your subscription will NOT automatically renew.'}
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600 mb-2">Renewal Date</p>
                <p className="text-2xl font-bold text-blue-900">
                  {new Date(billing.renewalDate).toLocaleDateString()}
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  {Math.ceil((new Date(billing.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
                </p>
              </div>

              <button className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors mt-4">
                Toggle Auto-Renewal
              </button>
            </div>
          </div>
        </div>

        {/* Billing Address */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center justify-between">
            <span>Billing Address</span>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Edit2 className="w-5 h-5 text-gray-600" />
            </button>
          </h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-900 font-medium">{billing.billingAddress}</p>
          </div>
        </div>

        {/* Invoice History */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              Invoice History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Invoice ID</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {billing.invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{invoice.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(invoice.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ₹{invoice.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors">
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
