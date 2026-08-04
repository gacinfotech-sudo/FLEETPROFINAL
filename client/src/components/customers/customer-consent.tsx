import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Mail, Phone, Megaphone, ShieldOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  customerId: string;
  customer: any;
}

const CHANNELS: { key: 'whatsapp' | 'promotional' | 'email' | 'sms'; label: string; icon: any }[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'promotional', label: 'Promotional', icon: Megaphone },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'sms', label: 'SMS', icon: Phone },
];

// Transactional booking messages (confirmation, driver duty) are never
// gated by this — only promotional/campaign sends (once campaigns exist)
// must check consent.promotional + status here before contacting anyone.
export default function CustomerConsent({ customerId, customer }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDNC, setShowDNC] = useState(false);
  const [dncReason, setDncReason] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
  };

  const toggleConsent = useMutation({
    mutationFn: async ({ channel, grant }: { channel: string; grant: boolean }) => {
      const url = grant ? `/api/customers/${customerId}/consent` : `/api/customers/${customerId}/opt-out`;
      return (await apiRequest("POST", url, grant ? { channel, source: 'manual' } : { channel })).json();
    },
    onSuccess: () => { toast({ title: "Consent updated" }); invalidate(); },
    onError: (err: any) => toast({ title: "Could not update consent", description: err.message, variant: "destructive" }),
  });

  const markDNC = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/customers/${customerId}/opt-out`, { channel: 'all', reason: dncReason })).json(),
    onSuccess: () => { toast({ title: "Customer marked Do Not Contact" }); setShowDNC(false); setDncReason(""); invalidate(); },
    onError: (err: any) => toast({ title: "Could not update", description: err.message, variant: "destructive" }),
  });

  const restoreContact = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/customers/${customerId}/consent`, { channel: 'whatsapp', source: 'manual' })).json(),
    onSuccess: () => { toast({ title: "Contact restored" }); invalidate(); },
  });

  const consent = customer.consent || { whatsapp: true, promotional: false, email: true, sms: true };

  return (
    <div className="space-y-2">
      {customer.status === 'do_not_contact' && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-800 text-sm">
            <ShieldOff className="w-4 h-4" />
            <span>Do Not Contact{customer.doNotContactReason ? ` — ${customer.doNotContactReason}` : ""}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => restoreContact.mutate()}>Restore Contact</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {CHANNELS.map(({ key, label, icon: Icon }) => {
          const granted = !!consent[key];
          return (
            <button
              key={key}
              onClick={() => toggleConsent.mutate({ channel: key, grant: !granted })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                granted ? 'bg-green-50 text-green-700 border-green-300' : 'bg-gray-50 text-gray-500 border-gray-300'
              }`}
              title={granted ? `Opted in to ${label} — click to opt out` : `Opted out of ${label} — click to opt back in`}
            >
              <Icon className="w-3 h-3" />
              {label}: {granted ? "On" : "Off"}
            </button>
          );
        })}
        {customer.status !== 'do_not_contact' && (
          <Button size="sm" variant="ghost" className="text-red-600 h-7 text-xs" onClick={() => setShowDNC(true)}>
            Mark Do Not Contact
          </Button>
        )}
      </div>

      <Dialog open={showDNC} onOpenChange={setShowDNC}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Do Not Contact</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">This blocks all promotional/marketing contact channels for this customer. Transactional booking messages are unaffected.</p>
          <div>
            <Label>Reason</Label>
            <Textarea value={dncReason} onChange={(e) => setDncReason(e.target.value)} placeholder="e.g. Customer requested no further contact" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDNC(false)}>Cancel</Button>
            <Button variant="destructive" disabled={markDNC.isPending} onClick={() => markDNC.mutate()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
