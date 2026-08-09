import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage-mongodb';

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

// Permission check middleware
export function requirePermission(permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const hasPermission = await storage.checkUserPermission(req.userId, permission);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: 'Access denied', 
          requiredPermission: permission 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}

// Check if user can manage sub-users (only admins and clients can)
export function requireUserManagement(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'client')) {
    return res.status(403).json({ 
      message: 'Access denied. Only admins and clients can manage users.' 
    });
  }
  next();
}

// Available permissions
export const PERMISSIONS = {
  CREATE_BOOKING: 'create_booking',
  DELETE_BOOKING: 'delete_booking',
  EDIT_BOOKING: 'edit_booking',
  VIEW_BOOKINGS: 'view_bookings',
  GENERATE_INVOICE: 'generate_invoice',
  MANAGE_VEHICLES: 'manage_vehicles',
  MANAGE_DRIVERS: 'manage_drivers',
  VIEW_REVENUE: 'view_revenue',
  MANAGE_USERS: 'manage_users',
  MANAGE_CAMPAIGNS: 'manage_campaigns',

  // Vehicle 360 Permissions
  VEHICLE360_VIEW: 'vehicle360.view',
  VEHICLE_VIEW: 'vehicle.view',
  VEHICLE_MANAGE: 'vehicle.manage',
  VEHICLE_GPS_VIEW: 'vehicle.gps.view',
  VEHICLE_GPS_MANAGE: 'vehicle.gps.manage',
  VEHICLE_PERFORMANCE_VIEW: 'vehicle.performance.view',
  VEHICLE_COMPLIANCE_VIEW: 'vehicle.compliance.view',
  VEHICLE_COMPLIANCE_MANAGE: 'vehicle.compliance.manage',
  VEHICLE_DOCUMENTS_VIEW: 'vehicle.documents.view',
  VEHICLE_DOCUMENTS_MANAGE: 'vehicle.documents.manage',
  VEHICLE_MAINTENANCE_VIEW: 'vehicle.maintenance.view',
  VEHICLE_MAINTENANCE_MANAGE: 'vehicle.maintenance.manage',
  VEHICLE_FUEL_VIEW: 'vehicle.fuel.view',
  VEHICLE_FUEL_MANAGE: 'vehicle.fuel.manage',
  VEHICLE_EXPENSES_VIEW: 'vehicle.expenses.view',
  VEHICLE_EXPENSES_MANAGE: 'vehicle.expenses.manage',
  VEHICLE_BOOKINGS_VIEW: 'vehicle.bookings.view',
  VEHICLE_DRIVER_ASSIGNMENT_VIEW: 'vehicle.driver_assignment.view',
  VEHICLE_DRIVER_ASSIGNMENT_MANAGE: 'vehicle.driver_assignment.manage',
  VEHICLE_FINANCIALS_VIEW: 'vehicle.financials.view',
  VEHICLE_ALERTS_VIEW: 'vehicle.alerts.view',
  VEHICLE_ALERTS_MANAGE: 'vehicle.alerts.manage',

  // Legacy GPS permissions (kept for backward compatibility)
  GPS_CONNECTION_VIEW: 'gps.connection.view',
  GPS_CONNECTION_MANAGE: 'gps.connection.manage',
  GPS_DEVICE_VIEW: 'gps.device.view',
  GPS_DEVICE_MANAGE: 'gps.device.manage',
  GPS_ASSIGNMENT_MANAGE: 'gps.assignment.manage',
  GPS_LIVE_VIEW: 'gps.live.view',
  GPS_HISTORY_VIEW: 'gps.history.view',
  GPS_TRIP_SUMMARY_VIEW: 'gps.trip_summary.view',
  GPS_DISTANCE_REVIEW: 'gps.distance.review',
  GPS_DISTANCE_APPROVE: 'gps.distance.approve',
  GPS_GEOFENCE_VIEW: 'gps.geofence.view',
  GPS_GEOFENCE_MANAGE: 'gps.geofence.manage',
  GPS_ALERT_VIEW: 'gps.alert.view',
  GPS_ALERT_MANAGE: 'gps.alert.manage',
  GPS_SETTINGS_MANAGE: 'gps.settings.manage',
  GPS_REPORT_EXPORT: 'gps.report.export',
  GPS_RAW_DATA_VIEW: 'gps.raw_data.view',
} as const;
