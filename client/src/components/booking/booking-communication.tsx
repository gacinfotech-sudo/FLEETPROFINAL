import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MessageCircle, Send, History, AlertTriangle, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { whatsappErrorToast } from "@/lib/whatsapp-error";
import DutySlip from "./duty-slip";

type MessageType = "booking_confirmation" | "driver_duty";

interface Props {
  booking: any;
}

async function downloadDutySlip(booking: any, companyName: string, companyPhone: string | undefined, variant: "office" | "driver") {
  const html2pdf = (await import("html2pdf.js")).default;
  const { createRoot } = await import("react-dom/client");

  const tempDiv = document.createElement("div");
  tempDiv.style.position = "absolute";
  tempDiv.style.left = "-9999px";
  document.body.appendChild(tempDiv);

  const root = createRoot(tempDiv);
  await new Promise<void>((resolve) => {
    root.render(<DutySlip booking={booking} companyName={companyName} companyPhone={companyPhone} variant={variant} />);
    setTimeout(async () => {
      const element = tempDiv.querySelector("#duty-slip-pdf");
      if (element) {
        await html2pdf()
          .set({
            margin: 0.5,
            filename: `Duty_Slip_${variant}_${booking.bookingId}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
          })
          .from(element)
          .save();
      }
      root.unmount();
      document.body.removeChild(tempDiv);
      resolve();
    }, 100);
  });
}

export default function BookingCommunication({ booking }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [previewType, setPreviewType] = useState<MessageType | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [downloadingSlip, setDownloadingSlip] = useState<"office" | "driver" | null>(null);

  const companyName = (user?.tenantId as any)?.businessName || (user?.tenantId as any)?.name || "FleetPro";
  const companyPhone = (user?.tenantId as any)?.phone;

  const handleDownloadSlip = async (variant: "office" | "driver") => {
    setDownloadingSlip(variant);
    try {
      await downloadDutySlip(booking, companyName, companyPhone, variant);
    } catch (err: any) {
      toast({ title: "Could not generate duty slip", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingSlip(null);
    }
  };
  const [confirmResend, setConfirmResend] = useState<{ type: MessageType } | null>(null);

  const messagesQuery = useQuery({
    queryKey: [`/api/bookings/${booking._id || booking.id}/whatsapp/messages`],
    enabled: !!(booking._id || booking.id),
  });

  const openPreview = async (type: MessageType) => {
    try {
      const res = await apiRequest("GET", `/api/bookings/${booking._id || booking.id}/whatsapp/preview?type=${type}`);
      const data = await res.json();
      setPreviewType(type);
      setPreviewData(data);
    } catch (err: any) {
      toast({ title: "Could not build message preview", description: err.message, variant: "destructive" });
    }
  };

  const sendMutation = useMutation({
    mutationFn: async ({ type, force }: { type: MessageType; force?: boolean }) => {
      const res = await apiRequest("POST", `/api/bookings/${booking._id || booking.id}/whatsapp/send`, { messageType: type, force });
      const data = await res.json();
      if (!res.ok) {
        const err: any = new Error(data.message || "Send failed");
        err.status = res.status;
        err.alreadySent = data.alreadySent;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bookings/${booking._id || booking.id}/whatsapp/messages`] });
      setPreviewType(null);
      setPreviewData(null);
      toast({ title: "Message sent" });
    },
    onError: (err: any) => {
      if (err.alreadySent) {
        setConfirmResend({ type: previewType! });
        setPreviewType(null);
        setPreviewData(null);
        return;
      }
      toast(whatsappErrorToast(err.message));
    },
  });

  const messages: any[] = (messagesQuery.data as any[]) || [];

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 font-medium text-gray-900">
        <MessageCircle className="w-4 h-4" />
        Booking Communication
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => openPreview("booking_confirmation")}>
          Send Booking Confirmation
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!booking.driverId}
          title={!booking.driverId ? "Assign a driver first" : ""}
          onClick={() => openPreview("driver_duty")}
        >
          Send Driver Details
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={downloadingSlip === "office"}
          onClick={() => handleDownloadSlip("office")}
        >
          <FileDown className="w-3.5 h-3.5 mr-1" />
          {downloadingSlip === "office" ? "Generating..." : "Office Duty Slip"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={downloadingSlip === "driver"}
          onClick={() => handleDownloadSlip("driver")}
        >
          <FileDown className="w-3.5 h-3.5 mr-1" />
          {downloadingSlip === "driver" ? "Generating..." : "Driver Duty Slip"}
        </Button>
      </div>

      {messages.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <History className="w-3.5 h-3.5" />
            Message history
          </div>
          <div className="space-y-1">
            {messages.map((m) => (
              <div key={m._id} className="flex items-center justify-between text-sm border-b pb-1">
                <span>{m.messageType === "booking_confirmation" ? "Booking Confirmation" : "Driver Duty"} → {m.recipientType}</span>
                <div className="flex items-center gap-2">
                  {m.status === "sent" && <Badge className="bg-green-600">Sent</Badge>}
                  {m.status === "failed" && <Badge variant="destructive" title={m.error}>Failed</Badge>}
                  {m.status === "queued" && <Badge variant="secondary">Queued</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview & Send dialog */}
      <Dialog open={!!previewType} onOpenChange={(open) => { if (!open) { setPreviewType(null); setPreviewData(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {previewType === "booking_confirmation" ? "Send Booking Confirmation" : "Send Driver Details"}
            </DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                To: <span className="font-medium text-gray-900">{previewData.recipientName}</span> ({previewData.recipientPhone})
              </div>
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 border rounded-md p-3 max-h-80 overflow-y-auto font-sans">
                {previewData.content}
              </pre>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPreviewType(null); setPreviewData(null); }}>Cancel</Button>
            <Button
              onClick={() => previewType && sendMutation.mutate({ type: previewType })}
              disabled={sendMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              {sendMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate-send confirmation */}
      <Dialog open={!!confirmResend} onOpenChange={(open) => { if (!open) setConfirmResend(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Already sent
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This {confirmResend?.type === "booking_confirmation" ? "booking confirmation" : "driver duty message"} was already sent for the current booking details. Send again?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmResend(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (confirmResend) sendMutation.mutate({ type: confirmResend.type, force: true });
                setConfirmResend(null);
              }}
            >
              Send Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
