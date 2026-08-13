/**
 * Salary Master Routes
 * ====================
 * API endpoints for salary master CRUD + versioning operations
 */

import { Router, Request, Response } from 'express';
import {
  createSalaryMaster,
  createOrUpdateSalaryMaster,
  getSalaryMasterById,
  getSalaryMasterByDriver,
  listSalaryMasters,
  updateSalaryMaster,
  deleteSalaryMaster,
  updateSalaryMasterStatus,
  getSalaryMasterSummary,
  getBatchSalaryMasterSummaries,
  batchCreateSalaryMasters,
  batchUpdateSalaryMasters,
  calculateTotalSalary,
  exportSalaryMasterData,
  CreateSalaryMasterInput,
  UpdateSalaryMasterInput
} from '../services/driverSalaryMasterService';

import {
  compareVersions,
  getVersionHistory,
  getVersionSnapshot,
  getLatestVersionInfo,
  getChangeTimeline,
  getAuditLog,
  getChangesByUser,
  getChangesByType,
  getVersionStatistics,
  getFieldChangeHistory,
  exportVersionHistory,
  recordRollback
} from '../services/SalaryMasterVersionService';

const router = Router();

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Extract tenant ID from request context
 */
function getTenantId(req: Request): string {
  return (req as any).tenantId || (req.headers['x-tenant-id'] as string);
}

/**
 * Extract user ID from request context
 */
function getUserId(req: Request): string {
  return (req as any).userId || (req.headers['x-user-id'] as string) || 'anonymous';
}

/**
 * Error handling wrapper
 */
function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: Function) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * POST /api/salary-masters
 * Create a new salary master configuration
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { changeReason } = req.body;

    const input: CreateSalaryMasterInput = {
      tenantId,
      ...req.body
    };

    const { master, version } = await createSalaryMaster(input, userId, changeReason);

    res.status(201).json({
      success: true,
      data: {
        master,
        version
      },
      message: 'Salary master created successfully'
    });
  })
);

/**
 * GET /api/salary-masters/:driverId
 * Get salary master by driver ID
 */
router.get(
  '/driver/:driverId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { driverId } = req.params;

    const master = await getSalaryMasterByDriver(tenantId, driverId);

    if (!master) {
      return res.status(404).json({
        success: false,
        error: 'Salary master not found'
      });
    }

    res.json({
      success: true,
      data: master
    });
  })
);

/**
 * GET /api/salary-masters
 * List salary masters with filters
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { status, employmentType, salaryType, limit, skip } = req.query;

    const { data, total } = await listSalaryMasters(tenantId, {
      status: status as any,
      employmentType: employmentType as string,
      salaryType: salaryType as string,
      limit: limit ? parseInt(limit as string) : 50,
      skip: skip ? parseInt(skip as string) : 0
    });

    res.json({
      success: true,
      data,
      pagination: {
        total,
        limit: limit ? parseInt(limit as string) : 50,
        skip: skip ? parseInt(skip as string) : 0
      }
    });
  })
);

/**
 * PUT /api/salary-masters/:driverId
 * Update salary master configuration
 */
router.put(
  '/:driverId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { driverId } = req.params;
    const { changeReason, ...updateData } = req.body;

    const input: UpdateSalaryMasterInput = updateData;

    const { master, version } = await updateSalaryMaster(
      tenantId,
      driverId,
      input,
      userId,
      changeReason
    );

    res.json({
      success: true,
      data: {
        master,
        version
      },
      message: 'Salary master updated successfully'
    });
  })
);

/**
 * PATCH /api/salary-masters/:driverId/status
 * Update only status (quick update without versioning)
 */
router.patch(
  '/:driverId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { driverId } = req.params;
    const { status } = req.body;

    const master = await updateSalaryMasterStatus(tenantId, driverId, status);

    if (!master) {
      return res.status(404).json({
        success: false,
        error: 'Salary master not found'
      });
    }

    res.json({
      success: true,
      data: master,
      message: 'Status updated successfully'
    });
  })
);

