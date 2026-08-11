/**
 * Production Data Seeding Script
 *
 * IMPORTANT: This script ONLY seeds configuration data and templates
 * It does NOT include customer data, personal information, or transactions
 * Customer data must be migrated separately through secure channels
 *
 * Execution: Runs via docker-entrypoint-initdb.d during container startup
 */

db = db.getSiblingDB('fleetpro');

print('[SEED] Starting production data seeding...');

// ============================================================================
// SEED CONFIGURATION DATA
// ============================================================================
print('[SEED] Seeding system configuration...');

db.config.insertMany([
    {
        key: 'app_version',
        value: '1.0.0',
        description: 'Application version',
        lastUpdated: new Date()
    },
    {
        key: 'app_name',
        value: 'FleetPro',
        description: 'Application name',
        lastUpdated: new Date()
    },
    {
        key: 'currency_symbol',
        value: '₹',
        description: 'Default currency symbol',
        lastUpdated: new Date()
    },
    {
        key: 'currency_code',
        value: 'INR',
        description: 'Default currency code',
        lastUpdated: new Date()
    },
    {
        key: 'timezone',
        value: 'Asia/Kolkata',
        description: 'Default timezone',
        lastUpdated: new Date()
    },
    {
        key: 'decimal_places',
        value: 2,
        description: 'Decimal places for currency',
        lastUpdated: new Date()
    },
    {
        key: 'date_format',
        value: 'DD/MM/YYYY',
        description: 'Default date format',
        lastUpdated: new Date()
    },
    {
        key: 'time_format',
        value: '24H',
        description: 'Default time format',
        lastUpdated: new Date()
    },
    {
        key: 'max_booking_days',
        value: 365,
        description: 'Maximum booking duration in days',
        lastUpdated: new Date()
    },
    {
        key: 'min_booking_hours',
        value: 2,
        description: 'Minimum booking duration in hours',
        lastUpdated: new Date()
    },
    {
        key: 'advance_payment_percentage',
        value: 25,
        description: 'Advance payment required as percentage',
        lastUpdated: new Date()
    }
]);

print('[SEED] ✓ Seeded configuration (11 items)');

// ============================================================================
// SEED VEHICLE TYPES & CATEGORIES
// ============================================================================
print('[SEED] Seeding vehicle types and categories...');

db.vehicleTypes.insertMany([
    {
        category: 'Car',
        types: [
            { name: 'Sedan', code: 'SEDAN', seats: 5, baseDailyRate: 800 },
            { name: 'Hatchback', code: 'HATCH', seats: 5, baseDailyRate: 600 },
            { name: 'SUV', code: 'SUV', seats: 7, baseDailyRate: 1200 },
            { name: 'Coupe', code: 'COUPE', seats: 4, baseDailyRate: 1000 },
            { name: 'Convertible', code: 'CONVERT', seats: 4, baseDailyRate: 1500 }
        ],
        createdAt: new Date()
    },
    {
        category: 'Commercial',
        types: [
            { name: 'Truck', code: 'TRUCK', capacity: '1-2 ton', baseDailyRate: 2000 },
            { name: 'Pickup', code: 'PICKUP', capacity: '500kg', baseDailyRate: 1500 },
            { name: 'Van', code: 'VAN', seats: 8, baseDailyRate: 1800 }
        ],
        createdAt: new Date()
    },
    {
        category: 'Luxury',
        types: [
            { name: 'Mercedes', code: 'MERCEDES', seats: 5, baseDailyRate: 2500 },
            { name: 'BMW', code: 'BMW', seats: 5, baseDailyRate: 2500 },
            { name: 'Audi', code: 'AUDI', seats: 5, baseDailyRate: 2200 }
        ],
        createdAt: new Date()
    }
]);

print('[SEED] ✓ Seeded vehicle types (11 types)');

// ============================================================================
// SEED EMAIL TEMPLATES
// ============================================================================
print('[SEED] Seeding email templates...');

