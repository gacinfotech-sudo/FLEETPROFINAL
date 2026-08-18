import { EventEmitter } from "events";

interface Model {
  id: string;
  name: string;
  version: string;
  format: "tflite" | "onnx" | "tensorflow";
  size: number; // bytes
  accuracy: number; // 0-100
  latency: number; // ms
  lastUpdated: Date;
}

interface TrainingJob {
  jobId: string;
  modelId: string;
  status: "queued" | "training" | "validating" | "completed" | "failed";
  progress: number; // 0-100
  datasetSize: number;
  epochs: number;
  batchSize: number;
  accuracy: number;
  loss: number;
  startTime: Date;
  endTime?: Date;
  error?: string;
}

interface ABTestVariant {
  id: string;
  name: string;
  modelVersion: string;
  trafficPercentage: number;
  metrics: {
    impressions: number;
    conversions: number;
    conversionRate: number;
    averageLatency: number;
  };
}

interface PerformanceMetric {
  timestamp: Date;
  modelId: string;
  metric: "latency" | "accuracy" | "throughput" | "errorRate";
  value: number;
  environment: "production" | "staging" | "development";
}

export class MLInfrastructure extends EventEmitter {
  private models: Map<string, Model> = new Map();
  private trainingJobs: Map<string, TrainingJob> = new Map();
  private abTests: Map<string, ABTestVariant[]> = new Map();
  private performanceMetrics: PerformanceMetric[] = [];

  /**
   * Register a new ML model
   */
  registerModel(model: Model): void {
    this.models.set(model.id, model);
    this.emit("model-registered", model);
    console.log(`Model registered: ${model.name} v${model.version}`);
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): Model | undefined {
    return this.models.get(modelId);
  }

  /**
   * List all available models
   */
  listModels(): Model[] {
    return Array.from(this.models.values());
  }

  /**
   * Update model (new version deployment)
   */
  updateModel(modelId: string, updates: Partial<Model>): void {
    const model = this.models.get(modelId);
    if (!model) throw new Error("Model not found");

    const updated = { ...model, ...updates, lastUpdated: new Date() };
    this.models.set(modelId, updated);
    this.emit("model-updated", updated);
  }

  /**
   * Start training job for model improvement
   */
  async startTrainingJob(
    modelId: string,
    trainingConfig: {
      datasetSize: number;
      epochs: number;
      batchSize: number;
      learningRate: number;
    }
  ): Promise<TrainingJob> {
    const jobId = `train-${Date.now()}`;
    const job: TrainingJob = {
      jobId,
      modelId,
      status: "queued",
      progress: 0,
      datasetSize: trainingConfig.datasetSize,
      epochs: trainingConfig.epochs,
      batchSize: trainingConfig.batchSize,
      accuracy: 0,
      loss: 0,
      startTime: new Date(),
    };

    this.trainingJobs.set(jobId, job);
    this.emit("training-started", job);

    // Simulate training progress
    this.simulateTraining(jobId, trainingConfig);

    return job;
  }

  /**
   * Get training job status
   */
  getTrainingJob(jobId: string): TrainingJob | undefined {
    return this.trainingJobs.get(jobId);
  }

  /**
   * Cancel training job
   */
  cancelTrainingJob(jobId: string): void {
    const job = this.trainingJobs.get(jobId);
    if (job && job.status === "training") {
      job.status = "failed";
      job.error = "Job cancelled by user";
      this.emit("training-cancelled", job);
    }
  }

  /**
   * Create A/B test for model variants
   */
  createABTest(
    testId: string,
    variants: Array<{ name: string; modelVersion: string; trafficPercentage: number }>
  ): void {
    if (variants.reduce((sum, v) => sum + v.trafficPercentage, 0) !== 100) {
      throw new Error("Traffic percentages must sum to 100");
    }

    const testVariants: ABTestVariant[] = variants.map((v, i) => ({
      id: `variant-${i}`,
      name: v.name,
      modelVersion: v.modelVersion,
      trafficPercentage: v.trafficPercentage,
      metrics: {
        impressions: 0,
        conversions: 0,
        conversionRate: 0,
        averageLatency: 0,
      },
    }));

    this.abTests.set(testId, testVariants);
    this.emit("ab-test-created", { testId, variants: testVariants });
  }

