/**
 * SALARY PROFILE INTEGRATION ROUTES
 * API endpoints for Driver Salary Profile operations
 * Demonstrates integration between salary calculation and driver profiles
 */

import express, { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, requireTenant } from '../middleware/auth';
import {
  calculateSalaryWithActiveConfig,
  validateSalaryCalculationInputWithProfile,
  getSalaryConfigurationStatus,
  SalaryConfigurationError
} from '../services/salaryCalculationEngine';
import {
  getSalaryConfigurationHealthReport,
  validateTenantSalaryConfigurations,
  linkActiveSalaryMasterToDriver,
  unlinkSalaryMasterFromDriver,
  createDriverSalaryConfiguration,
  updateDriverSalaryConfiguration,
  deactivateDriverSalaryConfiguration,
  exportDriverSalaryConfigurationHistory
} from '../services/driverSalaryProfileService';
import { DriverSalaryMaster, Driver } from '../models/index';

const router: Router = express.Router();

/**
 * GET /api/salary-profile/:driverId/status
 * Get salary configuration status for a driver
 */
router.get(
  '/salary-profile/:driverId/status',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;
      const tenantId = (req as any).tenantId;

      const status = await getSalaryConfigurationStatus(driverId, tenantId);

      res.json({
        success: true,
        data: status
      });
    } catch (error: any) {
      console.error('Error getting salary status:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get salary status'
      });
    }
  }
);

/**
 * GET /api/salary-profile/:driverId/health
 * Get comprehensive health report for a driver's salary configuration
 */
router.get(
  '/salary-profile/:driverId/health',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;
      const tenantId = (req as any).tenantId;

      const healthReport = await getSalaryConfigurationHealthReport(driverId, tenantId);

      res.json({
        success: true,
        data: healthReport
      });
    } catch (error: any) {
      console.error('Error getting health report:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get health report'
      });
    }
  }
);

/**
 * GET /api/salary-profile/tenant/validate
 * Validate salary configurations for all drivers in tenant
 */
router.get(
  '/salary-profile/tenant/validate',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;

      const validation = await validateTenantSalaryConfigurations(tenantId);

      res.json({
        success: true,
        data: validation
      });
    } catch (error: any) {
      console.error('Error validating tenant configurations:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to validate configurations'
      });
    }
  }
);

/**
 * POST /api/salary-profile/:driverId/calculate
 * Calculate salary using active configuration
 */
router.post(
  '/salary-profile/:driverId/calculate',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;
      const tenantId = (req as any).tenantId;
      const {
        salaryPeriodStart,
        salaryPeriodEnd,
        payableDays,
        payrollDays,
        presentDays,
        paidLeaveDays,
        unpaidLeaveDays,
        weeklyOffDays,
        halfDays,
        absentDays,
        bookingServiceDays,
        totalKilometers,
        nightDutyTrips,
        outstationTrips,
        manualAllowances,
        manualDeductions,
        validateSalaryMasterActive = true
      } = req.body;

      // Validate input
      const calculationInput = {
        driverId,
        tenantId,
        salaryPeriodStart: new Date(salaryPeriodStart),
        salaryPeriodEnd: new Date(salaryPeriodEnd),
        payableDays,
        payrollDays,
        presentDays,
        paidLeaveDays,
        unpaidLeaveDays,
        weeklyOffDays,
        halfDays,
        absentDays,
        bookingServiceDays,
        totalKilometers,
        nightDutyTrips,
        outstationTrips,
        manualAllowances,
        manualDeductions,
        useActiveSalaryConfig: true,
        validateSalaryMasterActive
      };

      const inputValidation = await validateSalaryCalculationInputWithProfile(calculationInput);
      if (!inputValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid input',
          errors: inputValidation.errors
        });
      }

      // Create a dummy salary master (will be fetched from DB)
      const activeSalaryMaster = await DriverSalaryMaster.findOne({
        driverId: new mongoose.Types.ObjectId(driverId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'active'
      }).exec();

      if (!activeSalaryMaster) {
        return res.status(404).json({
          success: false,
          error: 'No active salary configuration found for this driver'
        });
      }

      const calculation = await calculateSalaryWithActiveConfig({
        ...calculationInput,
        salaryMaster: activeSalaryMaster.toObject() as any
      });

      res.json({
        success: true,
        data: {
          calculation: calculation.result,
          configStatus: calculation.configStatus
        }
      });
    } catch (error: any) {
      if (error instanceof SalaryConfigurationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Error calculating salary:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to calculate salary'
      });
    }
  }
);

