import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus, Download, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import QuotationDocument from "./quotation-document";

const PRICING_TYPES = ["fixed", "per_km", "per_day", "per_hour", "monthly", "custom"];

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary", under_review: "secondary", approved: "outline", sent: "outline",
  viewed: "outline", customer_query: "outline", negotiation: "outline",
  accepted: "default", rejected: "destructive", expired: "destructive", superseded: "destructive", converted: "default",
};

// apiRequest() throws `Error("<status>: <raw response text>")` on a
// non-2xx response (queryClient.ts:throwIfResNotOk) — the send-whatsapp
// route's error responses are a JSON body, so this pulls out just the
// human-readable `message` field instead of showing the whole raw JSON
// (WhatsApp session id, phone number, full message content, etc.) in a toast.
function extractApiErrorMessage(error: any): string {
  const raw = String(error?.message || "");
  const jsonStart = raw.indexOf("{");
  if (jsonStart === -1) return raw;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart));
    return parsed.message || raw;
  } catch {
    return raw;
  }
}

function rupeesToPaise(v: string): number | undefined {
  if (v === "" || v === undefined) return undefined;
  return Math.round(Number(v) * 100);
}

interface OptionDraft {
  vehicleNameSnapshot: string;
  quantity: string;
  pricingType: string;
  baseRatePaise: string;
  driverAllowancePaise: string;
  discountPaise: string;
  gstPaise: string;
}

const emptyOption: OptionDraft = { vehicleNameSnapshot: "", quantity: "1", pricingType: "fixed", baseRatePaise: "", driverAllowancePaise: "", discountPaise: "", gstPaise: "" };

