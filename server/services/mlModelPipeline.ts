import { EventEmitter } from "events";

export type ModelType = "churn_prediction" | "demand_forecasting" | "price_optimization" | "driver_matching" | "fraud_detection";
export type TrainingStatus = "pending" | "running" | "completed" | "failed" | "paused";
export type ModelStatus = "training" | "validating" | "production" | "archived" | "deprecated";

export interface DatasetConfig {
  tenantId: string;
  size: number; // rows
  features: string[];
  targetVariable: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  splitRatio: {
    train: number; // 0-1
    validation: number; // 0-1
    test: number; // 0-1
  };
}

export interface ModelConfig {
  modelId: string;
  name: string;
  type: ModelType;
  version: string;
  description: string;
  algorithm: string; // "random_forest", "xgboost", "neural_network", etc.
  hyperparameters: Record<string, any>;
  features: string[];
  targetVariable: string;
}

export interface TrainingJob {
  jobId: string;
  modelId: string;
  tenantId: string;
  status: TrainingStatus;
  datasetConfig: DatasetConfig;
  modelConfig: ModelConfig;
  startedAt: Date;
  completedAt?: Date;
  progress: number; // 0-100
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    rmse?: number;
    mae?: number;
    auc?: number;
    validationLoss?: number;
    trainingLoss?: number;
  };
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  errorLog?: string[];
}

export interface DeployedModel {
  modelId: string;
  name: string;
  type: ModelType;
  version: string;
  status: ModelStatus;
  algorithm: string;
  deployedAt: Date;
  lastUpdatedAt: Date;
  performanceMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  productionMetrics: {
    predictions: number;
    avgLatency: number; // ms
    errorRate: number;
    uptime: number; // percentage
  };
  trainingDatasetSize: number;
  modelSize: number; // MB
  confidenceThreshold: number;
}

export interface ModelPrediction {
  id: string;
  modelId: string;
  tenantId: string;
  input: Record<string, any>;
  output: {
    prediction: any;
    confidence: number; // 0-1
    probability?: Record<string, number>;
  };
  timestamp: Date;
  latency: number; // ms
  status: "success" | "failed";
}

export interface ModelEvaluation {
  modelId: string;
  evaluationDate: Date;
  trainingAccuracy: number;
  validationAccuracy: number;
  testAccuracy: number;
  overfittingRatio: number; // training acc / validation acc
  featureImportance: Record<string, number>;
  confusionMatrix?: number[][];
  rocAuc?: number;
  prCurve?: { precision: number[]; recall: number[] };
  recommendations: string[];
}

class MLModelPipeline extends EventEmitter {
  private trainingJobs: Map<string, TrainingJob> = new Map();
  private deployedModels: Map<string, DeployedModel> = new Map();
  private predictions: Map<string, ModelPrediction> = new Map();
  private evaluations: Map<string, ModelEvaluation> = new Map();
  private modelConfigs: Map<string, ModelConfig> = new Map();

  constructor() {
    super();
    this.setupDefaultModels();
  }

