#!/usr/bin/env node

/**
 * MongoDB Backup Script using Node.js with ES6 modules
 * Exports all collections from MongoDB as JSON
 */

import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = '/Users/pradeep/fleetpro-backups';
const DB_URI = 'mongodb://127.0.0.1:27017/fleetpro';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                  new Date().toTimeString().split(' ')[0].replace(/:/g, '');
const BACKUP_PATH = path.join(BACKUP_DIR, `backup_${TIMESTAMP}`);

async function backupDatabase() {
    let client;
    const startTime = new Date();

    try {
        console.log(`[${new Date().toISOString()}] Starting MongoDB backup...`);

        // Create backup directory
        fs.mkdirSync(BACKUP_PATH, { recursive: true });

        // Connect to MongoDB
        client = new MongoClient(DB_URI, {
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 30000
        });

        await client.connect();
        console.log(`[${new Date().toISOString()}] Connected to MongoDB`);

        // Get the database
        const db = client.db('fleetpro');
        const adminDb = client.db('admin');

        // Get server info
        const serverStatus = await adminDb.admin().serverStatus().catch(() => ({}));
        console.log(`[${new Date().toISOString()}] MongoDB Version: ${serverStatus.version || 'Unknown'}`);

        // Get all collections
        const collections = await db.listCollections().toArray();
        console.log(`[${new Date().toISOString()}] Found ${collections.length} collections to backup`);

        let totalDocs = 0;

        // Backup each collection
        for (const collInfo of collections) {
            const collName = collInfo.name;
            const collection = db.collection(collName);

            try {
                // Count documents
                const count = await collection.countDocuments();
                totalDocs += count;

                // Export collection data
                const docs = await collection.find({}).toArray();

                // Save as BSON-like JSON (MongoDB Extended JSON format)
                const backupFile = path.join(BACKUP_PATH, `${collName}.json`);
                fs.writeFileSync(backupFile, JSON.stringify(docs, null, 2));

                console.log(`[${new Date().toISOString()}] Backed up ${collName}: ${count} documents`);
            } catch (err) {
                console.error(`[${new Date().toISOString()}] Error backing up ${collName}: ${err.message}`);
            }
        }

        // Save backup metadata
        const metadata = {
            timestamp: new Date().toISOString(),
            database: 'fleetpro',
            uri: DB_URI.replace(/:\/\/.*@/, '://***:***@'),
            collectionsCount: collections.length,
            documentsCount: totalDocs,
            backupPath: BACKUP_PATH
        };

        fs.writeFileSync(
            path.join(BACKUP_PATH, 'backup_metadata.json'),
            JSON.stringify(metadata, null, 2)
        );

        const duration = ((new Date() - startTime) / 1000).toFixed(2);
        console.log(`[${new Date().toISOString()}] Backup complete: ${BACKUP_PATH}`);
        console.log(`[${new Date().toISOString()}] Total documents: ${totalDocs}, Duration: ${duration}s`);

        // Cleanup old backups (keep last 30)
        cleanupOldBackups();

        process.exit(0);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Backup failed: ${err.message}`);
        console.error(err);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

function cleanupOldBackups() {
    try {
        console.log(`[${new Date().toISOString()}] Cleaning up old backups...`);

        const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory() && d.name.startsWith('backup_'))
            .map(d => ({
                name: d.name,
                time: fs.statSync(path.join(BACKUP_DIR, d.name)).mtime
            }))
            .sort((a, b) => b.time - a.time);

        if (entries.length > 30) {
            const toDelete = entries.slice(30);
            for (const backup of toDelete) {
                const backupPath = path.join(BACKUP_DIR, backup.name);
                fs.rmSync(backupPath, { recursive: true, force: true });
                console.log(`[${new Date().toISOString()}] Removed old backup: ${backup.name}`);
            }
        }

        console.log(`[${new Date().toISOString()}] Cleanup complete. Total backups kept: ${Math.min(entries.length, 30)}`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Cleanup failed: ${err.message}`);
    }
}

backupDatabase();