/**
 * DELETE /api/salary-masters/:driverId
 * Delete (soft delete via status change)
 */
router.delete(
  '/:driverId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { driverId } = req.params;
    const { reason } = req.body;

    const version = await deleteSalaryMaster(tenantId, driverId, userId, reason);

    res.json({
      success: true,
      data: { version },
      message: 'Salary master deleted (soft delete)'
    });
  })
);

// ============================================================================
// SUMMARY & ANALYSIS
// ============================================================================

/**
 * GET /api/salary-masters/:driverId/summary
 * Get salary master summary with version info
 */
router.get(
  '/:driverId/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { driverId } = req.params;

    const summary = await getSalaryMasterSummary(tenantId, driverId);

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Salary master not found'
      });
    }

    res.json({
      success: true,
      data: summary
    });
  })
);

/**
 * POST /api/salary-masters/summaries/batch
 * Batch get summaries for multiple drivers
 */
router.post(
  '/summaries/batch',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { driverIds } = req.body;

    if (!Array.isArray(driverIds)) {
      return res.status(400).json({
        success: false,
        error: 'driverIds must be an array'
      });
    }

    const summaries = await getBatchSalaryMasterSummaries(tenantId, driverIds);

    res.json({
      success: true,
      data: summaries,
      count: summaries.length
    });
  })
);

/**
 * POST /api/salary-masters/export
 * Export salary master data
 */
router.post(
  '/export',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { status, employmentType } = req.body;

    const data = await exportSalaryMasterData(tenantId, {
      status,
      employmentType
    });

    res.json({
      success: true,
      data,
      count: data.length,
      exportedAt: new Date()
    });
  })
);

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * POST /api/salary-masters/batch/create
 * Batch create salary masters
 */
router.post(
  '/batch/create',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { inputs } = req.body;

    if (!Array.isArray(inputs)) {
      return res.status(400).json({
        success: false,
        error: 'inputs must be an array'
      });
    }

    // Add tenantId to each input
    const fullInputs = inputs.map(input => ({
      tenantId,
      ...input
    }));

    const { created, errors } = await batchCreateSalaryMasters(fullInputs, userId);

    res.status(errors.length > 0 ? 207 : 201).json({
      success: errors.length === 0,
      data: {
        created,
        errors
      },
      summary: {
        total: inputs.length,
        created: created.length,
        failed: errors.length
      }
    });
  })
);

/**
 * PUT /api/salary-masters/batch/update
 * Batch update salary masters
 */
router.put(
  '/batch/update',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'updates must be an array'
      });
    }

    const { updated, errors } = await batchUpdateSalaryMasters(
      updates.map(u => ({
        tenantId,
        ...u
      })),
      userId
    );

    res.status(errors.length > 0 ? 207 : 200).json({
      success: errors.length === 0,
      data: {
        updated,
        errors
      },
      summary: {
        total: updates.length,
        updated: updated.length,
        failed: errors.length
      }
    });
  })
);

// ============================================================================
// VERSIONING OPERATIONS
// ============================================================================

/**
 * GET /api/salary-masters/:driverId/versions
 * Get version history
 */
router.get(
  '/:driverId/versions',
  asyncHandler(async (req: Request, res: Response) => {
    const { driverId } = req.params;
    const { limit, skip } = req.query;

    const { versions, total } = await getVersionHistory(
      driverId,
      limit ? parseInt(limit as string) : 50,
      skip ? parseInt(skip as string) : 0
    );

    res.json({
      success: true,
      data: versions,
      pagination: {
        total,
        limit: limit ? parseInt(limit as string) : 50,
        skip: skip ? parseInt(skip as string) : 0
      }
    });
  })
);

/**
 * GET /api/salary-masters/:driverId/versions/:versionNumber
 * Get specific version
 */
router.get(
  '/:driverId/versions/:versionNumber',
  asyncHandler(async (req: Request, res: Response) => {
    const { driverId, versionNumber } = req.params;

    const version = await getVersionSnapshot(driverId, parseInt(versionNumber));

    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    res.json({
      success: true,
      data: version
    });
  })
);

