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
  MANAGE_INVOICE_SETTINGS: 'manage_invoice_settings',
  // Inquiry/Lead CRM (additive — see docs/INQUIRY_LEAD_EXISTING_AUDIT.md)
  VIEW_INQUIRIES: 'inquiry.view',
  CREATE_INQUIRY: 'inquiry.create',
  EDIT_INQUIRY: 'inquiry.edit',
  QUALIFY_INQUIRY: 'inquiry.qualify',
  CONVERT_INQUIRY_TO_LEAD: 'inquiry.convert_to_lead',
  MARK_INQUIRY_LOST: 'inquiry.mark_lost',
  // Lead pipeline (additive — see docs/RECOMMENDED_IMPLEMENTATION_ROADMAP.md)
  VIEW_LEADS: 'lead.view',
  EDIT_LEAD: 'lead.edit',
  ASSIGN_LEAD: 'lead.assign',
  MARK_LEAD_LOST: 'lead.mark_lost',
  // Quotations (additive)
  VIEW_QUOTATIONS: 'quotation.view',
  CREATE_QUOTATION: 'quotation.create',
  EDIT_QUOTATION_DRAFT: 'quotation.edit_draft',
  APPROVE_QUOTATION: 'quotation.approve',
  SEND_QUOTATION: 'quotation.send',
  ACCEPT_QUOTATION: 'quotation.accept',
  // Lead follow-ups (additive)
  VIEW_FOLLOWUPS: 'followup.view',
  CREATE_FOLLOWUP: 'followup.create',
  COMPLETE_FOLLOWUP: 'followup.complete',
  // One-click Lead conversions (additive)
  CONVERT_LEAD_TO_CUSTOMER: 'lead.convert_to_customer',
  CONVERT_LEAD_TO_BOOKING: 'lead.convert_to_booking',
  // Trip costing / driver expense (additive — see docs/TRIP_COSTING_DATA_MAPPING.md)
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
