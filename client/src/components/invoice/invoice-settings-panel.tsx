import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const FIELDS: [string, string][] = [
  ['legalCompanyName', 'Legal Company Name'], ['brandName', 'Brand Name'],
  ['gstNumber', 'GST Number'], ['panNumber', 'PAN'],
  ['mobile', 'Mobile'], ['email', 'Email'], ['website', 'Website'],
];
const ADDRESS_FIELDS: [string, string][] = [
  ['registeredAddress', 'Registered Address'], ['branchAddress', 'Branch Address (Optional)'],
];
const NUMBERING_FIELDS: [string, string][] = [
  ['taxInvoicePrefix', 'Tax Invoice Prefix'], ['nonGstInvoicePrefix', 'Non-GST Invoice Prefix'],
  ['proformaPrefix', 'Proforma Prefix'], ['creditNotePrefix', 'Credit Note Prefix'],
  ['debitNotePrefix', 'Debit Note Prefix'], ['receiptPrefix', 'Receipt Prefix'],
];
const BANK_FIELDS: [string, string][] = [
  ['bankAccountName', 'Account Holder Name'], ['bankName', 'Bank Name'],
  ['bankAccountNumber', 'Account Number'], ['bankIfsc', 'IFSC Code'],
  ['bankBranch', 'Branch'], ['upiId', 'UPI ID'],
];

interface Props {
  userRole: string;
}

export default function InvoiceSettingsPanel({ userRole }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasAccess = userRole === 'client' || userRole === 'admin';
  const [form, setForm] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);
  // If the settings GET resolves AFTER the user has already started typing
  // (a real race, not hypothetical — this page can carry other panels
  // with their own slower fetches ahead of it), populating on `!loaded`
  // alone overwrites their in-progress edit with the stale server value
  // the instant it arrives. Same hasInteractedRef idiom already used for
  // this exact class of problem in enhanced-booking-form.tsx's draft-resume
  // logic: once the user has touched the form, the fetch may still populate
  // (first load) but never clobber afterward.
  const hasInteractedRef = useRef(false);

  const { data: settings } = useQuery<any>({ queryKey: ['/api/invoice-settings'], enabled: hasAccess });

  useEffect(() => {
    if (settings && !loaded && !hasInteractedRef.current) { setForm(settings); setLoaded(true); }
  }, [settings, loaded]);

  const saveMutation = useMutation({
    mutationFn: async () => (await apiRequest('PATCH', '/api/invoice-settings', form)).json(),
    onSuccess: (result: any) => {
      toast({ title: 'Invoice settings saved', description: 'Applies to invoices generated from now on — existing finalized invoices are unaffected.' });
      setForm(result);
      queryClient.invalidateQueries({ queryKey: ['/api/invoice-settings'] });
    },
    onError: (error: any) => toast({ title: 'Could not save invoice settings', description: error.message, variant: 'destructive' }),
  });

  const set = (key: string, value: any) => { hasInteractedRef.current = true; setForm((f) => ({ ...f, [key]: value })); };

  if (!hasAccess) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-lg">
          <FileText className="text-violet-600" size={20} />
          <span>Invoice Settings</span>
        </CardTitle>
        <p className="text-sm text-gray-500">Company, numbering, and bank details used on every invoice PDF and WhatsApp message going forward.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Company Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FIELDS.map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={`invset-${key}`}>{label}</Label>
                <Input id={`invset-${key}`} value={form[key] || ''} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {ADDRESS_FIELDS.map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={`invset-${key}`}>{label}</Label>
                <Textarea id={`invset-${key}`} value={form[key] || ''} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-3">Numbering &amp; Tax</h4>
          <p className="text-xs text-gray-500 mb-2">Each document type gets its own sequential, financial-year-aware series, e.g. {form.taxInvoicePrefix || 'INV'}/2026-27/0001.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {NUMBERING_FIELDS.map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={`invset-${key}`}>{label}</Label>
                <Input id={`invset-${key}`} value={form[key] || ''} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
            <div>
              <Label htmlFor="invset-defaultGstRate">Default GST Rate (%)</Label>
              <Input id="invset-defaultGstRate" type="number" value={form.defaultGstRate ?? ''} onChange={(e) => set('defaultGstRate', Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="invset-financialYearStartMonth">Financial Year Starts (Month)</Label>
              <Input id="invset-financialYearStartMonth" type="number" min={1} max={12} value={form.financialYearStartMonth ?? ''} onChange={(e) => set('financialYearStartMonth', Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-3">Bank &amp; Payment</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {BANK_FIELDS.map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={`invset-${key}`}>{label}</Label>
                <Input id={`invset-${key}`} value={form[key] || ''} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-3">Terms &amp; Footer</h4>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label htmlFor="invset-defaultPaymentTerms">Default Payment Terms</Label>
              <Input id="invset-defaultPaymentTerms" value={form.defaultPaymentTerms || ''} onChange={(e) => set('defaultPaymentTerms', e.target.value)} placeholder="e.g. Net 15 days" />
            </div>
            <div>
              <Label htmlFor="invset-defaultTermsAndConditions">Default Terms &amp; Conditions</Label>
              <Textarea id="invset-defaultTermsAndConditions" value={form.defaultTermsAndConditions || ''} onChange={(e) => set('defaultTermsAndConditions', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="invset-authorizedSignatoryName">Authorized Signatory Name</Label>
              <Input id="invset-authorizedSignatoryName" value={form.authorizedSignatoryName || ''} onChange={(e) => set('authorizedSignatoryName', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="invset-invoiceFooterMessage">Invoice Footer Message</Label>
              <Textarea id="invset-invoiceFooterMessage" value={form.invoiceFooterMessage || ''} onChange={(e) => set('invoiceFooterMessage', e.target.value)} placeholder="e.g. Thank you for choosing us!" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Save Invoice Settings</Button>
        </div>
      </CardContent>
    </Card>
  );
}
