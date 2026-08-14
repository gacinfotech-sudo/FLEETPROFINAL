import { Router, Response } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../middleware/auth';
import { EntitlementService } from '../services/entitlementService';

const router = Router();

/**
 * GET /api/entitlements/current
 * Get current tenant's entitlements and usage
 */
router.get('/current', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const [vehicleUsage, driverUsage, userUsage, subscriptionStatus] = await Promise.all([
      EntitlementService.getVehicleUsage(req.tenantId!),
      EntitlementService.getDriverUsage(req.tenantId!),
      EntitlementService.getUserUsage(req.tenantId!),
      EntitlementService.getSubscriptionStatus(req.tenantId!),
    ]);

    const [canAddVehicle, canAddDriver, canAddUser] = await Promise.all([
      EntitlementService.canAddVehicle(req.tenantId!),
      EntitlementService.canAddDriver(req.tenantId!),
      EntitlementService.canAddUser(req.tenantId!),
    ]);

    res.json({
      success: true,
      data: {
        subscription: subscriptionStatus,
        usage: {
          vehicles: vehicleUsage,
          drivers: driverUsage,
          users: userUsage,
        },
        canAdd: {
          vehicle: canAddVehicle,
          driver: canAddDriver,
          user: canAddUser,
        },
        warnings: {
          vehiclesFull: vehicleUsage.exceeded,
          driversFull: driverUsage.exceeded,
          usersFull: userUsage.exceeded,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch entitlements' });
  }
});

/**
 * GET /api/entitlements/can-add
 * Quick check if tenant can add resources
 */
router.get('/can-add', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const type = req.query.type as string; // 'vehicle', 'driver', 'user'

    let canAdd = false;

    switch (type) {
      case 'vehicle':
        canAdd = await EntitlementService.canAddVehicle(req.tenantId!);
        break;
      case 'driver':
        canAdd = await EntitlementService.canAddDriver(req.tenantId!);
        break;
      case 'user':
        canAdd = await EntitlementService.canAddUser(req.tenantId!);
        break;
    }

    res.json({ success: true, data: { canAdd } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to check entitlement' });
  }
});

/**
 * GET /api/entitlements/features
 * Check if tenant has specific features
 */
router.get('/features', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const features = [
      'driver-360',
      'vehicle-360',
      'salary-management',
      'gps-tracking',
      'advanced-reports',
      'api-access',
      'white-label',
    ];

    const enabledFeatures = [];
    for (const feature of features) {
      const enabled = await EntitlementService.hasFeature(req.tenantId!, feature);
      if (enabled) enabledFeatures.push(feature);
    }

    res.json({
      success: true,
      data: { enabledFeatures },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch features' });
  }
});

export default router;
