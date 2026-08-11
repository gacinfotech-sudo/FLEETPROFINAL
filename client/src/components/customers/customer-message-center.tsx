import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageCircle, Send, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { whatsappErrorToast } from "@/lib/whatsapp-error";

interface Props {
  customerId: string;
  bookings: any[];
}

interface MessageTemplate {
  key: string;
  title: string;
  description: string;
  category: 'transactional' | 'promotional';
  content: string;
  enabled: boolean;
  disabledReason?: string;
  bookingId?: string;
}

function requestId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function CustomerMessageCenter({ customerId, bookings }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bookingId, setBookingId] = useState<string>('auto');
  const [selectedKey, setSelectedKey] = useState<string>('booking_summary');

  const querySuffix = bookingId === 'auto' ? '' : `?bookingId=${encodeURIComponent(bookingId)}`;
  const { data, isLoading } = useQuery<{ recipientPhone?: string; templates: MessageTemplate[] }>({
    queryKey: [`/api/customers/${customerId}/whatsapp/templates`, bookingId],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/whatsapp/templates${querySuffix}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to load message templates');
      return response.json();
    },
  });
  const { data: history = [] } = useQuery<any[]>({ queryKey: [`/api/customers/${customerId}/messages`] });
  const templates = data?.templates || [];
  const selected = templates.find((template) => template.key === selectedKey) || templates[0];

  useEffect(() => {
    if (templates.length && !templates.some((template) => template.key === selectedKey)) {
      setSelectedKey(templates[0].key);
    }
  }, [templates, selectedKey]);

  // Auto-save form state
  const { save: autoSaveForm } = useFormAutoSave('message-center-form', { bookingId, selectedKey }, 2000);

  useEffect(() => {
    autoSaveForm();
  }, [bookingId, selectedKey, autoSaveForm]);

  const sendMutation = useMutation({
    mutationFn: async (template: MessageTemplate) => (await apiRequest(
      "POST",
      `/api/customers/${customerId}/whatsapp/send`,
      {
        templateKey: template.key,
        bookingId: bookingId === 'auto' ? undefined : bookingId,
        requestId: requestId(),
      },
    )).json(),
    onSuccess: () => {
      toast({ title: "WhatsApp message sent" });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/messages`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/timeline`] });
    },
    onError: (error: any) => toast(whatsappErrorToast(error.message)),
  });

  return (
    <Card className="border-green-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-5 w-5 text-green-600" /> One-click WhatsApp</CardTitle>
          <div className="w-full sm:w-56">
            <Select value={bookingId} onValueChange={setBookingId}>
              <SelectTrigger aria-label="Message booking"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Latest active booking</SelectItem>
                {bookings.map((booking) => <SelectItem key={booking._id} value={booking._id}>{booking.bookingId}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <p className="text-sm text-gray-500">Loading templates...</p> : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {templates.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => setSelectedKey(template.key)}
                  className={`rounded-lg border p-3 text-left transition-colors ${selected?.key === template.key ? 'border-green-500 bg-green-50' : 'hover:border-green-300'} ${!template.enabled ? 'opacity-60' : ''}`}
                >
                  <p className="text-sm font-semibold">{template.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{template.disabledReason || template.description}</p>
                </button>
              ))}
            </div>

            {selected && (
              <div className="rounded-lg border bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold">{selected.title}</p>
                    <Badge variant="outline" className="mt-1 capitalize">{selected.category}</Badge>
                  </div>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    disabled={!selected.enabled || sendMutation.isPending}
                    onClick={() => sendMutation.mutate(selected)}
                  >
                    <Send className="h-4 w-4 mr-2" />{sendMutation.isPending ? 'Sending...' : 'Send Now'}
                  </Button>
                </div>
                <FormSubmitStatus status={sendMutation.isPending ? 'loading' : sendMutation.isSuccess ? 'success' : 'idle'} successMessage="Message sent" />
                <pre className="whitespace-pre-wrap text-sm font-sans text-gray-700 max-h-52 overflow-y-auto">{selected.content}</pre>
                {!selected.enabled && <p className="text-xs text-red-600 mt-2">{selected.disabledReason}</p>}
              </div>
            )}
          </>
        )}

        <div>
          <Label className="text-xs text-gray-500">Recent messages</Label>
          {history.length === 0 ? <p className="text-sm text-gray-500 mt-1">No customer messages sent yet.</p> : (
            <div className="mt-2 divide-y border rounded-lg max-h-40 overflow-y-auto">
              {history.slice(0, 6).map((message: any) => (
                <div key={message._id} className="p-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="capitalize truncate">{message.messageType?.replace(/^customer_/, '').replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">{new Date(message.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                  <span className={message.status === 'sent' ? 'text-green-600' : 'text-red-600'}>
                    {message.status === 'sent' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