db.emailTemplates.insertMany([
    {
        templateId: 'booking_confirmation',
        name: 'Booking Confirmation',
        subject: 'Your Booking Confirmation - {{bookingId}}',
        body: 'Dear {{customerName}},\n\nYour booking has been confirmed!\n\nBooking Details:\n- Reference: {{bookingId}}\n- Vehicle: {{vehicleName}}\n- Start Date: {{startDate}}\n- End Date: {{endDate}}\n- Total Amount: {{totalAmount}}\n\nThank you for booking with FleetPro!',
        createdAt: new Date(),
        enabled: true
    },
    {
        templateId: 'booking_cancelled',
        name: 'Booking Cancellation',
        subject: 'Booking Cancelled - {{bookingId}}',
        body: 'Dear {{customerName}},\n\nYour booking has been cancelled.\n\nBooking Reference: {{bookingId}}\nRefund Amount: {{refundAmount}}\nRefund Status: {{refundStatus}}\n\nIf you have any questions, please contact our support team.',
        createdAt: new Date(),
        enabled: true
    },
    {
        templateId: 'payment_receipt',
        name: 'Payment Receipt',
        subject: 'Payment Receipt - {{transactionId}}',
        body: 'Dear {{customerName}},\n\nThank you for your payment!\n\nTransaction Details:\n- Transaction ID: {{transactionId}}\n- Amount: {{amount}}\n- Date: {{date}}\n- Method: {{method}}\n\nKeep this receipt for your records.',
        createdAt: new Date(),
        enabled: true
    },
    {
        templateId: 'reminder_upcoming_booking',
        name: 'Upcoming Booking Reminder',
        subject: 'Reminder: Your Booking Starts Tomorrow',
        body: 'Dear {{customerName}},\n\nThis is a reminder that your booking starts tomorrow!\n\n- Vehicle: {{vehicleName}}\n- Pickup: {{startDate}} at {{pickupTime}}\n- Location: {{pickupLocation}}\n\nPlease arrive 15 minutes early.',
        createdAt: new Date(),
        enabled: true
    },
    {
        templateId: 'invoice',
        name: 'Invoice',
        subject: 'Invoice - {{invoiceNumber}}',
        body: 'Please find attached your invoice for booking {{bookingId}}.',
        createdAt: new Date(),
        enabled: true
    }
]);

print('[SEED] ✓ Seeded email templates (5 templates)');

// ============================================================================
// SEED SMS TEMPLATES
// ============================================================================
print('[SEED] Seeding SMS templates...');

db.smsTemplates.insertMany([
    {
        templateId: 'booking_sms',
        name: 'Booking Confirmation SMS',
        content: 'Hi {{customerName}}, your FleetPro booking {{bookingId}} is confirmed. Vehicle: {{vehicleName}}. Start: {{startDate}}. Amount: {{amount}}.',
        createdAt: new Date(),
        enabled: true
    },
    {
        templateId: 'otp_sms',
        name: 'OTP Verification',
        content: 'Your FleetPro verification code is {{otp}}. Valid for 10 minutes. Do not share this code.',
        createdAt: new Date(),
        enabled: true
    },
    {
        templateId: 'payment_sms',
        name: 'Payment Confirmation',
        content: 'Payment of {{amount}} received for booking {{bookingId}}. Thank you!',
        createdAt: new Date(),
        enabled: true
    }
]);

print('[SEED] ✓ Seeded SMS templates (3 templates)');

// ============================================================================
// SEED NOTIFICATION TEMPLATES
// ============================================================================
print('[SEED] Seeding notification templates...');

db.notificationTemplates.insertMany([
    {
        templateId: 'booking_created',
        name: 'Booking Created',
        title: 'Booking Confirmed',
        description: 'Your booking {{bookingId}} has been created successfully.',
        icon: 'check-circle',
        priority: 'high',
        createdAt: new Date(),
        enabled: true
    },
    {
        templateId: 'payment_due',
        name: 'Payment Due',
        title: 'Payment Due Reminder',
        description: 'Payment of {{amount}} is due for booking {{bookingId}}. Please pay by {{dueDate}}.',
        icon: 'alert-circle',
        priority: 'high',
        createdAt: new Date(),
        enabled: true
    },
    {
        templateId: 'booking_reminder',
        name: 'Booking Reminder',
        title: 'Your Trip is Starting Soon',
        description: 'Your booking {{bookingId}} starts in {{hoursRemaining}} hours. Arrive 15 minutes early.',
        icon: 'clock',
        priority: 'medium',
        createdAt: new Date(),
        enabled: true
    }
]);

