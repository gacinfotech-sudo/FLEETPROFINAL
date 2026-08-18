// Notification Preferences API Endpoints
import express, { Request, Response } from 'express';
import { notificationPreferenceManager, NotificationPreference, NotificationChannel } from '../utils/notificationPreferences';
import { createLogger } from '../utils/logger';
import { authenticateUser } from '../middleware/auth';

const log = createLogger('NotificationPreferencesAPI');
const router = express.Router();

// GET /api/notification-preferences/:userId
// Fetch user's notification preferences
router.get('/:userId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = (req as any).userId;

    // Only allow users to fetch their own preferences
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own notification preferences'
      });
    }

    const preferences = await notificationPreferenceManager.getPreferences(userId);

    res.json({
      success: true,
      preferences
    });

    log.info('Preferences fetched', { userId });
  } catch (error) {
    log.error('Failed to fetch preferences', { error });
    res.status(500).json({
      error: 'Failed to fetch preferences',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/notification-preferences/:userId
// Update user's notification preferences
router.put('/:userId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = (req as any).userId;

    // Only allow users to update their own preferences
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own notification preferences'
      });
    }

    const preferences = req.body as Partial<NotificationPreference>;

    // Validate preference data
    if (preferences.globalEnabled !== undefined && typeof preferences.globalEnabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'globalEnabled must be a boolean'
      });
    }

    if (preferences.globalChannels !== undefined && !Array.isArray(preferences.globalChannels)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'globalChannels must be an array'
      });
    }

    if (preferences.quietHoursEnabled !== undefined && typeof preferences.quietHoursEnabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'quietHoursEnabled must be a boolean'
      });
    }

    if (preferences.quietHoursStart && !/^\d{2}:\d{2}$/.test(preferences.quietHoursStart)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'quietHoursStart must be in HH:MM format'
      });
    }

    if (preferences.quietHoursEnd && !/^\d{2}:\d{2}$/.test(preferences.quietHoursEnd)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'quietHoursEnd must be in HH:MM format'
      });
    }

    if (preferences.dailyFrequencyCap !== undefined && typeof preferences.dailyFrequencyCap !== 'number') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'dailyFrequencyCap must be a number'
      });
    }

    if (preferences.hourlyFrequencyCap !== undefined && typeof preferences.hourlyFrequencyCap !== 'number') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'hourlyFrequencyCap must be a number'
      });
    }

    await notificationPreferenceManager.setPreferences(userId, preferences);

    const updatedPreferences = await notificationPreferenceManager.getPreferences(userId);

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: updatedPreferences
    });

    log.info('Preferences updated', { userId });
  } catch (error) {
    log.error('Failed to update preferences', { error });
    res.status(500).json({
      error: 'Failed to update preferences',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/notification-preferences/:userId/reset-defaults
// Reset user's preferences to defaults
router.post('/:userId/reset-defaults', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = (req as any).userId;

    // Only allow users to reset their own preferences
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only reset your own notification preferences'
      });
    }

    await notificationPreferenceManager.resetToDefaults(userId);

    const preferences = await notificationPreferenceManager.getPreferences(userId);

    res.json({
      success: true,
      message: 'Preferences reset to defaults',
      preferences
    });

    log.info('Preferences reset to defaults', { userId });
  } catch (error) {
    log.error('Failed to reset preferences', { error });
    res.status(500).json({
      error: 'Failed to reset preferences',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/notification-preferences/:userId/quiet-hours
// Update quiet hours settings
router.put('/:userId/quiet-hours', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = (req as any).userId;

    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own settings'
      });
    }

    const { start, end, timezone, enabled } = req.body;

    if (enabled === false) {
      await notificationPreferenceManager.disableQuietHours(userId);
    } else if (typeof start === 'string' && typeof end === 'string') {
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        return res.status(400).json({
          error: 'Invalid input',
          message: 'start and end must be in HH:MM format'
        });
      }
      await notificationPreferenceManager.setQuietHours(userId, start, end, timezone || 'UTC');
    } else {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Provide start and end times in HH:MM format, or set enabled to false'
      });
    }

    const preferences = await notificationPreferenceManager.getPreferences(userId);

    res.json({
      success: true,
      message: 'Quiet hours updated',
      preferences
    });

    log.info('Quiet hours updated', { userId });
  } catch (error) {
    log.error('Failed to update quiet hours', { error });
    res.status(500).json({
      error: 'Failed to update quiet hours',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/notification-preferences/:userId/category/:category
// Update preferences for a specific notification category
router.put('/:userId/category/:category', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { userId, category } = req.params;
    const authenticatedUserId = (req as any).userId;

    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own settings'
      });
    }

    const { enabled, channels } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'enabled must be a boolean'
      });
    }

    if (!Array.isArray(channels)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'channels must be an array'
      });
    }

    await notificationPreferenceManager.setCategoryPreference(userId, category, {
      enabled,
      channels: channels as NotificationChannel[]
    });

    const preferences = await notificationPreferenceManager.getPreferences(userId);

    res.json({
      success: true,
      message: `Category preference for ${category} updated`,
      preferences
    });

    log.info('Category preference updated', { userId, category });
  } catch (error) {
    log.error('Failed to update category preference', { error });
    res.status(500).json({
      error: 'Failed to update category preference',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/notification-preferences/:userId/frequency-caps
// Update frequency cap settings
router.put('/:userId/frequency-caps', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = (req as any).userId;

    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own settings'
      });
    }

    const { dailyCap, hourlyCap } = req.body;

    if (dailyCap !== undefined && typeof dailyCap !== 'number') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'dailyCap must be a number'
      });
    }

    if (hourlyCap !== undefined && typeof hourlyCap !== 'number') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'hourlyCap must be a number'
      });
    }

    await notificationPreferenceManager.setFrequencyCaps(userId, dailyCap, hourlyCap);

    const preferences = await notificationPreferenceManager.getPreferences(userId);

    res.json({
      success: true,
      message: 'Frequency caps updated',
      preferences
    });

    log.info('Frequency caps updated', { userId });
  } catch (error) {
    log.error('Failed to update frequency caps', { error });
    res.status(500).json({
      error: 'Failed to update frequency caps',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/notification-preferences/:userId/unsubscribe/:category
// Unsubscribe from a specific category
router.post('/:userId/unsubscribe/:category', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { userId, category } = req.params;
    const authenticatedUserId = (req as any).userId;

    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own settings'
      });
    }

    await notificationPreferenceManager.unsubscribe(userId, category);

    const preferences = await notificationPreferenceManager.getPreferences(userId);

    res.json({
      success: true,
      message: `Unsubscribed from ${category}`,
      preferences
    });

    log.info('Unsubscribed from category', { userId, category });
  } catch (error) {
    log.error('Failed to unsubscribe', { error });
    res.status(500).json({
      error: 'Failed to unsubscribe',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/notification-preferences/:userId/resubscribe/:category
// Resubscribe to a specific category
router.post('/:userId/resubscribe/:category', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { userId, category } = req.params;
    const authenticatedUserId = (req as any).userId;

    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own settings'
      });
    }

    await notificationPreferenceManager.resubscribe(userId, category);

    const preferences = await notificationPreferenceManager.getPreferences(userId);

    res.json({
      success: true,
      message: `Resubscribed to ${category}`,
      preferences
    });

    log.info('Resubscribed to category', { userId, category });
  } catch (error) {
    log.error('Failed to resubscribe', { error });
    res.status(500).json({
      error: 'Failed to resubscribe',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
