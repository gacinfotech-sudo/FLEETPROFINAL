import { useAuth } from "./use-auth";

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (permission: string) => {
    if (!user) return false;
    
    // Admin has all permissions
    if (user.role === 'admin') return true;
    
    // Client has most permissions except some admin-only ones
    if (user.role === 'client') {
      const adminOnlyPermissions = ['manage_tenants', 'manage_admins'];
      return !adminOnlyPermissions.includes(permission);
    }
    
    // Manager only has specific permissions
    if (user.role === 'manager') {
      return user.permissions?.includes(permission) || false;
    }
    
    return false;
  };

  const canManageFleet = () => hasPermission('manage_vehicles');
  const canManageDrivers = () => hasPermission('manage_drivers');
  const canCreateBooking = () => hasPermission('create_booking');
  const canEditBooking = () => hasPermission('edit_booking');
  const canDeleteBooking = () => hasPermission('delete_booking');
  // Restored — trip-cost-summary depends on these (dropped in the
  // permission-hook rewrite).
  const canViewTripProfitability = () => hasPermission('trip.profitability.view');
  const canApproveExpense = () => hasPermission('expense.approve');
  const canGenerateInvoice = () => hasPermission('generate_invoice');
  const canViewBookings = () => hasPermission('view_bookings');
  const canViewRevenue = () => hasPermission('view_revenue');
  const canManageUsers = () => user?.role === 'admin' || user?.role === 'client';

  // Vehicle 360 permissions
  const canViewVehicle360 = () => user?.role === 'admin' || user?.role === 'client' || hasPermission('vehicle360.view');
  const canViewVehicles = () => canViewVehicle360() && (hasPermission('vehicle.view') || hasPermission('vehicle.manage'));
  const canManageVehicles = () => canViewVehicle360() && hasPermission('vehicle.manage');
  const canViewVehicleGPS = () => canViewVehicle360() && (hasPermission('vehicle.gps.view') || hasPermission('vehicle.gps.manage'));
  const canManageVehicleGPS = () => canViewVehicle360() && hasPermission('vehicle.gps.manage');
  const canViewVehiclePerformance = () => canViewVehicle360() && hasPermission('vehicle.performance.view');
  const canViewVehicleCompliance = () => canViewVehicle360() && (hasPermission('vehicle.compliance.view') || hasPermission('vehicle.compliance.manage'));
  const canManageVehicleCompliance = () => canViewVehicle360() && hasPermission('vehicle.compliance.manage');
  const canViewVehicleDocuments = () => canViewVehicle360() && (hasPermission('vehicle.documents.view') || hasPermission('vehicle.documents.manage'));
  const canManageVehicleDocuments = () => canViewVehicle360() && hasPermission('vehicle.documents.manage');
  const canViewVehicleMaintenance = () => canViewVehicle360() && (hasPermission('vehicle.maintenance.view') || hasPermission('vehicle.maintenance.manage'));
  const canManageVehicleMaintenance = () => canViewVehicle360() && hasPermission('vehicle.maintenance.manage');
  const canViewVehicleFuel = () => canViewVehicle360() && (hasPermission('vehicle.fuel.view') || hasPermission('vehicle.fuel.manage'));
  const canManageVehicleFuel = () => canViewVehicle360() && hasPermission('vehicle.fuel.manage');
  const canViewVehicleExpenses = () => canViewVehicle360() && (hasPermission('vehicle.expenses.view') || hasPermission('vehicle.expenses.manage'));
  const canManageVehicleExpenses = () => canViewVehicle360() && hasPermission('vehicle.expenses.manage');
  const canViewVehicleBookings = () => canViewVehicle360() && hasPermission('vehicle.bookings.view');
  const canViewVehicleAlerts = () => canViewVehicle360() && (hasPermission('vehicle.alerts.view') || hasPermission('vehicle.alerts.manage'));
  const canManageVehicleAlerts = () => canViewVehicle360() && hasPermission('vehicle.alerts.manage');
  const canManageVehicleDriverAssignment = () => canViewVehicle360() && hasPermission('vehicle.driver_assignment.manage');
  const canViewVehicleFinancials = () => canViewVehicle360() && hasPermission('vehicle.financials.view');

  return {
    hasPermission,
    canManageFleet,
    canManageDrivers,
    canCreateBooking,
    canEditBooking,
    canDeleteBooking,
    canViewTripProfitability,
    canApproveExpense,
    canGenerateInvoice,
    canViewBookings,
    canViewRevenue,
    canManageUsers,
    // Vehicle 360 helpers
    canViewVehicle360,
    canViewVehicles,
    canManageVehicles,
    canViewVehicleGPS,
    canManageVehicleGPS,
    canViewVehiclePerformance,
    canViewVehicleCompliance,
    canManageVehicleCompliance,
    canViewVehicleDocuments,
    canManageVehicleDocuments,
    canViewVehicleMaintenance,
    canManageVehicleMaintenance,
    canViewVehicleFuel,
    canManageVehicleFuel,
    canViewVehicleExpenses,
    canManageVehicleExpenses,
    canViewVehicleBookings,
    canViewVehicleAlerts,
    canManageVehicleAlerts,
    canManageVehicleDriverAssignment,
    canViewVehicleFinancials,
    user
  };
}
