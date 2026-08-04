import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Connect to MongoDB.
 *
 * SECURITY / STABILITY (P0): previously this function swallowed connection
 * failures and let the app boot anyway with a misleading "falling back to
 * in-memory storage" message — there is no in-memory storage implementation,
 * so every request would have failed at runtime instead of failing fast at
 * startup. In production we now exit the process on a fatal connection
 * failure so orchestration (systemd/Docker/PM2/host platform) can restart
 * or alert. In development we retry a few times before giving up, to allow
 * for the DB coming up slightly after the app during local `docker compose`
 * style workflows.
 */
const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.error('❌ MONGODB_URI is not defined in environment variables');
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  const maxAttempts = process.env.NODE_ENV === 'production' ? 5 : 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      console.log(`🔗 Connecting to MongoDB (attempt ${attempt}/${maxAttempts})...`);

      const conn = await mongoose.connect(mongoURI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        bufferCommands: false
      });

      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      console.log(`📊 Database: ${conn.connection.name}`);

      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
      });

      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed due to app termination');
        process.exit(0);
      });

      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ MongoDB connection failed (attempt ${attempt}/${maxAttempts}): ${message}`);

      if (message.includes('IP')) {
        console.error('\n🔧 QUICK FIX: MongoDB Atlas IP Access Configuration');
        console.error('1. Go to https://cloud.mongodb.com');
        console.error('2. Select your project → Network Access');
        console.error('3. Click "Add IP Address" and allow your deployment host');
        console.error('4. Wait 1-2 minutes for changes to apply\n');
      }

      if (attempt >= maxAttempts) {
        console.error('❌ FATAL: Could not connect to MongoDB after multiple attempts. Exiting.');
        process.exit(1);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
};

export default connectDB;