  /**
   * Record A/B test impression
   */
  recordABTestImpression(
    testId: string,
    variantId: string,
    latency: number
  ): void {
    const variants = this.abTests.get(testId);
    if (!variants) return;

    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;

    variant.metrics.impressions++;
    variant.metrics.averageLatency =
      (variant.metrics.averageLatency * (variant.metrics.impressions - 1) + latency) /
      variant.metrics.impressions;
  }

  /**
   * Record A/B test conversion
   */
  recordABTestConversion(testId: string, variantId: string): void {
    const variants = this.abTests.get(testId);
    if (!variants) return;

    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;

    variant.metrics.conversions++;
    variant.metrics.conversionRate =
      variant.metrics.impressions > 0
        ? (variant.metrics.conversions / variant.metrics.impressions) * 100
        : 0;
  }

  /**
   * Get A/B test results
   */
  getABTestResults(testId: string): ABTestVariant[] | undefined {
    return this.abTests.get(testId);
  }

  /**
   * Recommend winner of A/B test (with statistical significance)
   */
  recommendABTestWinner(testId: string): { winner: ABTestVariant; confidence: number } | null {
    const variants = this.abTests.get(testId);
    if (!variants || variants.length < 2) return null;

    // Simple heuristic: higher conversion rate with sufficient impressions
    const validVariants = variants.filter((v) => v.metrics.impressions >= 100);
    if (validVariants.length < 2) return null;

    const winner = validVariants.reduce((best, current) =>
      current.metrics.conversionRate > best.metrics.conversionRate ? current : best
    );

    // Confidence based on statistical significance (simplified)
    const confidence = Math.min(
      (winner.metrics.impressions / 1000) * 100,
      95
    );

    return { winner, confidence: Math.round(confidence) };
  }

  /**
   * Record performance metric
   */
  recordMetric(
    modelId: string,
    metric: "latency" | "accuracy" | "throughput" | "errorRate",
    value: number,
    environment: "production" | "staging" | "development" = "production"
  ): void {
    const perfMetric: PerformanceMetric = {
      timestamp: new Date(),
      modelId,
      metric,
      value,
      environment,
    };

    this.performanceMetrics.push(perfMetric);

    // Keep only last 10,000 metrics
    if (this.performanceMetrics.length > 10000) {
      this.performanceMetrics.shift();
    }

    this.emit("metric-recorded", perfMetric);
  }

  /**
   * Get performance metrics for model
   */
  getMetrics(
    modelId: string,
    metric: "latency" | "accuracy" | "throughput" | "errorRate",
    hours: number = 24
  ): PerformanceMetric[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    return this.performanceMetrics.filter(
      (m) =>
        m.modelId === modelId &&
        m.metric === metric &&
        m.timestamp.getTime() > cutoff &&
        m.environment === "production"
    );
  }

  /**
   * Calculate SLA compliance
   */
  calculateSLACompliance(
    modelId: string,
    latencyThreshold: number = 200 // ms
  ): number {
    const latencyMetrics = this.getMetrics(modelId, "latency");

    if (latencyMetrics.length === 0) return 0;

    const compliant = latencyMetrics.filter((m) => m.value <= latencyThreshold).length;
    return (compliant / latencyMetrics.length) * 100;
  }

