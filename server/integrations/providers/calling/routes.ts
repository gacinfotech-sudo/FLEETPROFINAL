/**
 * Calling Provider API Routes
 * REST endpoints for placing calls, checking status, managing forwarding, etc.
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { callingProvider, getCallLogger } from './index';
import { CallingWebhookHandler } from './WebhookHandler';

const router = Router();
const callLogger = getCallLogger();
const webhookHandler = new CallingWebhookHandler(callingProvider);

/**
 * Test provider connection
 * POST /api/calling/test-connection
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { credentials } = req.body;

    if (!credentials) {
      return res.status(400).json({ error: 'Credentials required' });
    }

    const result = await callingProvider.testConnection(credentials);
    res.json(result);
  } catch (error) {
    console.error('[calling:routes] Error testing connection:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Place outbound call
 * POST /api/calling/calls
 */
router.post('/calls', async (req: Request, res: Response) => {
  try {
    const { tenantId, fromNumber, toNumber, agentId, options } = req.body;

    if (!tenantId || !fromNumber || !toNumber) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, fromNumber, toNumber',
      });
    }

    const result = await callingProvider.placeCall({
      tenantId,
      fromNumber,
      toNumber,
      agentId,
      options,
    });

    // Log the call initiation
    callLogger.logOutboundCallInitiation({
      callId: result.providerCallId,
      tenantId,
      fromNumber,
      toNumber,
      agentId,
      tags: options?.tags,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('[calling:routes] Error placing call:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Get call details
 * GET /api/calling/calls/:callId
 */
router.get('/calls/:callId', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    const details = await callingProvider.getCallDetails(callId);
    res.json(details);
  } catch (error) {
    console.error('[calling:routes] Error getting call details:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * End a call
 * DELETE /api/calling/calls/:callId
 */
router.delete('/calls/:callId', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const { reason } = req.body;

    await callingProvider.endCall(callId, reason);
    res.json({ success: true, message: `Call ${callId} ended` });
  } catch (error) {
    console.error('[calling:routes] Error ending call:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Transfer a call
 * POST /api/calling/calls/:callId/transfer
 */
router.post('/calls/:callId/transfer', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const { toNumber, transferType } = req.body;

    if (!toNumber) {
      return res.status(400).json({ error: 'toNumber is required' });
    }

    const result = await callingProvider.transferCall(callId, toNumber, transferType);
    res.json(result);
  } catch (error) {
    console.error('[calling:routes] Error transferring call:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Get recording URL
 * GET /api/calling/calls/:callId/recording
 */
router.get('/calls/:callId/recording', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    const recordingUrl = await callingProvider.getRecordingUrl(callId);
    if (!recordingUrl) {
      return res.status(404).json({ error: 'No recording found' });
    }

    res.json({ recordingUrl });
  } catch (error) {
    console.error('[calling:routes] Error getting recording:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Set up call forwarding
 * POST /api/calling/forwarding
 */
router.post('/forwarding', async (req: Request, res: Response) => {
  try {
    const { id, fromNumber, toNumber, enabled } = req.body;

    if (!id || !fromNumber || !toNumber) {
      return res.status(400).json({
        error: 'Missing required fields: id, fromNumber, toNumber',
      });
    }

    const rule = {
      id,
      fromNumber,
      toNumber,
      enabled: enabled !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await callingProvider.setupForwarding(rule);
    res.status(201).json({ success: true, rule });
  } catch (error) {
    console.error('[calling:routes] Error setting up forwarding:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Remove call forwarding
 * DELETE /api/calling/forwarding/:ruleId
 */
router.delete('/forwarding/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;

    await callingProvider.removeForwarding(ruleId);
    res.json({ success: true, message: `Forwarding rule ${ruleId} removed` });
  } catch (error) {
    console.error('[calling:routes] Error removing forwarding:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Webhook endpoint for incoming calls and status updates
 * POST /api/calling/webhooks
 */
router.post('/webhooks', (req: Request, res: Response) => {
  webhookHandler.handleWebhook(req, res);
});

/**
 * Get CDR records for tenant
 * GET /api/calling/cdr/:tenantId
 */
router.get('/cdr/:tenantId', (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { limit, format } = req.query;

    const records = callLogger.getCDRRecordsByTenant(
      tenantId,
      limit ? parseInt(limit as string) : undefined,
    );

    if (format === 'csv') {
      const csv = callLogger.exportCDRAsCSV(tenantId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="cdr-${tenantId}.csv"`);
      res.send(csv);
    } else {
      res.json(records);
    }
  } catch (error) {
    console.error('[calling:routes] Error fetching CDR:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Get call statistics for tenant
 * GET /api/calling/stats/:tenantId
 */
router.get('/stats/:tenantId', (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const stats = callLogger.getCallStats(tenantId);
    res.json(stats);
  } catch (error) {
    console.error('[calling:routes] Error fetching stats:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Get CDR records by date range
 * GET /api/calling/cdr/:tenantId/range
 */
router.get('/cdr/:tenantId/range', (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required query params: startDate, endDate',
      });
    }

    const records = callLogger.getCDRRecordsByDateRange(
      tenantId,
      new Date(startDate as string),
      new Date(endDate as string),
    );

    res.json(records);
  } catch (error) {
    console.error('[calling:routes] Error fetching CDR by date range:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Get call events
 * GET /api/calling/events/:callId
 */
router.get('/events/:callId', (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    const events = callLogger.getCallEvents(callId);
    res.json(events);
  } catch (error) {
    console.error('[calling:routes] Error fetching events:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Register webhook event handler
 * POST /api/calling/webhook-handlers/:eventType
 */
router.post('/webhook-handlers/:eventType', (req: Request, res: Response) => {
  try {
    const { eventType } = req.params;
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'webhookUrl is required' });
    }

    // Register handler that forwards to webhookUrl
    webhookHandler.on(eventType, async (payload) => {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error('[calling:routes] Error forwarding webhook:', error);
      }
    });

    res.json({ success: true, message: `Registered handler for ${eventType}` });
  } catch (error) {
    console.error('[calling:routes] Error registering webhook handler:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Get webhook retry stats
 * GET /api/calling/webhook-stats
 */
router.get('/webhook-stats', (req: Request, res: Response) => {
  try {
    const stats = webhookHandler.getRetryStats();
    res.json(stats);
  } catch (error) {
    console.error('[calling:routes] Error fetching webhook stats:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

/**
 * Get call rate limit stats
 * GET /api/calling/rate-limits
 */
router.get('/rate-limits', (req: Request, res: Response) => {
  try {
    const stats = (callingProvider as any).getRateLimitStats?.();
    res.json(stats || {});
  } catch (error) {
    console.error('[calling:routes] Error fetching rate limit stats:', error);
    res.status(500).json({ error: (error as any).message });
  }
});

export default router;
