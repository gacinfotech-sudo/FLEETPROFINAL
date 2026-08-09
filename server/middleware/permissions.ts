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
  // Restored constants — the secure-login merge committed a truncated
  // PERMISSIONS map, silently 403-ing every route that referenced the
  // dropped keys (inquiry/lead/quotation/vendor/GPS/vehicle modules).
  MANAGE_INVOICE_SETTINGS: 'manage_invoice_settings',
  VIEW_INQUIRIES: 'inquiry.view',
  CREATE_INQUIRY: 'inquiry.create',
  EDIT_INQUIRY: 'inquiry.edit',
  QUALIFY_INQUIRY: 'inquiry.qualify',
  CONVERT_INQUIRY_TO_LEAD: 'inquiry.convert_to_lead',
  MARK_INQUIRY_LOST: 'inquiry.mark_lost',
  VIEW_LEADS: 'lead.view',
  EDIT_LEAD: 'lead.edit',
  ASSIGN_LEAD: 'lead.assign',
  MARK_LEAD_LOST: 'lead.mark_lost',
  VIEW_QUOTATIONS: 'quotation.view',
  CREATE_QUOTATION: 'quotation.create',
  EDIT_QUOTATION_DRAFT: 'quotation.edit_draft',
  APPROVE_QUOTATION: 'quotation.approve',
  SEND_QUOTATION: 'quotation.send',
  ACCEPT_QUOTATION: 'quotation.accept',
  VIEW_FOLLOWUPS: 'followup.view',
  CREATE_FOLLOWUP: 'followup.create',
  COMPLETE_FOLLOWUP: 'followup.complete',
  CONVERT_LEAD_TO_CUSTOMER: 'lead.convert_to_customer',
  CONVERT_LEAD_TO_BOOKING: 'lead.convert_to_booking',
  APPROVE_EXPENSE: 'expense.approve',
  VIEW_TRIP_PROFITABILITY: 'trip.profitability.view',
  VENDOR_VIEW: 'vendor_view',
  VENDOR_CREATE: 'vendor_create',
  VENDOR_EDIT: 'vendor_edit',
  VENDOR_BLOCK: 'vendor_block',
  VENDOR_DRIVER_CREATE: 'vendor_driver_create',
  VENDOR_DRIVER_EDIT: 'vendor_driver_edit',
  VENDOR_VEHICLE_CREATE: 'vendor_vehicle_create',
  VENDOR_VEHICLE_EDIT: 'vendor_vehicle_edit',
  REWARD_RULE_MANAGE: 'reward.rule.manage',
  REWARD_ADJUST: 'reward.adjust',
  REFERRAL_VIEW: 'referral.view',
  REFERRAL_CREATE: 'referral.create',
  REFERRAL_MANAGE: 'referral.manage',
  OUTSOURCING_VIEW: 'outsourcing.view',
  OUTSOURCING_CREATE: 'outsourcing.create',
  OUTSOURCING_MANAGE: 'outsourcing.manage',
  VEHICLE_EXPENSE_VIEW: 'vehicle.expense.view',
  VEHICLE_EXPENSE_MANAGE: 'vehicle.expense.manage',
  VEHICLE_FASTAG_VIEW: 'vehicle.fastag.view',
  VEHICLE_FASTAG_MANAGE: 'vehicle.fastag.manage',
  VEHICLE_INCIDENTS_VIEW: 'vehicle.incidents.view',
  VEHICLE_INCIDENTS_MANAGE: 'vehicle.incidents.manage',
} as const;
