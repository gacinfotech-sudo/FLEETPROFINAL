// Tenant + SaaS Admin Manifest - Defines navigation structure
// Combines tenant operations with admin panel features

// SaaS Admin Features for Tenant Admins

export const TENANT_MODULES = [
  // Dashboard
  { id: 'dashboard', label: 'Dashboard', iconKey: 'dashboard', parentGroup: 'dashboard' },

  // Customers Group
  { id: 'customers', label: 'All Customers', iconKey: 'customers', parentGroup: 'customers' },
  { id: 'customers-add', label: 'Add Customer', iconKey: 'users', parentGroup: 'customers' },
  { id: 'self-drive', label: 'Self Drive', iconKey: 'fleet', parentGroup: 'customers' },

  // Bookings Group
  { id: 'bookings', label: 'Add Booking', iconKey: 'booking', parentGroup: 'booking' },
  { id: 'live-bookings', label: 'Live Bookings', iconKey: 'live', parentGroup: 'booking' },
  { id: 'live-operations', label: 'Vehicles on Booking', iconKey: 'fleet', parentGroup: 'booking' },
  { id: 'upcoming-bookings', label: 'Upcoming Bookings', iconKey: 'upcoming', parentGroup: 'booking' },
  { id: 'booking-queues', label: 'Booking Queues', iconKey: 'booking', parentGroup: 'booking' },
  { id: 'payment-dues', label: 'Payment Collection', iconKey: 'payment-due', parentGroup: 'booking' },
  { id: 'history', label: 'Booking History', iconKey: 'history', parentGroup: 'booking' },

  // Sales Group
  { id: 'inquiries', label: 'Inquiries', iconKey: 'contact', parentGroup: 'sales' },
  { id: 'leads', label: 'Leads', iconKey: 'contact', parentGroup: 'sales' },
  { id: 'followups', label: 'Follow-ups', iconKey: 'contact', parentGroup: 'sales' },
  { id: 'after-sales', label: 'After-Sales', iconKey: 'after-sales', parentGroup: 'sales' },
  { id: 'campaigns', label: 'Campaigns', iconKey: 'campaigns', parentGroup: 'sales' },

  // Driver Management
  { id: 'drivers', label: 'All Drivers', iconKey: 'drivers', parentGroup: 'drivers' },
  { id: 'drivers-add', label: 'Add Driver', iconKey: 'users', parentGroup: 'drivers' },
  { id: 'driver-attendance', label: 'Attendance', iconKey: 'driver-attendance', parentGroup: 'drivers' },
  { id: 'driver-leave', label: 'Leave Calendar', iconKey: 'driver-leave', parentGroup: 'drivers' },
  { id: 'driver-performance', label: 'Performance', iconKey: 'driver-performance', parentGroup: 'drivers' },
  { id: 'driver-payroll', label: 'Payroll & Earnings', iconKey: 'revenue', parentGroup: 'drivers' },

  // Vehicles Group
  { id: 'fleet', label: 'View Fleet', iconKey: 'fleet', parentGroup: 'vehicles' },
  { id: 'gps-tracking', label: 'GPS Tracking', iconKey: 'alert', parentGroup: 'vehicles' },
  { id: 'vehicle-performance', label: 'Vehicle Performance', iconKey: 'vehicle-performance', parentGroup: 'vehicles' },

  // Vendor Management
  { id: 'vendors', label: 'Vendors', iconKey: 'contact', parentGroup: 'vendors' },
  { id: 'vendor-settlement', label: 'Settlement Portal', iconKey: 'revenue', parentGroup: 'vendors' },
  { id: 'vendor-invoices', label: 'Vendor Invoices', iconKey: 'alert', parentGroup: 'vendors' },

  // Tools & Templates
  { id: 'templates', label: 'Templates Library', iconKey: 'activity', parentGroup: 'tools' },

  // Finance
  { id: 'revenue', label: 'Revenue Report', iconKey: 'revenue', parentGroup: 'finance' },
  { id: 'expenses', label: 'Manage Expenses', iconKey: 'expenses', parentGroup: 'finance' },
  { id: 'salary', label: 'Salary', iconKey: 'salary', parentGroup: 'finance' },

  // Communications
  { id: 'whatsapp', label: 'WhatsApp', iconKey: 'whatsapp', parentGroup: 'communications' },
  { id: 'whatsapp-templates', label: 'WhatsApp Templates', iconKey: 'activity', parentGroup: 'communications' },
  { id: 'whatsapp-settings', label: 'WhatsApp Settings', iconKey: 'alert', parentGroup: 'communications' },
  { id: 'staff-whatsapp-management', label: 'Staff WhatsApp Numbers', iconKey: 'users', parentGroup: 'communications' },

  // Settings
  { id: 'users', label: 'Manage Users', iconKey: 'users', parentGroup: 'settings' },
  { id: 'profile', label: 'Profile', iconKey: 'profile', parentGroup: 'settings' },
];

interface NavigationGroup {
  id: string;
  label: string;
  iconKey: string;
  children: string[];
}

export function getNavigationStructure(role?: string, permissions?: string[]): NavigationGroup[] {
  const groups: NavigationGroup[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      iconKey: 'dashboard',
      children: ['dashboard']
    },
    {
      id: 'customers',
      label: 'Customers',
      iconKey: 'customers',
      children: ['customers', 'customers-add', 'self-drive']
    },
    {
      id: 'booking',
      label: 'Booking Management',
      iconKey: 'booking',
      children: ['bookings', 'live-bookings', 'live-operations', 'upcoming-bookings', 'booking-queues', 'payment-dues', 'history']
    },
    {
      id: 'sales',
      label: 'Sales',
      iconKey: 'contact',
      children: ['inquiries', 'leads', 'followups', 'after-sales', 'campaigns']
    },
    {
      id: 'drivers',
      label: 'Driver Management',
      iconKey: 'drivers',
      children: ['drivers', 'drivers-add', 'driver-attendance', 'driver-leave', 'driver-performance', 'driver-payroll']
    },
    {
      id: 'vehicles',
      label: 'Vehicles',
      iconKey: 'fleet',
      children: ['fleet', 'gps-tracking', 'vehicle-performance']
    },
    {
      id: 'vendors',
      label: 'Vendors',
      iconKey: 'contact',
      children: ['vendors', 'vendor-settlement', 'vendor-invoices']
    },
    {
      id: 'tools',
      label: 'Tools',
      iconKey: 'activity',
      children: ['templates']
    },
    {
      id: 'finance',
      label: 'Finance',
      iconKey: 'revenue',
      children: ['revenue', 'expenses', 'salary']
    },
    {
      id: 'communications',
      label: 'Communications',
      iconKey: 'whatsapp',
      children: ['whatsapp', 'whatsapp-templates', 'whatsapp-settings', 'staff-whatsapp-management']
    },
    {
      id: 'settings',
      label: 'Settings',
      iconKey: 'profile',
      children: ['users', 'profile']
    }
  ];

  // Filter based on role and permissions
  // Tenant-side roles only
  if (role === 'admin') {
    return groups; // Tenant admin sees all tenant operations
  }

  if (role === 'manager') {
    // Managers see most things but restricted from some admin/sensitive views
    return groups.filter(g => !['settings'].includes(g.id));
  }

  if (role === 'operator') {
    // Operators see operations, bookings, drivers, customers, communications
    return groups.filter(g => ['dashboard', 'booking', 'drivers', 'customers', 'vehicles', 'communications'].includes(g.id));
  }

  // Default: return all (will be further restricted by backend permissions)
  return groups;
}