  /**
   * Get model quality score (aggregated metric)
   */
  getModelQualityScore(modelId: string): number {
    const latencyMetrics = this.getMetrics(modelId, "latency");
    const accuracyMetrics = this.getMetrics(modelId, "accuracy");
    const errorMetrics = this.getMetrics(modelId, "errorRate");

    if (latencyMetrics.length === 0) return 0;

    const avgLatency =
      latencyMetrics.reduce((sum, m) => sum + m.value, 0) / latencyMetrics.length;
    const avgAccuracy =
      accuracyMetrics.length > 0
        ? accuracyMetrics.reduce((sum, m) => sum + m.value, 0) / accuracyMetrics.length
        : 100;
    const avgError =
      errorMetrics.length > 0
        ? errorMetrics.reduce((sum, m) => sum + m.value, 0) / errorMetrics.length
        : 0;

    // Quality score: (accuracy - error rate) * (1 - latency/500)
    return Math.max(0, Math.min(
      ((avgAccuracy - avgError) / 100) * (1 - Math.min(avgLatency / 500, 1)) * 100,
      100
    ));
  }

  /**
   * Export metrics for dashboarding
   */
  exportMetrics(modelId: string, format: "json" | "csv" = "json") {
    const metrics = {
      modelId,
      timestamp: new Date(),
      latency: {
        average: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      },
      accuracy: 0,
      errorRate: 0,
      slaCompliance: 0,
      qualityScore: 0,
    };

    const latencyMetrics = this.getMetrics(modelId, "latency");
    if (latencyMetrics.length > 0) {
      const values = latencyMetrics.map((m) => m.value).sort((a, b) => a - b);
      metrics.latency.average = values.reduce((a, b) => a + b, 0) / values.length;
      metrics.latency.p50 = values[Math.floor(values.length * 0.5)];
      metrics.latency.p95 = values[Math.floor(values.length * 0.95)];
      metrics.latency.p99 = values[Math.floor(values.length * 0.99)];
    }

    const accuracyMetrics = this.getMetrics(modelId, "accuracy");
    if (accuracyMetrics.length > 0) {
      metrics.accuracy =
        accuracyMetrics.reduce((sum, m) => sum + m.value, 0) / accuracyMetrics.length;
    }

    const errorMetrics = this.getMetrics(modelId, "errorRate");
    if (errorMetrics.length > 0) {
      metrics.errorRate =
        errorMetrics.reduce((sum, m) => sum + m.value, 0) / errorMetrics.length;
    }

    metrics.slaCompliance = this.calculateSLACompliance(modelId);
    metrics.qualityScore = this.getModelQualityScore(modelId);

    if (format === "json") {
      return JSON.stringify(metrics, null, 2);
    } else {
      // CSV format
      return `ModelID,Timestamp,AvgLatency,P50,P95,P99,Accuracy,ErrorRate,SLACompliance,QualityScore\n${modelId},${metrics.timestamp},${metrics.latency.average},${metrics.latency.p50},${metrics.latency.p95},${metrics.latency.p99},${metrics.accuracy},${metrics.errorRate},${metrics.slaCompliance},${metrics.qualityScore}`;
    }
  }

  private async simulateTraining(
    jobId: string,
    config: {
      datasetSize: number;
      epochs: number;
      batchSize: number;
      learningRate: number;
    }
  ): Promise<void> {
    const job = this.trainingJobs.get(jobId);
    if (!job) return;

    job.status = "training";
    job.startTime = new Date();

    // Simulate epoch-by-epoch training
    for (let epoch = 1; epoch <= config.epochs; epoch++) {
      job.progress = (epoch / config.epochs) * 100;
      job.accuracy = Math.min(0.5 + (epoch / config.epochs) * 0.45, 0.95);
      job.loss = Math.max(1.0 - (epoch / config.epochs) * 0.9, 0.1);

      this.emit("training-progress", job);

      // Simulate training time
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    job.status = "validating";
    this.emit("training-validating", job);

    // Simulate validation
    await new Promise((resolve) => setTimeout(resolve, 200));

    job.status = "completed";
    job.endTime = new Date();
    this.emit("training-completed", job);
  }
}
