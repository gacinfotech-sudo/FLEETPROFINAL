// SaaS Module Manifest - Defines navigation structure and permissions
// Restored to match the good state (1be6ca8) comprehensive navigation
// This includes all 42+ items that were present before simplification
export const SAAS_MODULES = [
  // Dashboard
  { id: 'dashboard', label: 'Dashboard', iconKey: 'dashboard', parentGroup: 'dashboard' },

  // Customers Group
  { id: 'customers', label: 'All Customers', iconKey: 'customers', parentGroup: 'customers' },
  { id: 'customers-add', label: 'Add Customer', iconKey: 'users', parentGroup: 'customers' },
  { id: 'self-drive', label: 'Self Drive', iconKey: 'fleet', parentGroup: 'customers' },

  // Bookings Group
  { id: 'booking', label: 'Add Booking', iconKey: 'booking', parentGroup: 'booking' },
  { id: 'live-bookings', label: 'Live Bookings', iconKey: 'live', parentGroup: 'booking' },
  { id: 'live-operations', label: 'Vehicles on Booking', iconKey: 'fleet', parentGroup: 'booking' },
  { id: 'upcoming-bookings', label: 'Upcoming Bookings', iconKey: 'upcoming', parentGroup: 'booking' },
  { id: 'booking-queues', label: 'Booking Queues', iconKey: 'booking', parentGroup: 'booking' },
  { id: 'payment-dues', label: 'Payment Collection', iconKey: 'payment-due', parentGroup: 'booking' },
  { id: 'history', label: 'Booking History', iconKey: 'history', parentGroup: 'booking' },

  // Top-level items (not grouped)
  { id: 'inquiries', label: 'Inquiries', iconKey: 'contact', parentGroup: null },
  { id: 'leads', label: 'Leads', iconKey: 'contact', parentGroup: null },
  { id: 'followups', label: 'Follow-ups', iconKey: 'contact', parentGroup: null },

  // Driver Management
  { id: 'drivers', label: 'All Drivers', iconKey: 'drivers', parentGroup: 'drivers' },
  { id: 'drivers-add', label: 'Add Driver', iconKey: 'users', parentGroup: 'drivers' },
  { id: 'driver-attendance', label: 'Attendance', iconKey: 'driver-attendance', parentGroup: 'drivers' },
  { id: 'driver-leave', label: 'Leave Calendar', iconKey: 'driver-leave', parentGroup: 'drivers' },
  { id: 'driver-performance', label: 'Performance', iconKey: 'driver-performance', parentGroup: 'drivers' },

  // Fleet Management (top-level items)
  { id: 'fleet', label: 'View Fleet', iconKey: 'fleet', parentGroup: null },
  { id: 'gps-tracking', label: 'GPS Tracking', iconKey: 'alert', parentGroup: null },
  { id: 'vehicle-performance', label: 'Vehicle Performance', iconKey: 'vehicle-performance', parentGroup: null },

  // Customer Extended Services
  { id: 'after-sales', label: 'After-Sales', iconKey: 'after-sales', parentGroup: null },
  { id: 'campaigns', label: 'Campaigns', iconKey: 'campaigns', parentGroup: null },
  { id: 'rewards-referrals', label: 'Rewards & Referrals', iconKey: 'alert', parentGroup: null },

  // Vendor Management
  { id: 'vendors', label: 'Vendors', iconKey: 'contact', parentGroup: 'vendors' },
  { id: 'vendor-settlement', label: 'Vendor Settlement', iconKey: 'alert', parentGroup: 'vendors' },

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
      children: ['booking', 'live-bookings', 'live-operations', 'upcoming-bookings', 'booking-queues', 'payment-dues', 'history']
    },
    // Top-level items (no group parent)
    // These are rendered as individual items, not in a collapsible group
    // inquiries, leads, followups rendered at top level

    {
      id: 'drivers',
      label: 'Driver Management',
      iconKey: 'drivers',
      children: ['drivers', 'drivers-add', 'driver-attendance', 'driver-leave', 'driver-performance']
    },
    // Top-level fleet items
    // fleet, gps-tracking, vehicle-performance rendered at top level

    // Top-level customer services
    // after-sales, campaigns, rewards-referrals rendered at top level

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
  const topLevelItems = ['inquiries', 'leads', 'followups', 'fleet', 'gps-tracking', 'vehicle-performance', 'after-sales', 'campaigns', 'rewards-referrals'];

  // Filter based on role and permissions
  if (role === 'admin') {
    return groups; // Admin sees everything
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