/**
 * POST /api/salary-profile/:driverId/link
 * Link active salary master to driver profile
 */
router.post(
  '/salary-profile/:driverId/link',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;
      const { salaryMasterId } = req.body;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const role = (req as any).userRole;

      const linkedDriver = await linkActiveSalaryMasterToDriver(
        driverId,
        salaryMasterId,
        tenantId,
        { userId, role }
      );

      res.json({
        success: true,
        message: 'Salary master linked to driver',
        data: linkedDriver
      });
    } catch (error: any) {
      console.error('Error linking salary master:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to link salary master'
      });
    }
  }
);

/**
 * POST /api/salary-profile/:driverId/unlink
 * Unlink salary master from driver profile
 */
router.post(
  '/salary-profile/:driverId/unlink',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const role = (req as any).userRole;

      const unlinkedDriver = await unlinkSalaryMasterFromDriver(driverId, { userId, role });

      res.json({
        success: true,
        message: 'Salary master unlinked from driver',
        data: unlinkedDriver
      });
    } catch (error: any) {
      console.error('Error unlinking salary master:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to unlink salary master'
      });
    }
  }
);

/**
 * POST /api/salary-profile/:driverId/create
 * Create salary configuration for a driver
 */
router.post(
  '/salary-profile/:driverId/create',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const role = (req as any).userRole;

      const salaryConfig = await createDriverSalaryConfiguration(
        driverId,
        tenantId,
        req.body,
        { userId, role }
      );

      res.json({
        success: true,
        message: 'Salary configuration created',
        data: salaryConfig
      });
    } catch (error: any) {
      console.error('Error creating salary configuration:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create salary configuration'
      });
    }
  }
);

/**
 * PUT /api/salary-profile/:driverId/update
 * Update salary configuration for a driver
 */
router.put(
  '/salary-profile/:driverId/update',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const role = (req as any).userRole;

      const updatedConfig = await updateDriverSalaryConfiguration(
        driverId,
        tenantId,
        req.body,
        { userId, role }
      );

      res.json({
        success: true,
        message: 'Salary configuration updated',
        data: updatedConfig
      });
    } catch (error: any) {
      console.error('Error updating salary configuration:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update salary configuration'
      });
    }
  }
);

/**
 * POST /api/salary-profile/:driverId/deactivate
 * Deactivate salary configuration for a driver
 */
router.post(
  '/salary-profile/:driverId/deactivate',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const role = (req as any).userRole;

      const deactivatedConfig = await deactivateDriverSalaryConfiguration(
        driverId,
        tenantId,
        { userId, role }
      );

      res.json({
        success: true,
        message: 'Salary configuration deactivated',
        data: deactivatedConfig
      });
    } catch (error: any) {
      console.error('Error deactivating salary configuration:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to deactivate salary configuration'
      });
    }
  }
);

/**
 * GET /api/salary-profile/:driverId/history
 * Export salary configuration history
 */
router.get(
  '/salary-profile/:driverId/history',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;
      const tenantId = (req as any).tenantId;

      const history = await exportDriverSalaryConfigurationHistory(driverId, tenantId);

      res.json({
        success: true,
        data: history
      });
    } catch (error: any) {
      console.error('Error exporting salary history:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to export history'
      });
    }
  }
);

export default router;