  private setupDefaultModels() {
    const defaultModels: ModelConfig[] = [
      {
        modelId: "model_churn_v1",
        name: "Customer Churn Prediction",
        type: "churn_prediction",
        version: "1.0",
        description: "Predicts customer churn probability using gradient boosting",
        algorithm: "xgboost",
        hyperparameters: {
          max_depth: 6,
          learning_rate: 0.1,
          n_estimators: 100,
          subsample: 0.8,
        },
        features: [
          "total_rides",
          "avg_rating",
          "days_inactive",
          "cancellation_rate",
          "complaint_count",
        ],
        targetVariable: "churned",
      },
      {
        modelId: "model_demand_v1",
        name: "Demand Forecasting",
        type: "demand_forecasting",
        version: "1.0",
        description: "LSTM model for 24-hour ride demand prediction",
        algorithm: "lstm",
        hyperparameters: {
          layers: 2,
          units: 64,
          dropout: 0.2,
          epochs: 50,
          batch_size: 32,
        },
        features: [
          "hour",
          "day_of_week",
          "weather",
          "temperature",
          "previous_24h_demand",
        ],
        targetVariable: "ride_count",
      },
      {
        modelId: "model_pricing_v1",
        name: "Dynamic Price Optimization",
        type: "price_optimization",
        version: "1.0",
        description: "ML model for optimal pricing based on demand and supply",
        algorithm: "random_forest",
        hyperparameters: {
          n_estimators: 200,
          max_depth: 10,
          min_samples_split: 5,
          random_state: 42,
        },
        features: [
          "demand_level",
          "supply_level",
          "time_of_day",
          "distance",
          "customer_segment",
        ],
        targetVariable: "optimal_price",
      },
      {
        modelId: "model_matching_v1",
        name: "Driver-Ride Matching",
        type: "driver_matching",
        version: "1.0",
        description: "Neural network for optimal driver matching",
        algorithm: "neural_network",
        hyperparameters: {
          layers: [128, 64, 32],
          activation: "relu",
          dropout: 0.3,
          optimizer: "adam",
        },
        features: [
          "driver_location",
          "driver_rating",
          "passenger_rating",
          "distance",
          "time_of_day",
        ],
        targetVariable: "match_score",
      },
      {
        modelId: "model_fraud_v1",
        name: "Fraud Detection",
        type: "fraud_detection",
        version: "1.0",
        description: "Isolation forest for anomalous transaction detection",
        algorithm: "isolation_forest",
        hyperparameters: {
          n_estimators: 100,
          contamination: 0.05,
          random_state: 42,
        },
        features: [
          "transaction_amount",
          "user_history",
          "location_deviation",
          "time_pattern",
          "device_fingerprint",
        ],
        targetVariable: "is_fraud",
      },
    ];

    defaultModels.forEach((config) => {
      this.modelConfigs.set(config.modelId, config);
    });
  }

  startTraining(data: {
    modelId: string;
    tenantId: string;
    datasetConfig: DatasetConfig;
  }): TrainingJob {
    const modelConfig = this.modelConfigs.get(data.modelId);
    if (!modelConfig) {
      throw new Error(`Model ${data.modelId} not found`);
    }

    const job: TrainingJob = {
      jobId: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      modelId: data.modelId,
      tenantId: data.tenantId,
      status: "running",
      datasetConfig: data.datasetConfig,
      modelConfig: { ...modelConfig },
      startedAt: new Date(),
      progress: 0,
      metrics: {},
      epochs: 50,
      batchSize: 32,
      learningRate: 0.001,
      errorLog: [],
    };

    this.trainingJobs.set(job.jobId, job);

    // Simulate training progress
    this.simulateTraining(job);

    this.emit("training:started", job);
    return job;
  }

  private simulateTraining(job: TrainingJob) {
    const updateInterval = setInterval(() => {
      if (job.status !== "running") {
        clearInterval(updateInterval);
        return;
      }

      job.progress = Math.min(100, job.progress + Math.random() * 15);

      if (job.progress >= 100) {
        job.progress = 100;
        job.status = "completed";
        job.completedAt = new Date();

        // Generate realistic metrics based on model type
        job.metrics = this.generateMetrics(job.modelConfig.type);

        clearInterval(updateInterval);
        this.emit("training:completed", job);
      }

      this.emit("training:progress", { jobId: job.jobId, progress: job.progress });
    }, 3000);
  }

