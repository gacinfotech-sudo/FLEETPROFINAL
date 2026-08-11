// The backend (server/whatsapp/baileysProvider.ts) returns this exact
// substring whenever a tenant hasn't linked/connected their WhatsApp
// session — a configuration gap, not a real send failure. Every WhatsApp
// send error handler in the app should distinguish this case from a
// genuine failure (invalid number, provider outage, etc.) so the user sees
// "go connect WhatsApp" instead of a generic, unactionable error toast.
// Message shape varies by caller: some throw the raw `{status}: {body}`
// text (apiRequest's default), others throw just the parsed message —
// a substring check is robust to both.
export function isWhatsAppNotConnectedError(message: string | undefined): boolean {
  return !!message && message.includes('WhatsApp session not connected');
}

export function whatsappErrorToast(message: string | undefined) {
  if (isWhatsAppNotConnectedError(message)) {
    return {
      title: "WhatsApp Not Connected — Configuration Required",
      description: "This tenant hasn't linked a WhatsApp session yet. Go to WhatsApp Settings to connect it, then try sending again.",
      variant: "destructive" as const,
    };
  }
  return {
    title: "Could not send message",
    description: message,
    variant: "destructive" as const,
  };
}
