import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MessageCircle, LogOut, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

type SessionStatus = "disconnected" | "qr_pending" | "connected" | "logged_out";

export default function WhatsAppPanel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === "admin" || user?.role === "client";
  const [polling, setPolling] = useState(false);

  const statusQuery = useQuery<{ provider: string; status: SessionStatus; qrDataUrl?: string }>({
    queryKey: ["/api/whatsapp/session/status"],
    refetchInterval: polling ? 3000 : false,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/session/start");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/whatsapp/session/status"], data);
      if (data.status === "qr_pending" || data.status === "disconnected") {
        setPolling(true);
      }
      if (data.status === "connected") {
        toast({ title: "WhatsApp already connected" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Could not start WhatsApp session", description: err.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/session/logout");
      return res.json();
    },
    onSuccess: () => {
      setPolling(false);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/session/status"] });
      toast({ title: "WhatsApp session logged out" });
    },
  });

  const status = statusQuery.data?.status || "disconnected";

  // Stop polling once connected — no reason to keep hitting the endpoint
  // every 3s forever, that's exactly the "repeated API request" pattern
  // the spec calls out to avoid.
  useEffect(() => {
    if (status === "connected" && polling) {
      setPolling(false);
    }
  }, [status, polling]);

  // Auto-start the session as soon as we know it's not already running —
  // requiring a manual "Connect" click before any QR appears is exactly
  // the confusing dead-end that made this look broken.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    if (statusQuery.isLoading || !canManage) return;
    if (status === "disconnected") {
      autoStarted.current = true;
      startMutation.mutate();
    }
  }, [status, statusQuery.isLoading, canManage]);

  if (!canManage) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access restricted</AlertTitle>
        <AlertDescription>Only the account owner or an admin can manage the WhatsApp connection.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Beautiful Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">💬 WhatsApp Integration</h1>
        <p className="text-green-100 mt-1">Link your business number • Send messages to customers</p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Unofficial connection</AlertTitle>
        <AlertDescription>
          This links your real WhatsApp number via the same protocol as WhatsApp Web — it is not the official
          Meta Business API and is not sanctioned by WhatsApp. There is a real risk of the number being
          restricted. Use a dedicated business number, not a personal one, if possible.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Connection status
          </CardTitle>
          <CardDescription>Provider: {statusQuery.data?.provider || "-"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {status === "connected" && <Badge className="bg-green-600">Connected</Badge>}
            {status === "qr_pending" && <Badge variant="secondary">Waiting for scan</Badge>}
            {status === "disconnected" && <Badge variant="outline">Disconnected</Badge>}
            {status === "logged_out" && <Badge variant="destructive">Logged out</Badge>}
          </div>

          {status === "qr_pending" && statusQuery.data?.qrDataUrl && (
            <div className="flex flex-col items-center gap-2 py-4">
              <img src={statusQuery.data.qrDataUrl} alt="WhatsApp QR code" className="w-56 h-56 border rounded-lg" />
              <p className="text-xs text-gray-500">QR refreshes automatically until scanned.</p>
            </div>
          )}

          {status === "connected" && (
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              WhatsApp is linked and ready to send messages for this business.
            </div>
          )}

          <div className="flex gap-2">
            {status !== "connected" && (
              <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                <RefreshCw className={`w-4 h-4 mr-2 ${startMutation.isPending ? "animate-spin" : ""}`} />
                {status === "qr_pending" ? "Refresh QR" : "Connect WhatsApp"}
              </Button>
            )}
            {(status === "connected" || status === "qr_pending") && (
              <Button variant="outline" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