  private generateMetrics(modelType: ModelType): Record<string, number> {
    const baseMetrics = {
      trainingLoss: 0.2 + Math.random() * 0.3,
      validationLoss: 0.25 + Math.random() * 0.35,
    };

    switch (modelType) {
      case "churn_prediction":
      case "fraud_detection":
        return {
          ...baseMetrics,
          accuracy: 0.82 + Math.random() * 0.15,
          precision: 0.80 + Math.random() * 0.15,
          recall: 0.78 + Math.random() * 0.15,
          f1Score: 0.79 + Math.random() * 0.15,
          auc: 0.85 + Math.random() * 0.12,
        };
      case "demand_forecasting":
        return {
          ...baseMetrics,
          rmse: 10 + Math.random() * 15,
          mae: 8 + Math.random() * 12,
          accuracy: 0.75 + Math.random() * 0.2,
        };
      case "price_optimization":
        return {
          ...baseMetrics,
          rmse: 50 + Math.random() * 100,
          mae: 35 + Math.random() * 75,
          accuracy: 0.70 + Math.random() * 0.25,
        };
      default:
        return {
          ...baseMetrics,
          accuracy: 0.75 + Math.random() * 0.2,
          precision: 0.73 + Math.random() * 0.2,
          recall: 0.72 + Math.random() * 0.2,
        };
    }
  }

  deployModel(data: { modelId: string; trainingJobId: string }): DeployedModel {
    const job = this.trainingJobs.get(data.trainingJobId);
    if (!job) {
      throw new Error(`Training job ${data.trainingJobId} not found`);
    }

    if (job.status !== "completed") {
      throw new Error(`Training job must be completed before deployment`);
    }

    const model: DeployedModel = {
      modelId: data.modelId,
      name: job.modelConfig.name,
      type: job.modelConfig.type,
      version: job.modelConfig.version,
      status: "production",
      algorithm: job.modelConfig.algorithm,
      deployedAt: new Date(),
      lastUpdatedAt: new Date(),
      performanceMetrics: {
        accuracy: job.metrics.accuracy || 0.8,
        precision: job.metrics.precision || 0.79,
        recall: job.metrics.recall || 0.78,
        f1Score: job.metrics.f1Score || 0.78,
      },
      productionMetrics: {
        predictions: 0,
        avgLatency: 25,
        errorRate: 0.02,
        uptime: 99.9,
      },
      trainingDatasetSize: job.datasetConfig.size,
      modelSize: 50 + Math.random() * 150,
      confidenceThreshold: 0.7,
    };

    this.deployedModels.set(model.modelId, model);
    this.emit("model:deployed", model);

    return model;
  }

  makePrediction(data: {
    modelId: string;
    tenantId: string;
    input: Record<string, any>;
  }): ModelPrediction {
    const model = this.deployedModels.get(data.modelId);
    if (!model) {
      throw new Error(`Model ${data.modelId} not deployed`);
    }

    const startTime = Date.now();

    const prediction: ModelPrediction = {
      id: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      modelId: data.modelId,
      tenantId: data.tenantId,
      input: data.input,
      output: {
        prediction: this.generatePrediction(model.type),
        confidence: 0.75 + Math.random() * 0.2,
        probability: {},
      },
      timestamp: new Date(),
      latency: Date.now() - startTime + Math.random() * 50,
      status: "success",
    };

    this.predictions.set(prediction.id, prediction);

    // Update model metrics
    model.productionMetrics.predictions++;
    model.lastUpdatedAt = new Date();

    this.emit("prediction:made", prediction);
    return prediction;
  }

  private generatePrediction(modelType: ModelType): any {
    switch (modelType) {
      case "churn_prediction":
        return Math.random() > 0.7 ? "high_risk" : "low_risk";
      case "demand_forecasting":
        return Math.floor(50 + Math.random() * 150);
      case "price_optimization":
        return Math.floor(200 + Math.random() * 800);
      case "driver_matching":
        return Math.round((60 + Math.random() * 40) * 10) / 10;
      case "fraud_detection":
        return Math.random() > 0.95 ? "fraud" : "legitimate";
      default:
        return null;
    }
  }

