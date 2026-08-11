// Migration: Add delivery_attempts collection for tracking email and SMS delivery attempts
import mongoose from 'mongoose';

export async function up(db: mongoose.mongo.Db): Promise<void> {
  try {
    // Create delivery_attempts collection
    await db.createCollection('delivery_attempts');

    // Create indexes for performance
    await db.collection('delivery_attempts').createIndex({ notificationId: 1 });
    await db.collection('delivery_attempts').createIndex({ messageId: 1 }, { unique: true });
    await db.collection('delivery_attempts').createIndex({ userId: 1 });
    await db.collection('delivery_attempts').createIndex({ channel: 1 });
    await db.collection('delivery_attempts').createIndex({ status: 1 });
    await db.collection('delivery_attempts').createIndex({ provider: 1 });
    await db.collection('delivery_attempts').createIndex({ createdAt: 1 });
    await db.collection('delivery_attempts').createIndex({ sentAt: 1 });

    // TTL index: auto-delete records after 90 days
    await db.collection('delivery_attempts').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 7776000 } // 90 days
    );

    console.log('✓ delivery_attempts collection created successfully');
  } catch (error: any) {
    if (error.codeName === 'NamespaceExists') {
      console.log('✓ delivery_attempts collection already exists');
    } else {
      throw error;
    }
  }
}

export async function down(db: mongoose.mongo.Db): Promise<void> {
  try {
    await db.collection('delivery_attempts').drop();
    console.log('✓ delivery_attempts collection dropped');
  } catch (error: any) {
    if (error.codeName === 'ns not found') {
      console.log('✓ delivery_attempts collection not found');
    } else {
      throw error;
    }
  }
}
