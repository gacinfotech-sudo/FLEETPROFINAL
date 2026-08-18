/**
 * TEST CONFIGURATION
 * Centralized test setup, credentials, and environment variables
 */

export const TEST_CONFIG = {
  // Server Configuration
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:5050',
  timeout: 30000,
  apiTimeout: 10000,

  // Database Configuration
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro',

  // Root User Credentials
  rootUser: {
    email: 'root@fleetpro.local',
    password: 'RootPassword123!@#',
    userId: process.env.ROOT_USER_ID || '507f1f77bcf86cd799439001',
  },

  // Test Tenants
  tenants: {
    dharvika: {
      id: process.env.DHARVIKA_TENANT_ID || '507f1f77bcf86cd799439100',
      name: 'Dharvika Travels',
      owner: {
        email: 'owner@dharvika.local',
        password: 'OwnerPassword123!@#',
        userId: process.env.DHARVIKA_OWNER_ID || '507f1f77bcf86cd799439101',
      },
      staff: {
        email: 'staff@dharvika.local',
        password: 'StaffPassword123!@#',
        userId: process.env.DHARVIKA_STAFF_ID || '507f1f77bcf86cd799439102',
      },
    },
    qaTest: {
      id: process.env.QATEST_TENANT_ID || '507f1f77bcf86cd799439200',
      name: 'QA Test Tenant',
      owner: {
        email: 'owner@qatest.local',
        password: 'QAOwnerPassword123!@#',
        userId: process.env.QATEST_OWNER_ID || '507f1f77bcf86cd799439201',
      },
      staff: {
        email: 'staff@qatest.local',
        password: 'QAStaffPassword123!@#',
        userId: process.env.QATEST_STAFF_ID || '507f1f77bcf86cd799439202',
      },
    },
  },

  // Expected Data Counts (for data integrity tests)
  expectedDataCounts: {
    dharvika: {
      customers: 1730, // Approximate - recovered count
      bookings: 1381,
      drivers: 255,
      vehicles: 368,
    },
  },

  // Test Timeouts
  timeouts: {
    login: 10000,
    api: 10000,
    navigation: 5000,
    dataLoad: 15000,
  },

  // Retry Configuration
  retries: {
    maxAttempts: 3,
    delayMs: 1000,
  },

  // Test Data
  testData: {
    customer: {
      name: 'Test Customer',
      mobile: '9123456789',
      email: 'test@customer.local',
      city: 'Bangalore',
    },
    driver: {
      name: 'Test Driver',
      mobile: '9187654321',
      email: 'test@driver.local',
      licenseNumber: 'DL-TEST-123456',
      licenseExpiry: '2030-12-31',
    },
    vehicle: {
      registrationNumber: 'KA01TEST0001',
      model: 'Innova',
      manufacturer: 'Toyota',
      bodyType: 'SUV',
      seatingCapacity: 7,
    },
    booking: {
      source: 'web',
      tripType: 'one-way',
      travelDateStatus: 'confirmed',
    },
  },
};

export const API_ENDPOINTS = {
  // Auth Endpoints
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    register: '/api/auth/register',
    passwordReset: '/api/auth/password-reset',
    refreshToken: '/api/auth/refresh-token',
  },

  // Root/Admin Endpoints
  root: {
    tenants: '/api/root/tenants',
    users: '/api/root/users',
    stats: '/api/root/stats',
  },

  // Tenant Admin Endpoints
  admin: {
    users: '/api/admin/users',
    permissions: '/api/admin/permissions',
    roles: '/api/admin/roles',
    settings: '/api/admin/settings',
  },

  // Tenant Core Endpoints
  tenant: {
    customers: '/api/tenant/customers',
    drivers: '/api/tenant/drivers',
    vehicles: '/api/tenant/vehicles',
    bookings: '/api/bookings',
    dashboard: '/api/tenant/dashboard',
  },

  // Reports & Analytics Endpoints
  reports: {
    revenue: '/api/reports/revenue',
    bookings: '/api/reports/bookings',
    drivers: '/api/reports/drivers',
    vehicles: '/api/reports/vehicles',
  },
};

export const HTTP_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};