  evaluateModel(modelId: string): ModelEvaluation {
    const model = this.deployedModels.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const evaluation: ModelEvaluation = {
      modelId,
      evaluationDate: new Date(),
      trainingAccuracy: model.performanceMetrics.accuracy + Math.random() * 0.05,
      validationAccuracy: model.performanceMetrics.accuracy - Math.random() * 0.03,
      testAccuracy: model.performanceMetrics.accuracy - Math.random() * 0.02,
      overfittingRatio: 1 + Math.random() * 0.1,
      featureImportance: {
        feature_1: 0.3 + Math.random() * 0.1,
        feature_2: 0.2 + Math.random() * 0.1,
        feature_3: 0.15 + Math.random() * 0.1,
        feature_4: 0.15 + Math.random() * 0.1,
        feature_5: 0.2 + Math.random() * 0.1,
      },
      recommendations: [
        "Model performing well with acceptable accuracy",
        "Consider collecting more diverse training data",
        "Monitor for feature drift in production",
        "Retrain quarterly for concept drift",
      ],
    };

    this.evaluations.set(`eval_${modelId}_${Date.now()}`, evaluation);
    this.emit("model:evaluated", evaluation);

    return evaluation;
  }

  getTrainingJob(jobId: string): TrainingJob | undefined {
    return this.trainingJobs.get(jobId);
  }

  getDeployedModel(modelId: string): DeployedModel | undefined {
    return this.deployedModels.get(modelId);
  }

  getAllTrainingJobs(status?: TrainingStatus): TrainingJob[] {
    const jobs = Array.from(this.trainingJobs.values());
    return status ? jobs.filter((j) => j.status === status) : jobs;
  }

  getAllDeployedModels(): DeployedModel[] {
    return Array.from(this.deployedModels.values());
  }

  getPredictionStats(modelId?: string): {
    totalPredictions: number;
    successRate: number;
    avgLatency: number;
    predictionsPerModel: Record<string, number>;
  } {
    const predictions = Array.from(this.predictions.values());
    const filtered = modelId
      ? predictions.filter((p) => p.modelId === modelId)
      : predictions;

    const successful = filtered.filter((p) => p.status === "success").length;
    const avgLatency =
      filtered.length > 0
        ? filtered.reduce((sum, p) => sum + p.latency, 0) / filtered.length
        : 0;

    const perModel: Record<string, number> = {};
    predictions.forEach((p) => {
      perModel[p.modelId] = (perModel[p.modelId] || 0) + 1;
    });

    return {
      totalPredictions: predictions.length,
      successRate: filtered.length > 0 ? (successful / filtered.length) * 100 : 0,
      avgLatency: Math.round(avgLatency),
      predictionsPerModel: perModel,
    };
  }

  getMLStats(): {
    totalJobs: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
    deployedModels: number;
    totalPredictions: number;
    avgModelAccuracy: number;
    modelTypes: Record<ModelType, number>;
  } {
    const jobs = Array.from(this.trainingJobs.values());
    const models = Array.from(this.deployedModels.values());
    const predictions = Array.from(this.predictions.values());

    const avgAccuracy =
      models.length > 0
        ? models.reduce((sum, m) => sum + m.performanceMetrics.accuracy, 0) / models.length
        : 0;

    const modelTypes: Record<ModelType, number> = {
      churn_prediction: 0,
      demand_forecasting: 0,
      price_optimization: 0,
      driver_matching: 0,
      fraud_detection: 0,
    };

    models.forEach((m) => {
      modelTypes[m.type]++;
    });

    return {
      totalJobs: jobs.length,
      runningJobs: jobs.filter((j) => j.status === "running").length,
      completedJobs: jobs.filter((j) => j.status === "completed").length,
      failedJobs: jobs.filter((j) => j.status === "failed").length,
      deployedModels: models.length,
      totalPredictions: predictions.length,
      avgModelAccuracy: Math.round(avgAccuracy * 100) / 100,
      modelTypes,
    };
  }
}

export const mlModelPipeline = new MLModelPipeline();
