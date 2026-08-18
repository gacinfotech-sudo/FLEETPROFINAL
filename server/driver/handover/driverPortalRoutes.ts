// The ONE new driver-portal-reachable route this task adds — see this task's
// report for the exact proposed server/routes.ts patch and its coordination
// with TASK-DRIVER-QA-SECURITY-07's allow-list test.
//
// This file deliberately does NOT call `app.post(...)` itself. Every other
// module in this initiative (GPS, driver/domain, driver/documents) mounts
// its own routes directly via `app.<method>` inside its own `registerXRoutes`
// file — but TASK-DRIVER-QA-SECURITY-07's allow-list-completeness test
// currently greps literal `app.<method>(...)` text out of server/routes.ts
// itself (see that task's report, "Driver-portal route-enumeration test").
// Registering this single highest-scrutiny route as an inline
// `app.post("/api/driver-portal/handovers/:id/accept", authenticateDriver, acceptHandoverHandler)`
// line INSIDE the proposed server/routes.ts patch (importing only the
// handler function from here) keeps it visible to that grep exactly like the
// existing 4 driver-portal routes, rather than hiding it inside a
// sub-module the way this task's own staff routes are mounted. See
// routes.ts's proposed patch in the task report.
import type { Response } from 'express';
import type { DriverAuthRequest } from '../../middleware/driverAuth';
import { acceptHandoverAsDriver, listPendingHandoversForDriver, HandoverNotFoundError } from './handoverService';
import { driverPortalHandoverSummary } from './serialization';

export async function acceptHandoverHandler(req: DriverAuthRequest, res: Response): Promise<void> {
  try {
    const handover = await acceptHandoverAsDriver({
      tenantId: String(req.driver.tenantId),
      driverId: req.driverId!,
      handoverId: req.params.id,
    });
    res.json(driverPortalHandoverSummary(handover));
  } catch (error: any) {
    if (error instanceof HandoverNotFoundError) {
      res.status(404).json({ message: 'Handover not found.' });
      return;
    }
    console.error('Accept handover error:', error?.message || error);
    res.status(500).json({ message: 'Failed to accept handover.' });
  }
}

/** Called from the proposed GET /api/driver-portal/me patch (see report) —
 * NOT a new route itself, just a data addition to an existing allow-listed
 * one, so this task's allow-list footprint stays at exactly one new row. */
export async function getPendingHandoversForDriverPortal(tenantId: string, driverId: string) {
  const pending = await listPendingHandoversForDriver(tenantId, driverId);
  return pending.map(driverPortalHandoverSummary);
}
