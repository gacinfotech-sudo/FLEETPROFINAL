// SaaS Module Manifest - Defines navigation structure and permissions
export const SAAS_MODULES = [
  // Dashboard
  { id: 'dashboard', label: 'Dashboard', iconKey: 'dashboard', parentGroup: 'dashboard' },

  // Operations
  { id: 'live', label: 'Live Operations', iconKey: 'live', parentGroup: 'operations' },
  { id: 'upcoming', label: 'Upcoming Bookings', iconKey: 'upcoming', parentGroup: 'operations' },
  { id: 'payment-due', label: 'Payment Due', iconKey: 'payment-due', parentGroup: 'operations' },

  // Booking Management
  { id: 'booking', label: 'Bookings', iconKey: 'booking', parentGroup: 'booking' },

  // Fleet Management
  { id: 'fleet', label: 'Fleet', iconKey: 'fleet', parentGroup: 'fleet' },
  { id: 'vehicle-performance', label: 'Vehicle Performance', iconKey: 'vehicle-performance', parentGroup: 'fleet' },

  // Driver Management
  { id: 'drivers', label: 'Drivers', iconKey: 'drivers', parentGroup: 'drivers' },
  { id: 'driver-attendance', label: 'Attendance', iconKey: 'driver-attendance', parentGroup: 'drivers' },
  { id: 'driver-leave', label: 'Leave Requests', iconKey: 'driver-leave', parentGroup: 'drivers' },
  { id: 'driver-performance', label: 'Performance', iconKey: 'driver-performance', parentGroup: 'drivers' },

  // Customer Management
  { id: 'customers', label: 'Customers', iconKey: 'customers', parentGroup: 'customers' },
  { id: 'history', label: 'Booking History', iconKey: 'history', parentGroup: 'customers' },
  { id: 'after-sales', label: 'After Sales', iconKey: 'after-sales', parentGroup: 'customers' },
  { id: 'campaigns', label: 'Campaigns', iconKey: 'campaigns', parentGroup: 'customers' },

  // Finance
  { id: 'revenue', label: 'Revenue', iconKey: 'revenue', parentGroup: 'finance' },
  { id: 'expenses', label: 'Expenses', iconKey: 'expenses', parentGroup: 'finance' },
  { id: 'salary', label: 'Salary', iconKey: 'salary', parentGroup: 'finance' },

  // Communications
  { id: 'whatsapp', label: 'WhatsApp', iconKey: 'whatsapp', parentGroup: 'communications' },

  // Settings
  { id: 'users', label: 'Users', iconKey: 'users', parentGroup: 'settings' },
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
      id: 'operations',
      label: 'Operations',
      iconKey: 'live',
      children: ['live', 'upcoming', 'payment-due']
    },
    {
      id: 'booking',
      label: 'Booking Management',
      iconKey: 'booking',
      children: ['booking']
    },
    {
      id: 'fleet',
      label: 'Fleet Management',
      iconKey: 'fleet',
      children: ['fleet', 'vehicle-performance']
    },
    {
      id: 'drivers',
      label: 'Driver Management',
      iconKey: 'drivers',
      children: ['drivers', 'driver-attendance', 'driver-leave', 'driver-performance']
    },
    {
      id: 'customers',
      label: 'Customer Management',
      iconKey: 'customers',
      children: ['customers', 'history', 'after-sales', 'campaigns']
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

  // Filter based on role and permissions
  if (role === 'admin') {
    return groups; // Admin sees everything
  }

  if (role === 'operator') {
    // Operators see operations, bookings, drivers, customers
    return groups.filter(g => ['operations', 'booking', 'drivers', 'customers'].includes(g.id));
  }

  // Default: return all (will be further restricted by backend permissions)
  return groups;
}
