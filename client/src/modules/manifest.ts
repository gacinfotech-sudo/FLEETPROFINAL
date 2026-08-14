// SaaS Module Manifest - Defines navigation structure and permissions
// Restored to match the good state (1be6ca8) comprehensive navigation
// This includes all 42+ items that were present before simplification

// Platform Admin SaaS Modules (for Super Admin only)
export const SAAS_ADMIN_MODULES = [
  { id: 'saas-dashboard', label: 'Dashboard', iconKey: 'dashboard', parentGroup: 'saas' },
  { id: 'saas-tenants', label: 'Tenants', iconKey: 'customers', parentGroup: 'saas' },
  { id: 'saas-plans', label: 'Plans', iconKey: 'alert', parentGroup: 'saas' },
  { id: 'saas-subscriptions', label: 'Subscriptions', iconKey: 'booking', parentGroup: 'saas' },
  { id: 'saas-billing', label: 'Billing', iconKey: 'revenue', parentGroup: 'saas' },
  { id: 'saas-support', label: 'Support', iconKey: 'contact', parentGroup: 'saas' },
  { id: 'saas-profile', label: 'SaaS Profile', iconKey: 'profile', parentGroup: 'saas' },
  { id: 'saas-security', label: 'Security', iconKey: 'alert', parentGroup: 'saas' },
];

export const SAAS_MODULES = [
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

  // Customer Extended Services
  { id: 'rewards-referrals', label: 'Rewards & Referrals', iconKey: 'alert', parentGroup: null },

  // Vendor Management
  { id: 'vendors', label: 'Vendors', iconKey: 'contact', parentGroup: 'vendors' },
  { id: 'vendor-settlement', label: 'Settlement Portal', iconKey: 'revenue', parentGroup: 'vendors' },
  { id: 'vendor-invoices', label: 'Vendor Invoices', iconKey: 'alert', parentGroup: 'vendors' },

  // Finance
  { id: 'revenue', label: 'Revenue Report', iconKey: 'revenue', parentGroup: 'finance' },
  { id: 'expenses', label: 'Manage Expenses', iconKey: 'expenses', parentGroup: 'finance' },
  { id: 'salary', label: 'Salary', iconKey: 'salary', parentGroup: 'finance' },

  // Communications
  { id: 'whatsapp', label: 'WhatsApp', iconKey: 'whatsapp', parentGroup: 'communications' },

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

export function getNavigationStructure(role?: string, permissions?: string[], platformRole?: string): NavigationGroup[] {
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
      children: ['drivers', 'drivers-add', 'driver-attendance', 'driver-leave', 'driver-performance']
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
      children: ['vendors', 'vendor-settlement']
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
      children: ['whatsapp']
    },
    {
      id: 'settings',
      label: 'Settings',
      iconKey: 'profile',
      children: ['users', 'profile']
    }
  ];

  // Collect top-level items (those with parentGroup: null) that should render as individual items
  const topLevelItems = ['rewards-referrals'];

  // Add SaaS Platform Admin section for admin users
  const saasSection: NavigationGroup = {
    id: 'saas-platform',
    label: 'SaaS Platform Admin',
    iconKey: 'dashboard',
    children: ['saas-dashboard', 'saas-tenants', 'saas-plans', 'saas-subscriptions', 'saas-billing', 'saas-support', 'saas-profile', 'saas-security']
  };

  // Filter based on role and permissions
  // Platform staff (ROOT, SUPER_ADMIN, etc.) see only SaaS admin panel
  if (platformRole) {
    return [saasSection]; // Platform staff sees ONLY SaaS section, no tenant menus
  }

  // Tenant-side roles
  if (role === 'admin') {
    return groups; // Tenant admin sees all tenant operations
  }

  if (role === 'manager') {
    // Managers see most things but restricted from some admin/sensitive views
    return groups.filter(g => !['settings'].includes(g.id));
  }

  if (role === 'operator') {
    // Operators see operations, bookings, drivers, customers
    return groups.filter(g => ['dashboard', 'booking', 'drivers', 'customers'].includes(g.id));
  }

  // Default: return all (will be further restricted by backend permissions)
  return groups;
}
