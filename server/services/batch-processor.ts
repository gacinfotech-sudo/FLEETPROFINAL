import { Db } from 'mongodb';

export interface BatchJob {
  id: string;
  tenantId: string;
  name: string;
  templateId: string;
  recipientCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  recipients: string[];
  batchSize: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchResult {
  id: string;
  batchJobId: string;
  successful: number;
  failed: number;
  skipped: number;
  totalProcessed: number;
  completedAt: Date;
}

class BatchProcessor {
  private db: Db | null = null;
  private jobs: Map<string, BatchJob> = new Map();
  private results: Map<string, BatchResult> = new Map();
  private readonly DEFAULT_BATCH_SIZE = 100;
  private readonly MAX_BATCH_SIZE = 1000;

  constructor(db?: Db) {
    this.db = db || null;
  }

  setDatabase(db: Db) {
    this.db = db;
  }

  async initialize() {
    try {
      if (!this.db) {
        console.log('[BatchProcessor] Database not initialized, running in memory mode');
        return;
      }

      const jobs = await this.db.collection('batchJobs')
        .find({ status: { $in: ['pending', 'processing'] } })
        .toArray();

      for (const job of jobs) {
        this.jobs.set(job.id, job as BatchJob);
      }

      console.log(`[BatchProcessor] Initialized with ${jobs.length} pending batch jobs`);
    } catch (error) {
      console.error('[BatchProcessor] Initialization error:', error);
    }
  }

