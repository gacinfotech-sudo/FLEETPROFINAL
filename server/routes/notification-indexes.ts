// Notification Index Management API (Admin Only)
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationIndexManager } from '../utils/notificationIndexes';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationIndexesAPI');
const router = express.Router();

// GET /api/notification-indexes/stats
// Get index statistics and status
router.get('/stats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await notificationIndexManager.getIndexStats();

    log.info('Index statistics retrieved');

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get index stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve index statistics',
      message: (error as Error).message,
    });
  }
});

// GET /api/notification-indexes/:collectionName
// Get indexes for a specific collection
router.get(
  '/:collectionName',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { collectionName } = req.params;

      if (!['scheduled_notifications', 'notification_logs'].includes(collectionName)) {
        return res.status(400).json({
          error: 'Invalid collection',
          message: 'Collection must be scheduled_notifications or notification_logs',
        });
      }

      const indexes = await notificationIndexManager.getIndexes(collectionName);

      log.info('Indexes retrieved', { collection: collectionName, count: indexes.length });

      res.json({
        success: true,
        collection: collectionName,
        indexes: indexes.map(idx => ({
          name: idx.name,
          keys: idx.key,
          unique: idx.unique || false,
          sparse: idx.sparse || false,
          expireAfterSeconds: idx.expireAfterSeconds
        })),
        count: indexes.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Failed to get indexes', { error });
      res.status(500).json({
        error: 'Failed to retrieve indexes',
        message: (error as Error).message,
      });
    }
  }
);

// POST /api/notification-indexes/rebuild
// Rebuild all notification system indexes
router.post(
  '/rebuild',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      log.info('Starting index rebuild');

      await notificationIndexManager.rebuildIndexes();

      log.info('Indexes rebuilt successfully');

      const stats = await notificationIndexManager.getIndexStats();

      res.json({
        success: true,
        message: 'All notification indexes rebuilt successfully',
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Failed to rebuild indexes', { error });
      res.status(500).json({
        error: 'Failed to rebuild indexes',
        message: (error as Error).message,
      });
    }
  }
);

// POST /api/notification-indexes/ensure
// Ensure all required indexes exist
router.post(
  '/ensure',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      log.info('Starting index verification');

      await notificationIndexManager.ensureIndexes();

      log.info('Indexes verified successfully');

      const stats = await notificationIndexManager.getIndexStats();

      res.json({
        success: true,
        message: 'All required notification indexes verified',
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Failed to verify indexes', { error });
      res.status(500).json({
        error: 'Failed to verify indexes',
        message: (error as Error).message,
      });
    }
  }
);

// DELETE /api/notification-indexes/drop/:collectionName/:indexName
// Drop a specific index (use with caution)
router.delete(
  '/drop/:collectionName/:indexName',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { collectionName, indexName } = req.params;

      if (!['scheduled_notifications', 'notification_logs'].includes(collectionName)) {
        return res.status(400).json({
          error: 'Invalid collection',
          message: 'Collection must be scheduled_notifications or notification_logs',
        });
      }

      if (indexName === '_id_') {
        return res.status(400).json({
          error: 'Cannot drop _id index',
          message: 'The _id index cannot be dropped',
        });
      }

      log.warn('Dropping index', { collection: collectionName, index: indexName });

      await notificationIndexManager.dropIndex(collectionName, indexName);

      res.json({
        success: true,
        message: `Index ${indexName} dropped from ${collectionName}`,
        collection: collectionName,
        index: indexName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Failed to drop index', { error });
      res.status(500).json({
        error: 'Failed to drop index',
        message: (error as Error).message,
      });
    }
  }
);

export default router;
