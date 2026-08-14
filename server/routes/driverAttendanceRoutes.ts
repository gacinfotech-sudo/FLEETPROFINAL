/**
 * DRIVER 360: ATTENDANCE API ROUTES
 * Auto-calculated daily and monthly attendance from operational data
 */

import express, { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, requireTenant } from '../middleware/auth';
import {
  getDailyAttendance,
  getMonthlyAttendanceSummary,
  getAttendanceForDrivers,
  invalidateCache
} from '../services/driverAttendanceService';

const router: Router = express.Router();

/**
 * GET /api/driver-attendance/daily/:driverId?date=YYYY-MM-DD
 * Get daily attendance for a specific date
 */
router.get('/daily/:driverId', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { driverId } = req.params;
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Date required in format YYYY-MM-DD' });
    }

    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const attendance = await getDailyAttendance(
      new mongoose.Types.ObjectId(driverId),
      attendanceDate,
      new mongoose.Types.ObjectId(tenantId)
    );

    res.json({
      success: true,
      data: attendance
    });
  } catch (error: any) {
    console.error('Error fetching daily attendance:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch daily attendance' });
  }
});

/**
 * GET /api/driver-attendance/monthly/:driverId?year=2026&month=8
 * Get monthly attendance summary with daily breakdown
 */
router.get('/monthly/:driverId', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { driverId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month required' });
    }

    const y = parseInt(year as string);
    const m = parseInt(month as string);

    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    const summary = await getMonthlyAttendanceSummary(
      new mongoose.Types.ObjectId(driverId),
      y,
      m,
      new mongoose.Types.ObjectId(tenantId)
    );

    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('Error fetching monthly attendance:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch monthly attendance' });
  }
});

/**
 * GET /api/driver-attendance/bulk?driverIds=id1,id2&year=2026&month=8
 * Get attendance for multiple drivers
 */
router.get('/bulk', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { driverIds, year, month } = req.query;

    if (!driverIds || !year || !month) {
      return res.status(400).json({ error: 'driverIds, year, and month required' });
    }

    const ids = (typeof driverIds === 'string' ? driverIds.split(',') : driverIds) as string[];
    const y = parseInt(year as string);
    const m = parseInt(month as string);

    const summaries = await getAttendanceForDrivers(
      ids.map(id => new mongoose.Types.ObjectId(id)),
      y,
      m,
      new mongoose.Types.ObjectId(tenantId)
    );

    res.json({
      success: true,
      count: summaries.length,
      data: summaries
    });
  } catch (error: any) {
    console.error('Error fetching bulk attendance:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch bulk attendance' });
  }
});

/**
 * POST /api/driver-attendance/invalidate-cache/:driverId?year=2026&month=8
 * Invalidate cached attendance (call after booking/leave changes)
 */
router.post('/invalidate-cache/:driverId', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const { year, month } = req.query;

    if (year && month) {
      invalidateCache(driverId, parseInt(year as string), parseInt(month as string));
    } else {
      invalidateCache(driverId);
    }

    res.json({
      success: true,
      message: 'Cache invalidated'
    });
  } catch (error: any) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({ error: error.message || 'Failed to invalidate cache' });
  }
});

export default router;
