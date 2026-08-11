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
  // Byte-exact signature verification needs the *raw* request body.
  // server/index.ts's `express.json({ verify: ... })` (Integrator addition,
  // see .claude/tasks/reports/TASK-02-report.md's WebSocket bootstrap
  // section) captures the exact wire bytes into req.rawBody alongside the
  // parsed req.body, so this no longer relies on re-serializing req.body
  // (which was not safe for a provider that signs literal wire bytes —
  // whitespace/key-order sensitive).
  app.post(
    '/api/telephony/webhook',
    safeAsync(async (req, res) => {
      const rawBody = (req as any).rawBody instanceof Buffer
        ? (req as any).rawBody as Buffer
        : Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
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
