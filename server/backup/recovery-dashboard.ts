import { Router } from 'express';
import { BackupManager } from './backup-manager';
import { BackupScheduler } from './backup-scheduler';
import { RecoveryProcedures } from './recovery-procedures';

export class RecoveryDashboard {
  constructor(
    private backupManager: BackupManager,
    private backupScheduler: BackupScheduler,
    private recoveryProcedures: RecoveryProcedures
  ) {}

  createRouter() {
    const router = Router();

    // Get backup status
    router.get('/backups', (req, res) => {
      try {
        const backups = this.backupManager.getBackups();
        const stats = this.backupManager.getBackupStats();
        res.json({
          backups: backups.slice(0, 20),
          stats,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get backup status' });
      }
    });

    // Get specific backup
    router.get('/backups/:id', (req, res) => {
      try {
        const backup = this.backupManager.getBackup(req.params.id);
        if (!backup) {
          return res.status(404).json({ error: 'Backup not found' });
        }
        res.json(backup);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get backup' });
      }
    });

    // Trigger immediate backup
    router.post('/backups/trigger', async (req, res) => {
      try {
        const database = req.body.database || 'fleetpro';
        await this.backupScheduler.triggerBackupNow(database);
        res.json({ success: true, message: 'Backup triggered' });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: errorMsg });
      }
    });

    // Get backup schedule
    router.get('/schedule', (req, res) => {
      try {
        const schedule = this.backupScheduler.getBackupSchedule();
        res.json(schedule);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get schedule' });
      }
    });

    // Update backup schedule
    router.post('/schedule', (req, res) => {
      try {
        const { cronExpression } = req.body;
        if (!cronExpression) {
          return res.status(400).json({ error: 'cronExpression required' });
        }
        this.backupScheduler.updateSchedule(cronExpression);
        res.json({ success: true, schedule: cronExpression });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update schedule' });
      }
    });

    // Get backup status summary
    router.get('/status', (req, res) => {
      try {
        const backupStatus = this.backupScheduler.getBackupStatus();
        const recoveryTestStatus = this.recoveryProcedures.getTestStatus();
        
        res.json({
          backup: backupStatus,
          recovery: recoveryTestStatus,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get status' });
      }
    });

    // Get recovery procedures
    router.get('/procedures', (req, res) => {
      try {
        const procedures = this.recoveryProcedures.getAllProcedures();
        const testStatus = this.recoveryProcedures.getTestStatus();
        
        res.json({
          procedures,
          testStatus,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get procedures' });
      }
    });

    // Get specific procedure
    router.get('/procedures/:id', (req, res) => {
      try {
        const procedure = this.recoveryProcedures.getProcedure(req.params.id);
        if (!procedure) {
          return res.status(404).json({ error: 'Procedure not found' });
        }
        
        const validation = this.recoveryProcedures.validateProcedure(req.params.id);
        res.json({
          procedure,
          validation,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get procedure' });
      }
    });

    // Mark procedure as tested
    router.post('/procedures/:id/test', (req, res) => {
      try {
        this.recoveryProcedures.markAsTested(req.params.id);
        res.json({ success: true, message: 'Procedure marked as tested' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to mark as tested' });
      }
    });

    // Complete recovery dashboard
    router.get('/dashboard', (req, res) => {
      try {
        const backupStatus = this.backupScheduler.getBackupStatus();
        const recoveryStatus = this.recoveryProcedures.getTestStatus();
        
        const isHealthy = 
          backupStatus.stats.successful > 0 &&
          backupStatus.failureRate < 10 &&
          recoveryStatus.coverage === '100%';

        res.json({
          timestamp: Date.now(),
          health: isHealthy ? 'healthy' : 'at-risk',
          backup: backupStatus,
          recovery: recoveryStatus,
          recommendations: this.getRecommendations(backupStatus, recoveryStatus)
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get dashboard' });
      }
    });

    return router;
  }

  private getRecommendations(backupStatus: any, recoveryStatus: any): string[] {
    const recommendations: string[] = [];

    if (backupStatus.failureRate > 5) {
      recommendations.push('High backup failure rate - investigate backup logs');
    }

    if (!backupStatus.stats.newestBackup || 
        (Date.now() - backupStatus.stats.newestBackup) > 25 * 60 * 60 * 1000) {
      recommendations.push('No recent backup - trigger manual backup immediately');
    }

    if (recoveryStatus.coverage !== '100%') {
      recommendations.push(`Recovery procedures not fully tested - ${recoveryStatus.untested} untested`);
    }

    if (backupStatus.stats.totalSize > 1000 * 1024 * 1024) {
      recommendations.push('Backup size exceeds 1GB - consider compression or cleanup');
    }

    if (recommendations.length === 0) {
      recommendations.push('System in good state - continue monitoring');
    }

    return recommendations;
  }
}