print('[SEED] ✓ Seeded notification templates (3 templates)');

// ============================================================================
// SEED PRICING RULES
// ============================================================================
print('[SEED] Seeding pricing rules...');

db.pricingRules.insertMany([
    {
        name: 'Weekday Discount',
        description: '15% discount for bookings Monday-Thursday',
        discountPercentage: 15,
        applicableDays: ['MON', 'TUE', 'WED', 'THU'],
        minDays: 1,
        enabled: true,
        createdAt: new Date()
    },
    {
        name: 'Long Term Discount',
        description: '20% discount for bookings 7+ days',
        discountPercentage: 20,
        minDays: 7,
        enabled: true,
        createdAt: new Date()
    },
    {
        name: 'Monthly Discount',
        description: '30% discount for monthly rentals (30+ days)',
        discountPercentage: 30,
        minDays: 30,
        enabled: true,
        createdAt: new Date()
    },
    {
        name: 'Early Booking Discount',
        description: '10% discount for bookings made 14+ days in advance',
        discountPercentage: 10,
        daysInAdvance: 14,
        enabled: true,
        createdAt: new Date()
    }
]);

print('[SEED] ✓ Seeded pricing rules (4 rules)');

// ============================================================================
// SEED RENTAL LOCATIONS
// ============================================================================
print('[SEED] Seeding rental locations...');

db.rentalLocations.insertMany([
    {
        name: 'Mumbai Downtown',
        code: 'MBD',
        address: 'Bandra, Mumbai',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
        phone: '+91-22-1234-5678',
        email: 'mumbai@fleetpro.com',
        operatingHours: {
            mon: { open: '08:00', close: '22:00' },
            tue: { open: '08:00', close: '22:00' },
            wed: { open: '08:00', close: '22:00' },
            thu: { open: '08:00', close: '22:00' },
            fri: { open: '08:00', close: '22:00' },
            sat: { open: '09:00', close: '21:00' },
            sun: { open: '09:00', close: '21:00' }
        },
        isActive: true,
        createdAt: new Date()
    },
    {
        name: 'Bangalore Tech Park',
        code: 'BTP',
        address: 'Whitefield, Bangalore',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560066',
        phone: '+91-80-1234-5678',
        email: 'bangalore@fleetpro.com',
        operatingHours: {
            mon: { open: '08:00', close: '22:00' },
            tue: { open: '08:00', close: '22:00' },
            wed: { open: '08:00', close: '22:00' },
            thu: { open: '08:00', close: '22:00' },
            fri: { open: '08:00', close: '22:00' },
            sat: { open: '09:00', close: '21:00' },
            sun: { open: '09:00', close: '21:00' }
        },
        isActive: true,
        createdAt: new Date()
    },
    {
        name: 'Delhi Airport Express',
        code: 'DAE',
        address: 'Indira Gandhi International Airport',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110037',
        phone: '+91-11-1234-5678',
        email: 'delhi@fleetpro.com',
        operatingHours: {
            mon: { open: '06:00', close: '23:00' },
            tue: { open: '06:00', close: '23:00' },
            wed: { open: '06:00', close: '23:00' },
            thu: { open: '06:00', close: '23:00' },
            fri: { open: '06:00', close: '23:00' },
            sat: { open: '06:00', close: '23:00' },
            sun: { open: '06:00', close: '23:00' }
        },
        isActive: true,
        createdAt: new Date()
    }
]);

print('[SEED] ✓ Seeded rental locations (3 locations)');

// ============================================================================
// SEED USER ROLES & PERMISSIONS
// ============================================================================
print('[SEED] Seeding user roles and permissions...');

