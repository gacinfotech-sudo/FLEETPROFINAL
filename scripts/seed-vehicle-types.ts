import mongoose from 'mongoose';
import { VehicleType } from '../server/models';

const VEHICLE_CATALOG = [
  // 5 Seaters - Hatchback
  { category: '5 Seater', vehicleModel: 'Swift', seatingCapacity: 5, displayName: 'Swift – 5 Seater', sortOrder: 10, luxuryLevel: 'economy' },
  { category: '5 Seater', vehicleModel: 'Baleno', seatingCapacity: 5, displayName: 'Baleno – 5 Seater', sortOrder: 11, luxuryLevel: 'standard' },
  { category: '5 Seater', vehicleModel: 'Glanza', seatingCapacity: 5, displayName: 'Glanza – 5 Seater', sortOrder: 12, luxuryLevel: 'standard' },
  { category: '5 Seater', vehicleModel: 'WagonR', seatingCapacity: 5, displayName: 'WagonR – 5 Seater', sortOrder: 13, luxuryLevel: 'economy' },
  { category: '5 Seater', vehicleModel: 'i20', seatingCapacity: 5, displayName: 'i20 – 5 Seater', sortOrder: 14, luxuryLevel: 'standard' },

  // 5 Seaters - Sedan
  { category: '5 Seater Sedan', vehicleModel: 'Dzire', seatingCapacity: 5, displayName: 'Dzire – 5 Seater', sortOrder: 20, luxuryLevel: 'economy' },
  { category: '5 Seater Sedan', vehicleModel: 'Aura', seatingCapacity: 5, displayName: 'Aura – 5 Seater', sortOrder: 21, luxuryLevel: 'standard' },
  { category: '5 Seater Sedan', vehicleModel: 'Amaze', seatingCapacity: 5, displayName: 'Amaze – 5 Seater', sortOrder: 22, luxuryLevel: 'standard' },
  { category: '5 Seater Sedan', vehicleModel: 'Ciaz', seatingCapacity: 5, displayName: 'Ciaz – 5 Seater', sortOrder: 23, luxuryLevel: 'standard' },
  { category: '5 Seater Sedan', vehicleModel: 'Verna', seatingCapacity: 5, displayName: 'Verna – 5 Seater', sortOrder: 24, luxuryLevel: 'standard' },
  { category: '5 Seater Sedan', vehicleModel: 'City', seatingCapacity: 5, displayName: 'City – 5 Seater', sortOrder: 25, luxuryLevel: 'standard' },

  // 7 Seaters
  { category: '7 Seater', vehicleModel: 'Ertiga', seatingCapacity: 7, displayName: 'Ertiga – 7 Seater', sortOrder: 30, luxuryLevel: 'standard' },
  { category: '7 Seater', vehicleModel: 'Rumion', seatingCapacity: 7, displayName: 'Rumion – 7 Seater', sortOrder: 31, luxuryLevel: 'standard' },
  { category: '7 Seater', vehicleModel: 'Carens', seatingCapacity: 7, displayName: 'Carens – 7 Seater', sortOrder: 32, luxuryLevel: 'standard' },
  { category: '7 Seater', vehicleModel: 'Marazzo', seatingCapacity: 8, displayName: 'Marazzo – 7/8 Seater', sortOrder: 33, luxuryLevel: 'premium' },
  { category: '7 Seater', vehicleModel: 'Innova', seatingCapacity: 8, displayName: 'Innova – 7/8 Seater', sortOrder: 34, luxuryLevel: 'standard' },
  { category: '7 Seater', vehicleModel: 'Innova Crysta', seatingCapacity: 8, displayName: 'Innova Crysta – 7/8 Seater', sortOrder: 35, luxuryLevel: 'premium' },
  { category: '7 Seater', vehicleModel: 'Innova Hycross', seatingCapacity: 8, displayName: 'Innova Hycross – 7/8 Seater', sortOrder: 36, luxuryLevel: 'premium' },

  // SUVs
  { category: 'SUV', vehicleModel: 'Fortuner', seatingCapacity: 7, displayName: 'Fortuner – 7 Seater', sortOrder: 40, luxuryLevel: 'premium' },
  { category: 'SUV', vehicleModel: 'Scorpio', seatingCapacity: 7, displayName: 'Scorpio – 7 Seater', sortOrder: 41, luxuryLevel: 'standard' },
  { category: 'SUV', vehicleModel: 'Scorpio N', seatingCapacity: 7, displayName: 'Scorpio N – 7 Seater', sortOrder: 42, luxuryLevel: 'premium' },
  { category: 'SUV', vehicleModel: 'XUV700', seatingCapacity: 7, displayName: 'XUV700 – 7 Seater', sortOrder: 43, luxuryLevel: 'premium' },
  { category: 'SUV', vehicleModel: 'Thar', seatingCapacity: 4, displayName: 'Thar – 4 Seater', sortOrder: 44, luxuryLevel: 'premium' },

  // Tempo Travellers
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 9, displayName: 'Tempo Traveller – 9 Seater', sortOrder: 50 },
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 10, displayName: 'Tempo Traveller – 10 Seater', sortOrder: 51 },
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 12, displayName: 'Tempo Traveller – 12 Seater', sortOrder: 52 },
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 13, displayName: 'Tempo Traveller – 13 Seater', sortOrder: 53 },
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 14, displayName: 'Tempo Traveller – 14 Seater', sortOrder: 54 },
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 16, displayName: 'Tempo Traveller – 16 Seater', sortOrder: 55 },
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 17, displayName: 'Tempo Traveller – 17 Seater', sortOrder: 56 },
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 18, displayName: 'Tempo Traveller – 18 Seater', sortOrder: 57 },
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 20, displayName: 'Tempo Traveller – 20 Seater', sortOrder: 58 },
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 22, displayName: 'Tempo Traveller – 22 Seater', sortOrder: 59 },
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 25, displayName: 'Tempo Traveller – 25 Seater', sortOrder: 60 },
  { category: 'Tempo Traveller', vehicleModel: 'Tempo Traveller', seatingCapacity: 26, displayName: 'Tempo Traveller – 26 Seater', sortOrder: 61 },

  // Force Urbania
  { category: 'Mini Bus', vehicleModel: 'Force Urbania', seatingCapacity: 10, displayName: 'Force Urbania – 10 Seater', sortOrder: 70 },
  { category: 'Mini Bus', vehicleModel: 'Force Urbania', seatingCapacity: 12, displayName: 'Force Urbania – 12 Seater', sortOrder: 71 },
  { category: 'Mini Bus', vehicleModel: 'Force Urbania', seatingCapacity: 13, displayName: 'Force Urbania – 13 Seater', sortOrder: 72 },
  { category: 'Mini Bus', vehicleModel: 'Force Urbania', seatingCapacity: 17, displayName: 'Force Urbania – 17 Seater', sortOrder: 73 },

  // Mini Buses
  { category: 'Mini Bus', vehicleModel: 'Mini Bus', seatingCapacity: 20, displayName: 'Mini Bus – 20 Seater', sortOrder: 80 },
  { category: 'Mini Bus', vehicleModel: 'Mini Bus', seatingCapacity: 22, displayName: 'Mini Bus – 22 Seater', sortOrder: 81 },
  { category: 'Mini Bus', vehicleModel: 'Mini Bus', seatingCapacity: 26, displayName: 'Mini Bus – 26 Seater', sortOrder: 82 },
  { category: 'Mini Bus', vehicleModel: 'Mini Bus', seatingCapacity: 27, displayName: 'Mini Bus – 27 Seater', sortOrder: 83 },
  { category: 'Mini Bus', vehicleModel: 'Mini Bus', seatingCapacity: 32, displayName: 'Mini Bus – 32 Seater', sortOrder: 84 },
  { category: 'Mini Bus', vehicleModel: 'Mini Bus', seatingCapacity: 35, displayName: 'Mini Bus – 35 Seater', sortOrder: 85 },

  // Buses
  { category: 'Bus', vehicleModel: 'Bus', seatingCapacity: 40, displayName: 'Bus – 40 Seater', sortOrder: 90 },
  { category: 'Bus', vehicleModel: 'Bus', seatingCapacity: 45, displayName: 'Bus – 45 Seater', sortOrder: 91 },
  { category: 'Bus', vehicleModel: 'Bus', seatingCapacity: 49, displayName: 'Bus – 49 Seater', sortOrder: 92 },
  { category: 'Bus', vehicleModel: 'Bus', seatingCapacity: 50, displayName: 'Bus – 50 Seater', sortOrder: 93 },
  { category: 'Bus', vehicleModel: 'Bus', seatingCapacity: 52, displayName: 'Bus – 52 Seater', sortOrder: 94 },

  // Luxury/Other
  { category: 'Luxury', vehicleModel: 'Luxury Sedan', seatingCapacity: 5, displayName: 'Luxury Sedan', sortOrder: 100, luxuryLevel: 'luxury' },
  { category: 'Luxury', vehicleModel: 'Luxury SUV', seatingCapacity: 7, displayName: 'Luxury SUV', sortOrder: 101, luxuryLevel: 'luxury' },
  { category: 'Luxury', vehicleModel: 'Luxury Van', seatingCapacity: 8, displayName: 'Luxury Van', sortOrder: 102, luxuryLevel: 'luxury' },
  { category: 'Other', vehicleModel: 'Custom Vehicle', seatingCapacity: 0, displayName: 'Custom Vehicle', sortOrder: 110 },
];

async function seedVehicleTypes() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const tenantId = process.env.TENANT_ID || new mongoose.Types.ObjectId('000000000000000000000001');
    console.log(`Seeding vehicle types for tenant: ${tenantId}`);

    await VehicleType.deleteMany({ tenantId });
    console.log('Cleared existing vehicle types');

    const toInsert = VEHICLE_CATALOG.map(v => ({
      ...v,
      tenantId,
      isActive: true,
      acStatus: 'ac' as const,
    }));

    const result = await VehicleType.insertMany(toInsert);
    console.log(`✅ Seeded ${result.length} vehicle types`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedVehicleTypes();
