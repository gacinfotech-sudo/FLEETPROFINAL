// Notification Batch Processing API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationBatchProcessor } from '../utils/notificationBatchProcessor';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationBatchAPI');
const router = express.Router();

// POST /api/notification-batch/send
// Submit bulk send job (admin only)
router.post('/send', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { title, body, category, userIds, userFilter, channels, templateId, priority, metadata } =
      req.body;

    if (!title || !body || !category) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'title, body, and category are required'
      });
    }

    if (!userIds && !userFilter) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Either userIds array or userFilter query is required'
      });
    }

    const jobId = await notificationBatchProcessor.submitBulkSendJob(
      {
        title,
        body,
        category,
        userIds,
        userFilter,
        channels,
        templateId,
        priority,
        metadata
      },
      userId
    );

    log.info('Bulk send job submitted via API', { jobId });

    res.json({
      success: true,
      message: 'Bulk send job submitted',
      jobId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to submit bulk send job', { error });
    res.status(500).json({
      error: 'Failed to submit bulk send job',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-batch/jobs/:jobId
// Get job status (admin only)
router.get('/jobs/:jobId', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = await notificationBatchProcessor.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Batch job not found'
      });
    }

    const successRate =
      job.totalItems > 0
        ? ((job.successCount / job.totalItems) * 100).toFixed(2)
        : '0';

    log.info('Job status retrieved', { jobId, status: job.status });

    res.json({
      success: true,
      job: {
        jobId: job.jobId,
        status: job.status,
        totalItems: job.totalItems,
        processedItems: job.processedItems,
        successCount: job.successCount,
        failureCount: job.failureCount,
        successRate,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        estimatedDuration: job.estimatedDuration
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get job status', { error });
    res.status(500).json({
      error: 'Failed to retrieve job status',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-batch/jobs
// List batch jobs (admin only)
router.get('/jobs', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;

    const jobLimit = Math.min(parseInt(limit as string) || 50, 500);
    const jobs = await notificationBatchProcessor.listJobs(status as string, jobLimit);

    log.info('Batch jobs listed', { count: jobs.length });

    res.json({
      success: true,
      jobs: jobs.map(job => ({
        jobId: job.jobId,
        status: job.status,
        totalItems: job.totalItems,
        processedItems: job.processedItems,
        successCount: job.successCount,
        failureCount: job.failureCount,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      })),
      count: jobs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to list batch jobs', { error });
    res.status(500).json({
      error: 'Failed to list batch jobs',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-batch/jobs/:jobId/cancel
// Cancel batch job (admin only)
router.post(
  '/jobs/:jobId/cancel',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      const success = await notificationBatchProcessor.cancelJob(jobId);

      if (!success) {
        return res.status(404).json({
          error: 'Not found or already completed',
          message: 'Job cannot be cancelled'
        });
      }

      log.info('Batch job cancelled via API', { jobId });

      res.json({
        success: true,
        message: 'Batch job cancelled successfully',
        jobId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to cancel batch job', { error });
      res.status(500).json({
        error: 'Failed to cancel batch job',
        message: (error as Error).message
      });
    }
  }
);

// GET /api/notification-batch/stats
// Get batch processing statistics (admin only)
router.get('/stats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await notificationBatchProcessor.getBatchStats();

    log.info('Batch statistics retrieved');

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get batch stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve batch statistics',
      message: (error as Error).message
    });
  }
});

export default router;