  async createBatchJob(
    tenantId: string,
    name: string,
    templateId: string,
    recipients: string[],
    batchSize: number = this.DEFAULT_BATCH_SIZE
  ): Promise<BatchJob> {
    const clampedBatchSize = Math.min(batchSize, this.MAX_BATCH_SIZE);

    const job: BatchJob = {
      id: `batch-${tenantId}-${Date.now()}`,
      tenantId,
      name,
      templateId,
      recipientCount: recipients.length,
      status: 'pending',
      progress: 0,
      recipients,
      batchSize: clampedBatchSize,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(job.id, job);

    if (this.db) {
      try {
        await this.db.collection('batchJobs').insertOne(job);
      } catch (e) {
        console.warn('[BatchProcessor] Failed to persist batch job:', e);
      }
    }

    // Auto-start processing
    this.processBatch(job.id);

    return job;
  }

  async processBatch(batchJobId: string): Promise<void> {
    const job = this.jobs.get(batchJobId);
    if (!job) return;

    job.status = 'processing';
    job.startedAt = new Date();
    job.updatedAt = new Date();

    let successful = 0;
    let failed = 0;
    let skipped = 0;

    try {
      const totalBatches = Math.ceil(job.recipients.length / job.batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const start = i * job.batchSize;
        const end = Math.min(start + job.batchSize, job.recipients.length);
        const batchRecipients = job.recipients.slice(start, end);

        // Process batch
        for (const recipient of batchRecipients) {
          try {
            // Mock processing
            if (Math.random() > 0.05) {
              successful++;
            } else {
              failed++;
            }
          } catch (e) {
            failed++;
          }
        }

        // Update progress
        job.progress = Math.round(((i + 1) / totalBatches) * 100);
        job.updatedAt = new Date();

        if (this.db) {
          try {
            await this.db.collection('batchJobs').updateOne(
              { id: batchJobId },
              { $set: { progress: job.progress, status: 'processing' } }
            );
          } catch (e) {
            console.warn('[BatchProcessor] Failed to update progress:', e);
          }
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      job.status = 'completed';
      job.completedAt = new Date();

      // Record result
      const result: BatchResult = {
        id: `res-${batchJobId}-${Date.now()}`,
        batchJobId,
        successful,
        failed,
        skipped,
        totalProcessed: successful + failed + skipped,
        completedAt: new Date(),
      };

      this.results.set(result.id, result);

      if (this.db) {
        await this.db.collection('batchResults').insertOne(result);
      }

      console.log(`[BatchProcessor] Batch ${batchJobId} completed: ${successful} success, ${failed} failed`);
    } catch (error: any) {
      job.status = 'failed';
      job.errorMessage = error.message;
      console.error(`[BatchProcessor] Batch ${batchJobId} failed:`, error);
    }

    job.updatedAt = new Date();

    if (this.db) {
      try {
        await this.db.collection('batchJobs').updateOne(
          { id: batchJobId },
          { $set: { status: job.status, completedAt: job.completedAt, errorMessage: job.errorMessage } }
        );
      } catch (e) {
        console.warn('[BatchProcessor] Failed to update job status:', e);
      }
    }
  }

  async getBatchJob(batchJobId: string): Promise<BatchJob | null> {
    const inMemory = this.jobs.get(batchJobId);
    if (inMemory) return inMemory;

    if (this.db) {
      try {
        const result = await this.db.collection('batchJobs').findOne({ id: batchJobId });
        return (result as BatchJob) || null;
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  async listBatchJobs(tenantId: string, status?: string): Promise<BatchJob[]> {
    let jobs = Array.from(this.jobs.values())
      .filter(j => j.tenantId === tenantId);

    if (status) {
      jobs = jobs.filter(j => j.status === status);
    }

    jobs = jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (this.db) {
      try {
        const query: any = { tenantId };
        if (status) query.status = status;

        return await this.db.collection('batchJobs')
          .find(query)
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray() as BatchJob[];
      } catch (e) {
        return jobs;
      }
    }

    return jobs;
  }

  async getBatchResult(batchJobId: string): Promise<BatchResult | null> {
    const results = Array.from(this.results.values())
      .filter(r => r.batchJobId === batchJobId);

    if (results.length > 0) {
      return results[0];
    }

    if (this.db) {
      try {
        const result = await this.db.collection('batchResults').findOne({ batchJobId });
        return (result as BatchResult) || null;
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  async retryBatchJob(batchJobId: string): Promise<BatchJob | null> {
    const job = await this.getBatchJob(batchJobId);
    if (!job) return null;

    job.status = 'pending';
    job.progress = 0;
    job.startedAt = undefined;
    job.completedAt = undefined;
    job.errorMessage = undefined;
    job.updatedAt = new Date();

    this.jobs.set(batchJobId, job);

    if (this.db) {
      try {
        await this.db.collection('batchJobs').updateOne(
          { id: batchJobId },
          { $set: { status: 'pending', progress: 0 } }
        );
      } catch (e) {
        console.warn('[BatchProcessor] Failed to retry batch:', e);
      }
    }

    this.processBatch(batchJobId);
    return job;
  }

  async cancelBatchJob(batchJobId: string): Promise<boolean> {
    const job = this.jobs.get(batchJobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    job.status = 'failed';
    job.errorMessage = 'Cancelled by user';
    job.updatedAt = new Date();

    if (this.db) {
      try {
        await this.db.collection('batchJobs').updateOne(
          { id: batchJobId },
          { $set: { status: 'failed', errorMessage: 'Cancelled by user' } }
        );
        return true;
      } catch (e) {
        return false;
      }
    }

    return true;
  }

  async getBatchStats(tenantId: string): Promise<Record<string, any>> {
    const jobs = await this.listBatchJobs(tenantId);

    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      totalRecipients: jobs.reduce((sum, j) => sum + j.recipientCount, 0),
      averageProgress: jobs.length > 0
        ? Math.round(jobs.reduce((sum, j) => sum + j.progress, 0) / jobs.length)
        : 0,
    };
  }

  getJobCount(): number {
    return this.jobs.size;
  }

  getStatus() {
    const activeJobs = Array.from(this.jobs.values())
      .filter(j => ['pending', 'processing'].includes(j.status));

    return {
      totalJobs: this.jobs.size,
      activeJobs: activeJobs.length,
      completedJobs: Array.from(this.jobs.values()).filter(j => j.status === 'completed').length,
      failedJobs: Array.from(this.jobs.values()).filter(j => j.status === 'failed').length,
      timestamp: new Date(),
    };
  }
}

export const batchProcessor = new BatchProcessor();