/**
 * GET /api/salary-masters/:driverId/versions/latest
 * Get latest version info
 */
router.get(
  '/:driverId/versions/latest',
  asyncHandler(async (req: Request, res: Response) => {
    const { driverId } = req.params;

    const version = await getLatestVersionInfo(driverId);

    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'No versions found'
      });
    }

    res.json({
      success: true,
      data: version
    });
  })
);

/**
 * POST /api/salary-masters/:driverId/versions/compare
 * Compare two versions
 */
router.post(
  '/:driverId/versions/compare',
  asyncHandler(async (req: Request, res: Response) => {
    const { driverId } = req.params;
    const { version1, version2 } = req.body;

    if (!version1 || !version2) {
      return res.status(400).json({
        success: false,
        error: 'version1 and version2 are required'
      });
    }

    const comparison = await compareVersions(driverId, version1, version2);

    res.json({
      success: true,
      data: comparison
    });
  })
);

/**
 * GET /api/salary-masters/:driverId/timeline
 * Get change timeline
 */
router.get(
  '/:driverId/timeline',
  asyncHandler(async (req: Request, res: Response) => {
    const { driverId } = req.params;
    const { limit } = req.query;

    const timeline = await getChangeTimeline(driverId, limit ? parseInt(limit as string) : 50);

    res.json({
      success: true,
      data: timeline
    });
  })
);

/**
 * GET /api/salary-masters/:driverId/audit-log
 * Get audit log for date range
 */
router.get(
  '/:driverId/audit-log',
  asyncHandler(async (req: Request, res: Response) => {
    const { driverId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const logs = await getAuditLog(
      driverId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: logs,
      count: logs.length
    });
  })
);

/**
 * GET /api/salary-masters/:driverId/statistics
 * Get version statistics
 */
router.get(
  '/:driverId/statistics',
  asyncHandler(async (req: Request, res: Response) => {
    const { driverId } = req.params;

    const stats = await getVersionStatistics(driverId);

    res.json({
      success: true,
      data: stats
    });
  })
);

/**
 * GET /api/salary-masters/:driverId/field-history/:fieldName
 * Get change history for specific field
 */
router.get(
  '/:driverId/field-history/:fieldName',
  asyncHandler(async (req: Request, res: Response) => {
    const { driverId, fieldName } = req.params;

    const history = await getFieldChangeHistory(driverId, fieldName);

    res.json({
      success: true,
      data: history,
      count: history.length
    });
  })
);

/**
 * POST /api/salary-masters/:driverId/rollback
 * Rollback to previous version
 */
router.post(
  '/:driverId/rollback',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { driverId } = req.params;
    const { targetVersion, reason } = req.body;

    if (!targetVersion) {
      return res.status(400).json({
        success: false,
        error: 'targetVersion is required'
      });
    }

    // Get current salary master
    const master = await getSalaryMasterByDriver(tenantId, driverId);
    if (!master) {
      return res.status(404).json({
        success: false,
        error: 'Salary master not found'
      });
    }

    const rollbackVersion = await recordRollback(
      master._id.toString(),
      tenantId,
      driverId,
      targetVersion,
      master.toObject(),
      userId,
      reason
    );

    res.json({
      success: true,
      data: {
        rollbackVersion,
        message: `Rolled back to version ${targetVersion}`
      }
    });
  })
);

/**
 * GET /api/salary-masters/:driverId/export-history
 * Export version history
 */
router.get(
  '/:driverId/export-history',
  asyncHandler(async (req: Request, res: Response) => {
    const { driverId } = req.params;

    const { data, exportedAt } = await exportVersionHistory(driverId);

    res.json({
      success: true,
      data,
      exportedAt,
      count: data.length
    });
  })
);

// ============================================================================
// ERROR HANDLER
// ============================================================================

router.use((err: any, req: Request, res: Response, next: Function) => {
  console.error('Salary Master API Error:', err);

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

export default router;