export default function QuotationPanel({ leadId, inquiry }: { leadId: string; inquiry: any }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [draftOptions, setDraftOptions] = useState<OptionDraft[]>([{ ...emptyOption }]);
  const [validTill, setValidTill] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [viewingQuotation, setViewingQuotation] = useState<any>(null);
  const [acceptingOption, setAcceptingOption] = useState<{ quotation: any; optionNumber: number } | null>(null);

  const { data: quotations = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/leads/${leadId}/quotations`],
    queryFn: async () => (await apiRequest("GET", `/api/leads/${leadId}/quotations`)).json(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/quotations`] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const options = draftOptions
        .filter((o) => o.vehicleNameSnapshot.trim())
        .map((o) => ({
          vehicleNameSnapshot: o.vehicleNameSnapshot.trim(),
          quantity: Number(o.quantity) || 1,
          pricingType: o.pricingType,
          baseRatePaise: rupeesToPaise(o.baseRatePaise),
          driverAllowancePaise: rupeesToPaise(o.driverAllowancePaise),
          discountPaise: rupeesToPaise(o.discountPaise) || 0,
          gstPaise: rupeesToPaise(o.gstPaise) || 0,
        }));
      const res = await apiRequest("POST", `/api/leads/${leadId}/quotations`, { options, validTill: validTill || undefined, paymentTerms });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setShowNew(false);
      setDraftOptions([{ ...emptyOption }]);
      setValidTill("");
      setPaymentTerms("");
      toast({ variant: "success", title: "Quotation created" });
    },
    onError: (error: any) => toast({ title: "Could not create quotation", description: error.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/quotations/${id}/approve`)).json(),
    onSuccess: () => { invalidate(); toast({ variant: "success", title: "Quotation approved" }); },
    onError: (error: any) => toast({ title: "Could not approve", description: extractApiErrorMessage(error), variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/quotations/${id}/send-whatsapp`, {});
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ variant: "success", title: "Quotation sent on WhatsApp" }); },
    onError: (error: any) => toast({ title: "Could not send", description: extractApiErrorMessage(error), variant: "destructive" }),
  });

  // Generates the same PDF "Download PDF" produces (off-screen render,
  // already tested) and uploads it instead of downloading it — the actual
  // document arrives as a WhatsApp attachment rather than only a text
  // summary. Independent of sendMutation above: sending the text and
  // sending the PDF are each their own idempotent action (see
  // sendQuotationMessage.ts), so doing one first never blocks the other.
  const sendPdfMutation = useMutation({
    mutationFn: async (quotation: any) => {
      const { blob, filename } = await generatePdfBlob(quotation);
      const formData = new FormData();
      formData.append("pdf", blob, filename);
      const res = await apiRequest("POST", `/api/quotations/${quotation._id}/send-whatsapp-pdf`, formData);
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ variant: "success", title: "Quotation PDF sent on WhatsApp" }); },
    onError: (error: any) => toast({ title: "Could not send PDF", description: extractApiErrorMessage(error), variant: "destructive" }),
  });

  // Fallback for when WhatsApp isn't connected for this tenant (a real,
  // common state — a brand-new tenant, or one that just hasn't set it up
  // yet) — "Send on WhatsApp" only ever flips status to 'sent' if the
  // actual send succeeds, which means without this, an approved quotation
  // could never reach 'sent' (and therefore never become acceptable, and
  // therefore never convert to a booking) through the UI at all. Reuses
  // the existing generic status-transition route verbatim — no new
  // backend endpoint, no change to the WhatsApp path itself.
  const markSentMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/quotations/${id}/status`, { status: "sent" })).json(),
    onSuccess: () => { invalidate(); toast({ variant: "success", title: "Quotation marked as sent" }); },
    onError: (error: any) => toast({ title: "Could not update status", description: extractApiErrorMessage(error), variant: "destructive" }),
  });

  const reviseMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/quotations/${id}/revise`)).json(),
    onSuccess: () => { invalidate(); toast({ variant: "success", title: "New revision created" }); },
    onError: (error: any) => toast({ title: "Could not revise", description: extractApiErrorMessage(error), variant: "destructive" }),
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ id, optionNumber }: { id: string; optionNumber: number }) =>
      (await apiRequest("POST", `/api/quotations/${id}/accept`, { acceptedOptionNumber: optionNumber })).json(),
    onSuccess: () => { invalidate(); setAcceptingOption(null); toast({ variant: "success", title: "Quotation accepted" }); },
    onError: (error: any) => toast({ title: "Could not accept", description: extractApiErrorMessage(error), variant: "destructive" }),
  });

  const addOptionRow = () => setDraftOptions((rows) => [...rows, { ...emptyOption }]);
  const removeOptionRow = (i: number) => setDraftOptions((rows) => rows.filter((_, idx) => idx !== i));
  const updateOptionRow = (i: number, patch: Partial<OptionDraft>) =>
    setDraftOptions((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Shared render step behind both "Download PDF" and "Send PDF on
  // WhatsApp" — the same off-screen QuotationDocument render, only the
  // final html2pdf output step differs (.save() triggers a browser
  // download; .outputPdf('blob') hands back bytes to upload instead).
  const renderQuotationPdf = async (
    quotation: any, finish: (html2pdf: any, element: HTMLElement, filename: string) => Promise<void>,
  ) => {
    const html2pdfModule = (await import("html2pdf.js")).default;
    const { createRoot } = await import("react-dom/client");
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    document.body.appendChild(tempDiv);
    const root = createRoot(tempDiv);
    try {
      await new Promise<void>((resolve, reject) => {
        root.render(<QuotationDocument quotation={quotation} inquiry={inquiry} companyName={(user?.tenantId as any)?.businessName || (user?.tenantId as any)?.name || "FleetPro"} />);
        setTimeout(async () => {
          try {
            const element = tempDiv.querySelector("#quotation-pdf");
            if (!element) throw new Error("Could not render the quotation document.");
            await finish(html2pdfModule, element as HTMLElement, `Quotation_${quotation.quotationNumber || "draft"}.pdf`);
            resolve();
          } catch (e) {
            reject(e);
          }
        }, 100);
      });
    } finally {
      root.unmount();
      document.body.removeChild(tempDiv);
    }
  };

  const pdfOptions = (filename: string) => ({
    margin: 0.5, filename,
    image: { type: "jpeg" as const, quality: 0.98 }, html2canvas: { scale: 2 },
    jsPDF: { unit: "in" as const, format: "a4" as const, orientation: "portrait" as const },
  });

  const downloadPdf = (quotation: any) =>
    renderQuotationPdf(quotation, async (html2pdf, element, filename) => {
      await html2pdf().set(pdfOptions(filename)).from(element).save();
    });

  const generatePdfBlob = (quotation: any): Promise<{ blob: Blob; filename: string }> => {
    let result: { blob: Blob; filename: string } | undefined;
    return renderQuotationPdf(quotation, async (html2pdf, element, filename) => {
      const blob: Blob = await html2pdf().set(pdfOptions(filename)).from(element).outputPdf("blob");
      result = { blob, filename };
    }).then(() => {
      if (!result) throw new Error("PDF generation failed.");
      return result;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-gray-700">Quotations</h3>
        <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>New Quotation</Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse h-16 bg-gray-100 rounded-lg" />
      ) : quotations.length === 0 ? (
        <p className="text-sm text-gray-500">No quotations yet.</p>
      ) : (
        <div className="space-y-2">
          {quotations.map((q: any) => (
            <Card key={q._id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{q.quotationNumber || "DRAFT"} <span className="text-gray-400">v{q.version}</span></div>
                  <Badge variant={STATUS_BADGE[q.status] || "secondary"} className="capitalize">{q.status.replace(/_/g, " ")}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(q.options || []).map((opt: any) => (
                    <Badge key={opt.optionNumber} variant={q.acceptedOptionNumber === opt.optionNumber ? "default" : "outline"} className="text-xs">
                      #{opt.optionNumber} {opt.vehicleNameSnapshot} — ₹{((opt.totalPaise || 0) / 100).toLocaleString("en-IN")}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-1 flex-wrap pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setViewingQuotation(q)}>View</Button>
                  <Button size="sm" variant="ghost" onClick={() => downloadPdf(q)}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
                  {q.status === "draft" && <Button size="sm" variant="ghost" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(q._id)}>Approve</Button>}
                  {(q.status === "approved" || q.status === "sent") && (
                    <Button size="sm" variant="ghost" className="text-green-600" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate(q._id)}>
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> {q.status === "sent" ? "Resend" : "Send"} on WhatsApp
                    </Button>
                  )}
                  {(q.status === "approved" || q.status === "sent") && (
                    <Button size="sm" variant="ghost" className="text-green-600" disabled={sendPdfMutation.isPending} onClick={() => sendPdfMutation.mutate(q)}>
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> Send PDF on WhatsApp
                    </Button>
                  )}
                  {q.status === "approved" && (
                    <Button
                      size="sm" variant="ghost" disabled={markSentMutation.isPending}
                      title="Use this if the customer got the quote another way (call, email, in person) or WhatsApp isn't connected for this tenant"
                      onClick={() => markSentMutation.mutate(q._id)}
                    >
                      Mark as Sent (manual)
                    </Button>
                  )}
                  {["sent", "viewed", "customer_query", "negotiation"].includes(q.status) && (
                    <Select onValueChange={(optionNumber) => setAcceptingOption({ quotation: q, optionNumber: Number(optionNumber) })}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Accept option..." /></SelectTrigger>
                      <SelectContent>
                        {(q.options || []).map((opt: any) => <SelectItem key={opt.optionNumber} value={String(opt.optionNumber)}>#{opt.optionNumber} {opt.vehicleNameSnapshot}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {!["draft", "under_review", "accepted", "converted"].includes(q.status) && (
                    <Button size="sm" variant="ghost" disabled={reviseMutation.isPending} onClick={() => reviseMutation.mutate(q._id)}>Revise</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Quotation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {draftOptions.map((opt, i) => (
              <Card key={i}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Option {i + 1}</span>
                    {draftOptions.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeOptionRow(i)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <Input placeholder="Vehicle (e.g. Innova Crysta)" value={opt.vehicleNameSnapshot} onChange={(e) => updateOptionRow(i, { vehicleNameSnapshot: e.target.value })} className="sm:col-span-2" />
                    <Input type="number" min="1" placeholder="Qty" value={opt.quantity} onChange={(e) => updateOptionRow(i, { quantity: e.target.value })} />
                    <Select value={opt.pricingType} onValueChange={(v) => updateOptionRow(i, { pricingType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PRICING_TYPES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" placeholder="Base Rate (₹)" value={opt.baseRatePaise} onChange={(e) => updateOptionRow(i, { baseRatePaise: e.target.value })} />
                    <Input type="number" placeholder="Driver Allowance (₹)" value={opt.driverAllowancePaise} onChange={(e) => updateOptionRow(i, { driverAllowancePaise: e.target.value })} />
                    <Input type="number" placeholder="Discount (₹)" value={opt.discountPaise} onChange={(e) => updateOptionRow(i, { discountPaise: e.target.value })} />
                    <Input type="number" placeholder="GST (₹)" value={opt.gstPaise} onChange={(e) => updateOptionRow(i, { gstPaise: e.target.value })} />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addOptionRow}><Plus className="h-4 w-4 mr-1" /> Add Another Option</Button>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valid Till</Label><Input type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} /></div>
              <div><Label>Payment Terms</Label><Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button type="button" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>Save Quotation</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingQuotation} onOpenChange={(open) => !open && setViewingQuotation(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Quotation Preview</DialogTitle></DialogHeader>
          {viewingQuotation && <QuotationDocument quotation={viewingQuotation} inquiry={inquiry} companyName={(user?.tenantId as any)?.businessName || (user?.tenantId as any)?.name || "FleetPro"} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!acceptingOption} onOpenChange={(open) => !open && setAcceptingOption(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Accept</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Accept option #{acceptingOption?.optionNumber} on {acceptingOption?.quotation?.quotationNumber}? The quotation becomes locked once accepted.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAcceptingOption(null)}>Cancel</Button>
            <Button
              disabled={acceptMutation.isPending}
              onClick={() => acceptingOption && acceptMutation.mutate({ id: acceptingOption.quotation._id, optionNumber: acceptingOption.optionNumber })}
            >
              Confirm Accept
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
