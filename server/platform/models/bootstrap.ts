// STEP 10: Platform Bootstrap
// Initialize collections, indexes, and seed default data

import { Subscription } from './Subscription';
import { PlatformInvoice } from './PlatformInvoice';
import { PlatformPayment } from './PlatformPayment';
import { SupportTicket } from './SupportTicket';
import { AuditLog } from './AuditLog';
import { Plan } from './Plan';
import { PlatformCompany } from './PlatformCompany';

export async function bootstrapPlatformCollections() {
  console.log('🚀 Bootstrapping Platform collections...');

  try {
    // Create collections and indexes
    await Promise.all([
      Subscription.collection.createIndexes(),
      PlatformInvoice.collection.createIndexes(),
      PlatformPayment.collection.createIndexes(),
      SupportTicket.collection.createIndexes(),
      AuditLog.collection.createIndexes()
    ]);

    console.log('✅ Collection indexes created');

    // Seed default plans (if not exist)
    const starterPlan = await Plan.findOne({ name: 'Starter' });
    if (!starterPlan) {
      await Plan.insertMany([
        {
          name: 'Starter',
          description: 'Perfect for small fleets',
          monthlyPrice: 3000,
          tax: 540,  // 18% GST
          features: {
            userLimit: 5,
            driverLimit: 20,
            vehicleLimit: 10,
            customBranding: false,
            apiAccess: false,
            mobileApp: false
          },
          isActive: true,
          createdAt: new Date()
        },
        {
          name: 'Pro',
          description: 'For growing operations',
          monthlyPrice: 8000,
          tax: 1440,
          features: {
            userLimit: 20,
            driverLimit: 100,
            vehicleLimit: 50,
            customBranding: true,
            apiAccess: true,
            mobileApp: true
          },
          isActive: true,
          createdAt: new Date()
        },
        {
          name: 'Enterprise',
          description: 'Custom solutions',
          monthlyPrice: 20000,
          tax: 3600,
          features: {
            userLimit: 999,
            driverLimit: 999,
            vehicleLimit: 999,
            customBranding: true,
            apiAccess: true,
            mobileApp: true
          },
          isActive: true,
          createdAt: new Date()
        }
      ]);
      console.log('✅ Default plans seeded');
    }

    // Initialize Platform Company profile (if not exist)
    const company = await PlatformCompany.findOne({});
    if (!company) {
      await PlatformCompany.create({
        name: 'FleetPro SaaS',
        legalName: 'FleetPro Technologies Pvt Ltd',
        email: 'support@fleetpro.com',
        website: 'https://fleetpro.com',
        address: 'Bangalore, India',
        gst: 'GST_NUMBER_HERE',
        pan: 'PAN_NUMBER_HERE',
        createdAt: new Date()
      });
      console.log('✅ Platform company profile initialized');
    }

    console.log('✅ Platform database initialization complete');
  } catch (error) {
    console.error('❌ Platform bootstrap failed:', error);
    throw error;
  }
}
