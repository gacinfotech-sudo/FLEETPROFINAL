import type { Express, NextFunction, Response } from 'express';
import type { Request } from 'express';
import { telephonyProvider } from '../providers/registry';
import { publicCallSession, resolveInboundEvent } from '../services/callService';

function safeAsync(handler: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function registerTelephonyWebhookRoutes(app: Express): void {
  // Intentionally NOT behind authenticateUser/requireTenant — this is the
  // provider calling us, not a logged-in user. Trust is established by
  // verifyWebhookSignature() below (same contract as
  // GpsProviderAdapter.verifyWebhookSignature), not by session/cookie.
  //
  // KNOWN LIMITATION (documented, not silently papered over): true
  // byte-exact signature verification needs the *raw* request body, but
  // server/index.ts (protected/Integrator-owned — see "Files forbidden to
  // modify") already applies `express.json()` globally before routes are
  // registered, so `req.body` here is already-parsed JSON, not a Buffer.
  // This route re-serializes req.body as a stand-in for the raw bytes,
  // which is NOT safe for a provider that signs the literal wire bytes
  // (whitespace/key-order sensitive). TASK-02-report.md's WebSocket
  // bootstrap section also flags the one-line raw-body-capture fix
  // (`express.json({ verify: (req, res, buf) => { (req as any).rawBody =
  // buf } })`) for the Integrator to apply alongside the other deferred
  // server/index.ts changes; once that lands, swap the Buffer.from() below
  // for `(req as any).rawBody`.
  app.post(
    '/api/telephony/webhook',
    safeAsync(async (req, res) => {
      const rawBody = Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers[key] = value;
      }

      const verified = await telephonyProvider.verifyWebhookSignature(headers, rawBody);
      if (!verified) {
        return res.status(401).json({ message: 'Invalid webhook signature.' });
      }

      const event = await telephonyProvider.parseWebhookEvent(rawBody);
      const call = await resolveInboundEvent(event);
      if (!call) {
        // Unrecognized virtual number / unresolvable tenant — acknowledge
        // with 200 so the provider doesn't retry-storm us, but do not
        // pretend a CallSession was created.
        return res.status(200).json({ received: true, resolved: false });
      }
      res.status(200).json({ received: true, resolved: true, callSession: publicCallSession(call) });
    }),
  );
}
