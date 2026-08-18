import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { Download, Eye, FileText, AlertCircle } from "lucide-react";

export default function VendorInvoices() {
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: invoicesList, isLoading } = useQuery({
    queryKey: ["/api/vendor-invoices"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/vendor-invoices`);
      return response.json();
    },
  });

  const { data: vendorInvoice, isLoading: invoiceLoading } = useQuery({
    queryKey: ["/api/vendor-invoices", selectedVendor],
    queryFn: async () => {
      if (!selectedVendor) return null;
      const response = await apiRequest("GET", `/api/vendor-invoices/${encodeURIComponent(selectedVendor)}`);
      return response.json();
    },
    enabled: !!selectedVendor,
  });

  const downloadInvoicePDF = (vendorName: string) => {
    const invoice = invoicesList?.vendors?.find((v: any) => v.vendorName === vendorName);
    if (!invoice) return;

    const html = generateInvoiceHTML(vendorInvoice || invoice);
    const blob = new Blob([html], { type: "text/html" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoice.invoiceNo}.html`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const generateInvoiceHTML = (invoice: any) => {
    const formatAmount = (val: number) => `₹${val?.toLocaleString("en-IN") || 0}`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .invoice { background: white; max-width: 900px; margin: 0 auto; padding: 40px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
          .title { font-size: 28px; font-weight: bold; color: #1f2937; }
          .invoice-meta { text-align: right; }
          .invoice-meta p { margin: 5px 0; }
          .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
          .info-block h3 { margin: 0 0 10px 0; font-size: 12px; color: #666; text-transform: uppercase; }
          .info-block p { margin: 5px 0; }
          table { width: 100%; margin-bottom: 30px; border-collapse: collapse; }
          th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
          td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          .amount { text-align: right; }
          .total-row { font-weight: bold; background: #f9fafb; }
          .status-paid { color: #059669; }
          .status-outstanding { color: #dc2626; }
          .signature { margin-top: 40px; text-align: right; }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="header">
            <div class="title">Invoice</div>
            <div class="invoice-meta">
              <p><strong>${invoice.invoiceNo || 'N/A'}</strong></p>
              <p>Date: ${invoice.invoiceDate || new Date().toISOString().split('T')[0]}</p>
              <p>Due: ${invoice.dueDate || 'N/A'}</p>
            </div>
          </div>

          <div class="info-section">
            <div class="info-block">
              <h3>Bill To</h3>
              <p><strong>${invoice.vendorName || 'N/A'}</strong></p>
              <p>Phone: ${invoice.vendorContactPhone || 'N/A'}</p>
            </div>
            <div class="info-block">
              <h3>Invoice Details</h3>
              <p>Total Bookings: <strong>${invoice.summary?.totalBookings || 0}</strong></p>
              <p>Status: <strong class="${invoice.summary?.status === 'Paid' ? 'status-paid' : 'status-outstanding'}">${invoice.summary?.status || 'N/A'}</strong></p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Date</th>
                <th class="amount">Amount</th>
                <th class="amount">Paid</th>
                <th class="amount">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.bookings || invoice.summary ? invoice.bookings || [] : [])
                .map((b: any) => `
                  <tr>
                    <td>${b.bookingId}</td>
                    <td>${b.customerName || 'N/A'}</td>
                    <td>${b.route || b.pickupLocation + ' → ' + b.dropoffLocation}</td>
                    <td>${new Date(b.pickupDate).toLocaleDateString()}</td>
                    <td class="amount">${formatAmount(b.amount || b.vendorAgreedRate)}</td>
                    <td class="amount">${formatAmount(b.paid || b.vendorAdvancePaid)}</td>
                    <td class="amount">${formatAmount(b.outstanding)}</td>
                  </tr>
                `)
                .join('')}
            </tbody>
          </table>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
              <div>
                <p style="color: #666; font-size: 12px; margin: 0;">Total Agreed</p>
                <p style="font-size: 18px; font-weight: bold; margin: 0;">${formatAmount(invoice.summary?.totalAgreed || invoice.totalAgreed)}</p>
              </div>
              <div>
                <p style="color: #666; font-size: 12px; margin: 0;">Total Paid</p>
                <p style="font-size: 18px; font-weight: bold; color: #059669; margin: 0;">${formatAmount(invoice.summary?.totalPaid || invoice.totalPaid)}</p>
              </div>
              <div>
                <p style="color: #666; font-size: 12px; margin: 0;">Outstanding</p>
                <p style="font-size: 18px; font-weight: bold; color: #dc2626; margin: 0;">${formatAmount(invoice.summary?.outstanding || invoice.outstanding)}</p>
              </div>
            </div>
          </div>

          <div class="signature">
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Vendor Invoices</h1>
        <p className="text-gray-600 mt-2">Generate and manage vendor settlement invoices</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm">Total Vendors</p>
              <p className="text-3xl font-bold">{invoicesList?.vendors?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm">Total Bookings</p>
              <p className="text-3xl font-bold">{invoicesList?.totalBookings || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm">Outstanding</p>
              <p className="text-3xl font-bold text-red-600">
                ₹{(invoicesList?.totalOutstanding || 0).toLocaleString("en-IN")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm">Generated</p>
              <p className="text-sm font-mono">
                {new Date(invoicesList?.generatedAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Vendor Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Total Agreed</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicesList?.vendors?.map((vendor: any) => (
                <TableRow key={vendor.vendorName}>
                  <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                  <TableCell>{vendor.vendorContactPhone || '—'}</TableCell>
                  <TableCell className="text-right">
                    ₹{vendor.totalAgreed.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    ₹{vendor.totalPaid.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    ₹{vendor.outstanding.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>{vendor.bookingCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedVendor(vendor.vendorName)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadInvoicePDF(vendor.vendorName)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedVendor && vendorInvoice && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedVendor} - Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Invoice No</p>
                <p className="font-mono font-bold">{vendorInvoice.invoiceNo}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Invoice Date</p>
                <p className="font-mono">{vendorInvoice.invoiceDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Due Date</p>
                <p className="font-mono">{vendorInvoice.dueDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge
                  variant={
                    vendorInvoice.summary.status === "Paid"
                      ? "default"
                      : "destructive"
                  }
                >
                  {vendorInvoice.summary.status}
                </Badge>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorInvoice.bookings?.map((booking: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">
                      {booking.bookingId}
                    </TableCell>
                    <TableCell>{booking.customerName}</TableCell>
                    <TableCell>{booking.route}</TableCell>
                    <TableCell>
                      {new Date(booking.pickupDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{booking.amount.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ₹{booking.paid.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      ₹{booking.outstanding.toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="bg-gray-50 p-4 rounded-lg flex justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Agreed</p>
                <p className="text-2xl font-bold">
                  ₹{vendorInvoice.summary.totalAgreed.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{vendorInvoice.summary.totalPaid.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Outstanding</p>
                <p className="text-2xl font-bold text-red-600">
                  ₹{vendorInvoice.summary.outstanding.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => downloadInvoicePDF(selectedVendor)}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Invoice
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
