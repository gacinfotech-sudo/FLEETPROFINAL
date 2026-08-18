import { promises as fs } from 'fs';
import path from 'path';

export interface BackupMetadata {
  id: string;
  timestamp: number;
  database: string;
  collections: number;
  size: number;
  status: 'success' | 'failed' | 'in-progress';
  duration: number;
  retention: number; // days
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron expression
  retention: number; // days
  maxBackups: number;
  location: string; // backup directory
  compression: boolean;
}

export class BackupManager {
  private backups: Map<string, BackupMetadata> = new Map();
  private isBackupInProgress = false;
  private config: BackupConfig;
  private backupDir: string;

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = {
      enabled: true,
      schedule: '0 2 * * *', // 2 AM daily
      retention: 30, // 30 days
      maxBackups: 10,
      location: process.env.BACKUP_DIR || '/var/backups/fleetpro',
      compression: true,
      ...config
    };
    this.backupDir = this.config.location;
  }

  async initializeBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'metadata'), { recursive: true });
      console.log(`✅ Backup directory initialized: ${this.backupDir}`);
    } catch (error) {
      console.error('❌ Failed to initialize backup directory:', error);
      throw error;
    }
  }

  async createBackup(database: string): Promise<BackupMetadata> {
    if (this.isBackupInProgress) {
      throw new Error('Backup already in progress');
    }

    this.isBackupInProgress = true;
    const startTime = Date.now();
    const backupId = `backup-${database}-${startTime}`;

    try {
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: startTime,
        database,
        collections: 0,
        size: 0,
        status: 'in-progress',
        duration: 0,
        retention: this.config.retention
      };

      // Simulate backup creation
      // In production: call mongodump or use MongoDB API
      await this.simulateBackup(metadata);

      metadata.status = 'success';
      metadata.duration = Date.now() - startTime;

      this.backups.set(backupId, metadata);
      await this.saveBackupMetadata(metadata);
      await this.enforceRetentionPolicy();

      return metadata;
    } catch (error) {
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: startTime,
        database,
        collections: 0,
        size: 0,
        status: 'failed',
        duration: Date.now() - startTime,
        retention: this.config.retention
      };
      
      this.backups.set(backupId, metadata);
      throw error;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  private async simulateBackup(metadata: BackupMetadata): Promise<void> {
    // In production, this would call mongodump
    // For now, simulate backup by creating metadata
    return new Promise((resolve) => {
      setTimeout(() => {
        metadata.collections = 87; // Known collection count
        metadata.size = Math.round(Math.random() * 500 * 1024 * 1024); // 0-500MB
        resolve();
      }, 1000);
    });
  }

  async restoreBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    console.log(`🔄 Starting restore from backup: ${backupId}`);
    // In production: call mongorestore with backup data
    console.log(`✅ Restore would execute: mongorestore --uri "mongodb://..." ${this.backupDir}/${backupId}`);
  }

  async enforceRetentionPolicy(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, metadata] of this.backups.entries()) {
      const ageInDays = (now - metadata.timestamp) / (1000 * 60 * 60 * 24);
      if (ageInDays > metadata.retention) {
        toDelete.push(id);
      }
    }

    // Keep max number of backups
    if (this.backups.size > this.config.maxBackups) {
      const sorted = Array.from(this.backups.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (let i = 0; i < sorted.length - this.config.maxBackups; i++) {
        toDelete.push(sorted[i][0]);
      }
    }

    for (const id of toDelete) {
      this.backups.delete(id);
      await this.deleteBackupData(id);
    }
  }

  private async deleteBackupData(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupId);
    try {
      await fs.rm(backupPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to delete backup data: ${backupId}`, error);
    }
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const metadataPath = path.join(this.backupDir, 'metadata', `${metadata.id}.json`);
    try {
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('Failed to save backup metadata:', error);
      throw error;
    }
  }

  async loadBackupMetadata(): Promise<void> {
    try {
      const metadataDir = path.join(this.backupDir, 'metadata');
      const files = await fs.readdir(metadataDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(metadataDir, file), 'utf-8');
          const metadata = JSON.parse(content) as BackupMetadata;
          this.backups.set(metadata.id, metadata);
        }
      }
    } catch (error) {
      console.warn('Failed to load backup metadata:', error);
    }
  }

  getBackups(): BackupMetadata[] {
    return Array.from(this.backups.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  getBackup(backupId: string): BackupMetadata | undefined {
    return this.backups.get(backupId);
  }

  getBackupStats() {
    const backups = this.getBackups();
    const successful = backups.filter(b => b.status === 'success');
    const totalSize = successful.reduce((sum, b) => sum + b.size, 0);

    return {
      total: backups.length,
      successful: successful.length,
      failed: backups.filter(b => b.status === 'failed').length,
      totalSize,
      averageSize: successful.length ? Math.round(totalSize / successful.length) : 0,
      oldestBackup: backups.length ? backups[backups.length - 1].timestamp : null,
      newestBackup: backups.length ? backups[0].timestamp : null,
      retention: this.config.retention,
      maxBackups: this.config.maxBackups
    };
  }
}