db.roles.insertMany([
    {
        name: 'Admin',
        description: 'Full system access',
        permissions: ['*'],
        createdAt: new Date()
    },
    {
        name: 'Manager',
        description: 'Manager role with operational access',
        permissions: [
            'view_bookings',
            'manage_bookings',
            'view_vehicles',
            'manage_vehicles',
            'view_drivers',
            'manage_drivers',
            'view_payments',
            'view_reports',
            'manage_notifications',
            'view_analytics'
        ],
        createdAt: new Date()
    },
    {
        name: 'Driver',
        description: 'Driver role',
        permissions: [
            'view_own_bookings',
            'view_own_vehicle',
            'update_location',
            'report_issues',
            'view_earnings'
        ],
        createdAt: new Date()
    },
    {
        name: 'Customer',
        description: 'Customer role',
        permissions: [
            'create_booking',
            'view_own_bookings',
            'cancel_own_booking',
            'make_payment',
            'view_history',
            'track_vehicle'
        ],
        createdAt: new Date()
    }
]);

print('[SEED] ✓ Seeded user roles (4 roles)');

// ============================================================================
// SEED SAMPLE REPORTS CONFIGURATION
// ============================================================================
print('[SEED] Seeding report configurations...');

db.reportConfigs.insertMany([
    {
        name: 'Daily Bookings Summary',
        description: 'Summary of daily bookings and revenue',
        type: 'daily',
        metrics: ['total_bookings', 'total_revenue', 'completed_bookings', 'cancelled_bookings'],
        recipients: ['admin@fleetpro.com'],
        schedule: '0 9 * * *',
        enabled: true,
        createdAt: new Date()
    },
    {
        name: 'Weekly Performance Report',
        description: 'Weekly fleet performance metrics',
        type: 'weekly',
        metrics: ['fleet_utilization', 'revenue', 'maintenance_issues', 'customer_satisfaction'],
        recipients: ['admin@fleetpro.com', 'manager@fleetpro.com'],
        schedule: '0 9 * * MON',
        enabled: true,
        createdAt: new Date()
    },
    {
        name: 'Monthly Financial Report',
        description: 'Monthly financial summary and analysis',
        type: 'monthly',
        metrics: ['total_revenue', 'operating_costs', 'profit', 'customer_acquisition'],
        recipients: ['admin@fleetpro.com', 'cfo@fleetpro.com'],
        schedule: '0 9 1 * *',
        enabled: true,
        createdAt: new Date()
    }
]);

print('[SEED] ✓ Seeded report configurations (3 reports)');

// ============================================================================
// SEED SYSTEM ALERTS
// ============================================================================
print('[SEED] Seeding system alert rules...');

db.alertRules.insertMany([
    {
        name: 'High maintenance cost',
        description: 'Alert when vehicle maintenance exceeds threshold',
        condition: 'maintenance_cost > 5000',
        severity: 'high',
        recipient: 'admin@fleetpro.com',
        enabled: true,
        createdAt: new Date()
    },
    {
        name: 'Vehicle not available',
        description: 'Alert when vehicle is not available for bookings',
        condition: 'vehicle_status = inactive',
        severity: 'medium',
        recipient: 'manager@fleetpro.com',
        enabled: true,
        createdAt: new Date()
    },
    {
        name: 'Low payment collection',
        description: 'Alert when daily payment collection is low',
        condition: 'daily_payment < 10000',
        severity: 'low',
        recipient: 'admin@fleetpro.com',
        enabled: true,
        createdAt: new Date()
    }
]);

print('[SEED] ✓ Seeded alert rules (3 rules)');

// ============================================================================
// DATABASE STATISTICS
// ============================================================================
print('[SEED] ============================================');
print('[SEED] Production Data Seeding Complete');
print('[SEED] ============================================');
print('[SEED] Collections seeded: 10');
print('[SEED] Documents created: 50+');
print('[SEED] Configuration items: 11');
print('[SEED] Email templates: 5');
print('[SEED] SMS templates: 3');
print('[SEED] Notification templates: 3');
print('[SEED] Pricing rules: 4');
print('[SEED] Rental locations: 3');
print('[SEED] User roles: 4');
print('[SEED] Report configs: 3');
print('[SEED] Alert rules: 3');
print('[SEED] Status: READY FOR BUSINESS OPERATIONS');
print('[SEED] ============================================');
print('[SEED] Next Steps:');
print('[SEED] 1. Migrate customer data using secure ETL process');
print('[SEED] 2. Verify all template content');
print('[SEED] 3. Configure actual API keys and credentials');
print('[SEED] 4. Run smoke tests on all features');
print('[SEED] ============================================');
