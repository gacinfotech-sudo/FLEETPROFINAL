// Migration: Add provider_config collection for email and SMS provider configuration
import mongoose from 'mongoose';

export async function up(db: mongoose.mongo.Db): Promise<void> {
  try {
    // Create provider_config collection
    await db.createCollection('provider_configs');

    // Create indexes
    await db.collection('provider_configs').createIndex({ provider: 1 }, { unique: true });
    await db.collection('provider_configs').createIndex({ type: 1 });
    await db.collection('provider_configs').createIndex({ updatedAt: 1 });

    console.log('✓ provider_configs collection created successfully');
  } catch (error: any) {
    if (error.codeName === 'NamespaceExists') {
      console.log('✓ provider_configs collection already exists');
    } else {
      throw error;
    }
  }
}

export async function down(db: mongoose.mongo.Db): Promise<void> {
  try {
    await db.collection('provider_configs').drop();
    console.log('✓ provider_configs collection dropped');
  } catch (error: any) {
    if (error.codeName === 'ns not found') {
      console.log('✓ provider_configs collection not found');
    } else {
      throw error;
    }
  }
}
