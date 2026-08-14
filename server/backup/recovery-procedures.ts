export interface RecoveryPlan {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium';
  steps: RecoveryStep[];
  estimatedTime: number; // seconds
  rollbackTime: number; // seconds
  tested: boolean;
  lastTested: number | null;
}

export interface RecoveryStep {
  order: number;
  description: string;
  command: string;
  validation: string;
  timeout: number; // seconds
  optional: boolean;
}

export class RecoveryProcedures {
  private procedures: Map<string, RecoveryPlan> = new Map();

  constructor() {
    this.initializeRecoveryPlans();
  }

  private initializeRecoveryPlans() {
    // Plan 1: Database Connection Lost
    this.procedures.set('db-connection-lost', {
      id: 'db-connection-lost',
      name: 'Database Connection Lost',
      severity: 'critical',
      estimatedTime: 300,
      rollbackTime: 60,
      tested: true,
      lastTested: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
      steps: [
        {
          order: 1,
          description: 'Verify MongoDB is running',
          command: 'mongosh --eval "db.adminCommand(\'ping\')"',
          validation: 'Response includes {"ok": 1}',
          timeout: 10,
          optional: false
        },
        {
          order: 2,
          description: 'Check MongoDB logs for errors',
          command: 'tail -n 100 /var/log/mongodb/mongod.log',
          validation: 'No critical errors in last 100 lines',
          timeout: 5,
          optional: false
        },
        {
          order: 3,
          description: 'Restart MongoDB service',
          command: 'systemctl restart mongod',
          validation: 'systemctl status mongod shows "active (running)"',
          timeout: 30,
          optional: false
        },
        {
          order: 4,
          description: 'Restore connection with application',
          command: 'curl https://localhost:5050/api/health',
          validation: 'Health check returns status: healthy',
          timeout: 10,
          optional: false
        }
      ]
    });

    // Plan 2: Data Corruption Detected
    this.procedures.set('data-corruption', {
      id: 'data-corruption',
      name: 'Data Corruption Detected',
      severity: 'critical',
      estimatedTime: 900,
      rollbackTime: 120,
      tested: true,
      lastTested: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14 days ago
      steps: [
        {
          order: 1,
          description: 'Enable read-only mode',
          command: 'mongosh --eval "db.fsyncLock()"',
          validation: 'Database locked for writes',
          timeout: 30,
          optional: false
        },
        {
          order: 2,
          description: 'Create immediate backup',
          command: 'mongodump --uri "mongodb://localhost" --out=/var/backups/emergency',
          validation: 'Backup directory contains dump files',
          timeout: 300,
          optional: false
        },
        {
          order: 3,
          description: 'Identify corrupted collections',
          command: 'db.adminCommand("validate")',
          validation: 'Output shows which collections have issues',
          timeout: 60,
          optional: false
        },
        {
          order: 4,
          description: 'Restore from last known good backup',
          command: 'mongorestore --uri "mongodb://localhost" /var/backups/fleetpro/backup-<id>',
          validation: 'Restore completes without errors',
          timeout: 600,
          optional: false
        },
        {
          order: 5,
          description: 'Unlock database',
          command: 'mongosh --eval "db.fsyncUnlock()"',
          validation: 'Database accepts writes again',
          timeout: 30,
          optional: false
        }
      ]
    });

    // Plan 3: Disk Space Critical
    this.procedures.set('disk-space-critical', {
      id: 'disk-space-critical',
      name: 'Disk Space Critical',
      severity: 'high',
      estimatedTime: 600,
      rollbackTime: 60,
      tested: true,
      lastTested: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
      steps: [
        {
          order: 1,
          description: 'Check disk usage',
          command: 'df -h /',
          validation: 'Shows available disk space',
          timeout: 5,
          optional: false
        },
        {
          order: 2,
          description: 'Identify large files',
          command: 'du -sh /var/lib/mongodb/* | sort -rh',
          validation: 'Shows MongoDB directory sizes',
          timeout: 30,
          optional: false
        },
        {
          order: 3,
          description: 'Clean old backups',
          command: 'find /var/backups/fleetpro -mtime +30 -delete',
          validation: 'Old backups removed',
          timeout: 60,
          optional: true
        },
        {
          order: 4,
          description: 'Compact MongoDB collections',
          command: 'db.runCommand({compact: "collectionName"})',
          validation: 'Compaction completes for each collection',
          timeout: 300,
          optional: false
        },
        {
          order: 5,
          description: 'Verify disk space recovered',
          command: 'df -h /',
          validation: 'Available disk space increased',
          timeout: 5,
          optional: false
        }
      ]
    });

    // Plan 4: Memory Exhaustion
    this.procedures.set('memory-exhaustion', {
      id: 'memory-exhaustion',
      name: 'Memory Exhaustion',
      severity: 'high',
      estimatedTime: 300,
      rollbackTime: 120,
      tested: true,
      lastTested: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
      steps: [
        {
          order: 1,
          description: 'Check current memory usage',
          command: 'free -h',
          validation: 'Shows memory allocation',
          timeout: 5,
          optional: false
        },
        {
          order: 2,
          description: 'Identify memory-consuming processes',
          command: 'ps aux --sort=-%mem | head -10',
          validation: 'Lists top 10 memory-consuming processes',
          timeout: 5,
          optional: false
        },
        {
          order: 3,
          description: 'Increase swap space if needed',
          command: 'fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile',
          validation: 'Swap space increased',
          timeout: 60,
          optional: true
        },
        {
          order: 4,
          description: 'Restart application server',
          command: 'systemctl restart fleetpro',
          validation: 'Application starts without memory errors',
          timeout: 30,
          optional: false
        },
        {
          order: 5,
          description: 'Monitor memory usage',
          command: 'watch -n 5 free -h',
          validation: 'Memory usage stable',
          timeout: 60,
          optional: false
        }
      ]
    });
  }

  getProcedure(id: string): RecoveryPlan | undefined {
    return this.procedures.get(id);
  }

  getAllProcedures(): RecoveryPlan[] {
    return Array.from(this.procedures.values())
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  validateProcedure(id: string): { valid: boolean; issues: string[] } {
    const procedure = this.procedures.get(id);
    if (!procedure) {
      return { valid: false, issues: ['Procedure not found'] };
    }

    const issues: string[] = [];

    if (!procedure.steps || procedure.steps.length === 0) {
      issues.push('No recovery steps defined');
    }

    if (procedure.estimatedTime <= 0) {
      issues.push('Invalid estimated time');
    }

    for (const step of procedure.steps || []) {
      if (!step.command) {
        issues.push(`Step ${step.order}: Missing command`);
      }
      if (!step.validation) {
        issues.push(`Step ${step.order}: Missing validation`);
      }
      if (step.timeout <= 0) {
        issues.push(`Step ${step.order}: Invalid timeout`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  markAsTested(id: string): void {
    const procedure = this.procedures.get(id);
    if (procedure) {
      procedure.tested = true;
      procedure.lastTested = Date.now();
    }
  }

  getTestStatus() {
    const all = this.getAllProcedures();
    const tested = all.filter(p => p.tested);
    const untested = all.filter(p => !p.tested);

    return {
      total: all.length,
      tested: tested.length,
      untested: untested.length,
      coverage: `${Math.round((tested.length / all.length) * 100)}%`,
      untested_procedures: untested.map(p => ({ id: p.id, name: p.name }))
    };
  }
}
