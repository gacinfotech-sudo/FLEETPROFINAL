// Notification Preferences API
import express, { Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { notificationPreferenceManager, NotificationChannel } from '../utils/notificationPreferences';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationPreferencesAPI');
const router = express.Router();

// GET /api/notification-preferences
// Get user's notification preferences
router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const prefs = await notificationPreferenceManager.getPreferences(userId);

    log.info('Preferences retrieved', { userId });

    res.json({
      success: true,
      preferences: prefs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get preferences', { error });
    res.status(500).json({
      error: 'Failed to retrieve preferences',
      message: (error as Error).message
    });
  }
});

// PUT /api/notification-preferences
// Update user's notification preferences
router.put('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { globalEnabled, globalChannels, categories, dailyFrequencyCap, hourlyFrequencyCap } = req.body;

    const updates: any = {};
    if (globalEnabled !== undefined) updates.globalEnabled = globalEnabled;
    if (globalChannels) updates.globalChannels = globalChannels;
    if (categories) updates.categories = categories;
    if (dailyFrequencyCap !== undefined) updates.dailyFrequencyCap = dailyFrequencyCap;
    if (hourlyFrequencyCap !== undefined) updates.hourlyFrequencyCap = hourlyFrequencyCap;

    await notificationPreferenceManager.setPreferences(userId, updates);

    log.info('Preferences updated via API', { userId });

    const updated = await notificationPreferenceManager.getPreferences(userId);

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: updated,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to update preferences', { error });
    res.status(500).json({
      error: 'Failed to update preferences',
      message: (error as Error).message
    });
  }
});

// PUT /api/notification-preferences/category/:category
// Update specific category preference
router.put('/category/:category', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { category } = req.params;
    const { enabled, channels, frequencyCap } = req.body;

    if (enabled === undefined || !channels) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'enabled and channels are required'
      });
    }

    await notificationPreferenceManager.setCategoryPreference(userId, category, {
      enabled,
      channels,
      frequencyCap
    });

    log.info('Category preference updated', { userId, category });

    res.json({
      success: true,
      message: 'Category preference updated successfully',
      category,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to update category preference', { error });
    res.status(500).json({
      error: 'Failed to update category preference',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-preferences/quiet-hours
// Set quiet hours
router.post('/quiet-hours', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { start, end, timezone } = req.body;

    if (!start || !end) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'start and end times are required (HH:MM format)'
      });
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start) || !timeRegex.test(end)) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Time must be in HH:MM format (00:00 - 23:59)'
      });
    }

    await notificationPreferenceManager.setQuietHours(userId, start, end, timezone || 'UTC');

    log.info('Quiet hours set', { userId, start, end });

    res.json({
      success: true,
      message: 'Quiet hours configured successfully',
      quietHours: { start, end, timezone: timezone || 'UTC' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to set quiet hours', { error });
    res.status(500).json({
      error: 'Failed to set quiet hours',
      message: (error as Error).message
    });
  }
});

// DELETE /api/notification-preferences/quiet-hours
// Disable quiet hours
router.delete('/quiet-hours', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    await notificationPreferenceManager.disableQuietHours(userId);

    log.info('Quiet hours disabled', { userId });

    res.json({
      success: true,
      message: 'Quiet hours disabled successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to disable quiet hours', { error });
    res.status(500).json({
      error: 'Failed to disable quiet hours',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-preferences/frequency-caps
// Set frequency caps
router.post('/frequency-caps', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { dailyCap, hourlyCap } = req.body;

    await notificationPreferenceManager.setFrequencyCaps(userId, dailyCap, hourlyCap);

    log.info('Frequency caps set', { userId, dailyCap, hourlyCap });

    res.json({
      success: true,
      message: 'Frequency caps updated successfully',
      frequencyCaps: { dailyCap, hourlyCap },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to set frequency caps', { error });
    res.status(500).json({
      error: 'Failed to set frequency caps',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-preferences/unsubscribe/:category
// Unsubscribe from category
router.post('/unsubscribe/:category', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { category } = req.params;

    await notificationPreferenceManager.unsubscribe(userId, category);

    log.info('Unsubscribed from category', { userId, category });

    res.json({
      success: true,
      message: `Unsubscribed from ${category} notifications`,
      category,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to unsubscribe', { error });
    res.status(500).json({
      error: 'Failed to unsubscribe',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-preferences/resubscribe/:category
// Resubscribe to category
router.post('/resubscribe/:category', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { category } = req.params;

    await notificationPreferenceManager.resubscribe(userId, category);

    log.info('Resubscribed to category', { userId, category });

    res.json({
      success: true,
      message: `Resubscribed to ${category} notifications`,
      category,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to resubscribe', { error });
    res.status(500).json({
      error: 'Failed to resubscribe',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-preferences/reset
// Reset to default preferences
router.post('/reset', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    await notificationPreferenceManager.resetToDefaults(userId);

    log.info('Preferences reset to defaults', { userId });

    const defaults = await notificationPreferenceManager.getPreferences(userId);

    res.json({
      success: true,
      message: 'Preferences reset to defaults successfully',
      preferences: defaults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to reset preferences', { error });
    res.status(500).json({
      error: 'Failed to reset preferences',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-preferences/can-send
// Check if notification can be sent to user
router.post('/can-send', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { category, channel } = req.body;

    if (!category) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'category is required'
      });
    }

    const canSend = await notificationPreferenceManager.canSendNotification(
      userId,
      category,
      channel || NotificationChannel.PUSH
    );

    log.info('Send permission checked', { userId, category, channel, canSend });

    res.json({
      success: true,
      canSend,
      category,
      channel: channel || NotificationChannel.PUSH,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to check send permission', { error });
    res.status(500).json({
      error: 'Failed to check send permission',
      message: (error as Error).message
    });
  }
});

export default router;
