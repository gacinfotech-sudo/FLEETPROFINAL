import { CronJob } from 'cron';
import { BackupManager, BackupConfig } from './backup-manager';

export interface BackupScheduleConfig {
  enabled: boolean;
  databases: string[];
  schedule: string; // cron expression
  maxConcurrent: number;
  notifyOnFailure: boolean;
}

export class BackupScheduler {
  private backupManager: BackupManager;
  private jobs: Map<string, CronJob> = new Map();
  private config: BackupScheduleConfig;
  private backupHistory: Array<{ time: number; database: string; success: boolean; error?: string }> = [];

  constructor(backupConfig: Partial<BackupConfig>, scheduleConfig: Partial<BackupScheduleConfig>) {
    this.backupManager = new BackupManager(backupConfig);
    this.config = {
      enabled: true,
      databases: ['fleetpro'],
      schedule: '0 2 * * *', // 2 AM daily
      maxConcurrent: 1,
      notifyOnFailure: true,
      ...scheduleConfig
    };
  }

  async initialize(): Promise<void> {
    await this.backupManager.initializeBackupDirectory();
    await this.backupManager.loadBackupMetadata();
    
    if (this.config.enabled) {
      this.startScheduledBackups();
    }

    console.log('✅ Backup scheduler initialized');
  }

  private startScheduledBackups(): void {
    for (const database of this.config.databases) {
      const jobId = `backup-${database}`;
      
      const job = new CronJob(
        this.config.schedule,
        async () => {
          console.log(`🔄 Starting scheduled backup for database: ${database}`);
          try {
            const backup = await this.backupManager.createBackup(database);
            this.backupHistory.push({
              time: Date.now(),
              database,
              success: true
            });
            console.log(`✅ Backup completed: ${backup.id}`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.backupHistory.push({
              time: Date.now(),
              database,
              success: false,
              error: errorMsg
            });
            console.error(`❌ Backup failed for ${database}:`, errorMsg);
            
            if (this.config.notifyOnFailure) {
              this.notifyFailure(database, errorMsg);
            }
          }
        },
        null,
        true // start immediately
      );

      this.jobs.set(jobId, job);
      console.log(`📅 Scheduled backup for ${database}: ${this.config.schedule}`);
    }
  }

  private notifyFailure(database: string, error: string): void {
    console.warn(`⚠️  Backup failure notification: Database=${database}, Error=${error}`);
    // In production: send to Slack, email, PagerDuty, etc.
  }

  async triggerBackupNow(database: string): Promise<void> {
    try {
      console.log(`🔄 Triggering immediate backup for: ${database}`);
      const backup = await this.backupManager.createBackup(database);
      this.backupHistory.push({
        time: Date.now(),
        database,
        success: true
      });
      console.log(`✅ Immediate backup completed: ${backup.id}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.backupHistory.push({
        time: Date.now(),
        database,
        success: false,
        error: errorMsg
      });
      throw error;
    }
  }

  stop(): void {
    for (const [jobId, job] of this.jobs.entries()) {
      job.stop();
      console.log(`⏹️  Stopped backup job: ${jobId}`);
    }
    this.jobs.clear();
  }

  getBackupSchedule() {
    return {
      enabled: this.config.enabled,
      schedule: this.config.schedule,
      databases: this.config.databases,
      nextRun: this.jobs.size > 0 
        ? Array.from(this.jobs.values())[0].nextDate?.toISOString() 
        : null,
      maxConcurrent: this.config.maxConcurrent,
      notifyOnFailure: this.config.notifyOnFailure
    };
  }

  getBackupStatus() {
    const stats = this.backupManager.getBackupStats();
    const recentHistory = this.backupHistory.slice(-10);
    const failureRate = recentHistory.length > 0 
      ? Math.round((recentHistory.filter(h => !h.success).length / recentHistory.length) * 100)
      : 0;

    return {
      schedule: this.getBackupSchedule(),
      stats,
      recentBackups: this.backupManager.getBackups().slice(0, 5),
      recentHistory,
      failureRate
    };
  }

  enableSchedule(): void {
    this.config.enabled = true;
    this.startScheduledBackups();
    console.log('✅ Backup schedule enabled');
  }

  disableSchedule(): void {
    this.config.enabled = false;
    this.stop();
    console.log('⏹️  Backup schedule disabled');
  }

  updateSchedule(newSchedule: string): void {
    this.stop();
    this.config.schedule = newSchedule;
    if (this.config.enabled) {
      this.startScheduledBackups();
    }
    console.log(`📅 Backup schedule updated to: ${newSchedule}`);
  }
}
