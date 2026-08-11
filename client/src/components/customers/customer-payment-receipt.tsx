import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function money(value?: number) {
  return `₹${(value || 0).toLocaleString('en-IN')}`;
}

function safe(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char));
}

export default function CustomerPaymentReceipt({ customerId, paymentId }: { customerId: string; paymentId: string }) {
  const [open, setOpen] = useState(false);
  const { data: receipt, isLoading } = useQuery<any>({
    queryKey: [`/api/customers/${customerId}/payments/${paymentId}/receipt`],
    enabled: open,
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/payments/${paymentId}/receipt`, { credentials: 'include' });
      if (!response.ok) throw new Error('Could not create receipt');
      return response.json();
    },
  });

  const downloadPdf = async () => {
    if (!receipt) return;
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text(receipt.business.name, 20, 20);
    pdf.setFontSize(14);
    pdf.text('PAYMENT RECEIPT', 20, 32);
    pdf.setFontSize(10);
    const lines = [
      `Receipt: ${receipt.receiptNumber}`,
      `Date: ${new Date(receipt.payment.receivedAt).toLocaleString('en-IN')}`,
      `Customer: ${receipt.customer.name}`,
      `Customer ID: ${receipt.customer.customerId}`,
      `Mobile: ${receipt.customer.primaryMobile?.replace(/^91/, '') || '-'}`,
      `Booking: ${receipt.booking.bookingNumber}`,
      `Route: ${receipt.booking.route}`,
      `Payment type: ${receipt.payment.type.replace(/_/g, ' ')}`,
      `Payment mode: ${receipt.payment.mode.replace(/_/g, ' ')}`,
      `Reference: ${receipt.payment.transactionReference || '-'}`,
      `Received by: ${receipt.payment.receivedBy || '-'}`,
      `Amount received: INR ${Number(receipt.payment.amount).toLocaleString('en-IN')}`,
      `Status: ${receipt.status}`,
    ];
    lines.forEach((line, index) => pdf.text(line, 20, 45 + index * 8));
    pdf.save(`${receipt.receiptNumber}.pdf`);
  };

  const printReceipt = () => {
    if (!receipt) return;
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=760,height=900');
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>${safe(receipt.receiptNumber)}</title><style>body{font-family:Arial;padding:40px;color:#111}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ddd}.amount{font-size:28px;font-weight:700;margin:24px 0}.reversed{color:#b91c1c}</style></head><body><h1>${safe(receipt.business.name)}</h1><h2>Payment Receipt</h2><div class="row"><span>Receipt</span><strong>${safe(receipt.receiptNumber)}</strong></div><div class="row"><span>Customer</span><strong>${safe(receipt.customer.name)}</strong></div><div class="row"><span>Booking</span><strong>${safe(receipt.booking.bookingNumber)}</strong></div><div class="row"><span>Route</span><strong>${safe(receipt.booking.route)}</strong></div><div class="row"><span>Mode</span><strong>${safe(receipt.payment.mode.replace(/_/g, ' '))}</strong></div><div class="row"><span>Reference</span><strong>${safe(receipt.payment.transactionReference || '-')}</strong></div><div class="amount">${safe(money(receipt.payment.amount))}</div>${receipt.status === 'reversed' ? '<p class="reversed"><strong>REVERSED</strong></p>' : ''}<script>window.print();window.close();</script></body></html>`);
    printWindow.document.close();
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label="Create Receipt"><ReceiptText className="h-4 w-4" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
          {isLoading || !receipt ? <p className="text-sm text-gray-500 py-8 text-center">Creating receipt...</p> : (
            <div className="rounded-lg border p-5 space-y-4">
              <div className="flex justify-between items-start gap-3">
                <div><p className="font-bold text-lg">{receipt.business.name}</p><p className="text-sm text-gray-500">{receipt.receiptNumber}</p></div>
                <Badge variant={receipt.status === 'reversed' ? 'destructive' : 'outline'} className="capitalize">{receipt.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500">Customer</p><p className="font-medium">{receipt.customer.name}</p><p className="text-xs">{receipt.customer.customerId}</p></div>
                <div><p className="text-gray-500">Booking</p><p className="font-medium">{receipt.booking.bookingNumber}</p><p className="text-xs">{receipt.booking.route}</p></div>
                <div><p className="text-gray-500">Received on</p><p className="font-medium">{new Date(receipt.payment.receivedAt).toLocaleString('en-IN')}</p></div>
                <div><p className="text-gray-500">Mode / Reference</p><p className="font-medium capitalize">{receipt.payment.mode.replace(/_/g, ' ')}</p><p className="text-xs">{receipt.payment.transactionReference || '-'}</p></div>
              </div>
              <div className="rounded-lg bg-green-50 p-4"><p className="text-sm text-green-800">Amount received</p><p className="text-2xl font-bold text-green-800">{money(receipt.payment.amount)}</p></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={!receipt} onClick={printReceipt}><Printer className="h-4 w-4 mr-1" /> Print</Button>
            <Button disabled={!receipt} onClick={downloadPdf}><Download className="h-4 w-4 mr-1" /> Download PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
