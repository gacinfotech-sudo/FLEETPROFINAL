import express from "express";
import { mlModelPipeline, type DatasetConfig } from "../services/mlModelPipeline";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/ml/training/start - Start a training job
router.post("/training/start", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { modelId, datasetConfig } = req.body;

    if (!modelId || !datasetConfig) {
      return res.status(400).json({
        success: false,
        error: "modelId and datasetConfig are required",
      });
    }

    const datasetWithTenant: DatasetConfig = {
      ...datasetConfig,
      tenantId: req.tenantId,
    };

    const job = mlModelPipeline.startTraining({
      modelId,
      tenantId: req.tenantId,
      datasetConfig: datasetWithTenant,
    });

    res.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    console.error("Error starting training:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to start training",
    });
  }
});

// GET /api/ml/training/:jobId - Get training job status
router.get("/training/:jobId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const job = mlModelPipeline.getTrainingJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Training job not found",
      });
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    console.error("Error fetching training job:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch training job",
    });
  }
});

// GET /api/ml/training - Get all training jobs
router.get("/training", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const status = req.query.status;
    const jobs = mlModelPipeline.getAllTrainingJobs(status);

    res.json({
      success: true,
      data: jobs,
      count: jobs.length,
    });
  } catch (error: any) {
    console.error("Error fetching training jobs:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch training jobs",
    });
  }
});

// POST /api/ml/models/deploy - Deploy a trained model
router.post("/models/deploy", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { modelId, trainingJobId } = req.body;

    if (!modelId || !trainingJobId) {
      return res.status(400).json({
        success: false,
        error: "modelId and trainingJobId are required",
      });
    }

    const model = mlModelPipeline.deployModel({
      modelId,
      trainingJobId,
    });

    res.json({
      success: true,
      data: model,
    });
  } catch (error: any) {
    console.error("Error deploying model:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to deploy model",
    });
  }
});

// GET /api/ml/models/:modelId - Get deployed model
router.get("/models/:modelId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const model = mlModelPipeline.getDeployedModel(req.params.modelId);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: "Model not found",
      });
    }

    res.json({
      success: true,
      data: model,
    });
  } catch (error: any) {
    console.error("Error fetching model:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch model",
    });
  }
});

// GET /api/ml/models - Get all deployed models
router.get("/models", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const models = mlModelPipeline.getAllDeployedModels();

    res.json({
      success: true,
      data: models,
      count: models.length,
    });
  } catch (error: any) {
    console.error("Error fetching models:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch models",
    });
  }
});

// POST /api/ml/predict - Make a prediction
router.post("/predict", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { modelId, input } = req.body;

    if (!modelId || !input) {
      return res.status(400).json({
        success: false,
        error: "modelId and input are required",
      });
    }

    const prediction = mlModelPipeline.makePrediction({
      modelId,
      tenantId: req.tenantId,
      input,
    });

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error: any) {
    console.error("Error making prediction:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to make prediction",
    });
  }
});

// POST /api/ml/evaluate/:modelId - Evaluate model
router.post("/evaluate/:modelId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const evaluation = mlModelPipeline.evaluateModel(req.params.modelId);

    res.json({
      success: true,
      data: evaluation,
    });
  } catch (error: any) {
    console.error("Error evaluating model:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to evaluate model",
    });
  }
});

// GET /api/ml/stats - Get ML pipeline statistics
router.get("/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = mlModelPipeline.getMLStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch stats",
    });
  }
});

// GET /api/ml/predictions/stats - Get prediction statistics
router.get("/predictions/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const modelId = req.query.modelId;
    const stats = mlModelPipeline.getPredictionStats(modelId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching prediction stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch prediction stats",
    });
  }
});

// POST /api/ml/test - Test ML pipeline
router.post("/test", (req: any, res) => {
  try {
    // Start training for each model type
    const trainingJobs = [];

    const models = [
      "model_churn_v1",
      "model_demand_v1",
      "model_pricing_v1",
      "model_matching_v1",
      "model_fraud_v1",
    ];

    models.forEach((modelId) => {
      const job = mlModelPipeline.startTraining({
        modelId,
        tenantId: "TEST-TENANT",
        datasetConfig: {
          tenantId: "TEST-TENANT",
          size: 10000,
          features: ["feature1", "feature2", "feature3"],
          targetVariable: "target",
          timeRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date(),
          },
          splitRatio: { train: 0.7, validation: 0.15, test: 0.15 },
        },
      });
      trainingJobs.push(job);
    });

    const stats = mlModelPipeline.getMLStats();
    const allJobs = mlModelPipeline.getAllTrainingJobs();
    const models_deployed = mlModelPipeline.getAllDeployedModels();

    res.json({
      success: true,
      trainingJobsCreated: trainingJobs,
      stats,
      allTrainingJobs: allJobs,
      deployedModels: models_deployed,
      summary: {
        jobsCreated: trainingJobs.length,
        totalJobs: stats.totalJobs,
        runningJobs: stats.runningJobs,
        deployedModels: stats.deployedModels,
      },
    });
  } catch (error: any) {
    console.error("Error testing ML pipeline:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test ML pipeline",
    });
  }
});

export default router;
