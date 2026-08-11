/**
 * Pre-Deployment Verification Script
 * Validates environment, build, dependencies, database, and configuration
 * before deployment
 *
 * Usage: tsx scripts/pre-deployment-verify.ts
 * Output: JSON report with pass/fail status for each check
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { promisify } from "util";
import { exec as execCallback } from "child_process";
import mongoose from "mongoose";

const exec = promisify(execCallback);

interface CheckResult {
  name: string;
  status: "PASS" | "FAIL" | "WARNING";
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

interface VerificationReport {
  timestamp: string;
  environment: string;
  checks: CheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    overallStatus: "PASS" | "FAIL" | "WARNING";
  };
  recommendations: string[];
}

class PreDeploymentVerifier {
  private checks: CheckResult[] = [];
  private recommendations: string[] = [];
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  private addCheck(name: string, status: "PASS" | "FAIL" | "WARNING", message: string, details?: Record<string, any>) {
    this.checks.push({
      name,
      status,
      message,
      details,
      timestamp: new Date().toISOString(),
    });

    const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
    console.log(`${icon} ${name}: ${message}`);
  }

  async verifyEnvironment(): Promise<void> {
    console.log("\n📋 Verifying Environment...");

    // Check NODE_ENV
    const nodeEnv = process.env.NODE_ENV || "development";
    if (nodeEnv === "production") {
      this.addCheck(
        "NODE_ENV",
        "PASS",
        `Environment is ${nodeEnv}`,
        { nodeEnv }
      );
    } else {
      this.addCheck(
        "NODE_ENV",
        "WARNING",
        `Environment is ${nodeEnv} (production recommended for pre-deployment)`,
        { nodeEnv }
      );
    }

    // Check required environment variables
    const requiredVars = [
      "MONGODB_URI",
      "SESSION_SECRET",
      "JWT_SECRET",
      "VITE_VAPID_PUBLIC_KEY",
      "SERVER_VAPID_PRIVATE_KEY",
    ];

    const missingVars = requiredVars.filter((v) => !process.env[v]);

    if (missingVars.length === 0) {
      this.addCheck(
        "Required Environment Variables",
        "PASS",
        "All required environment variables are present",
        { count: requiredVars.length }
      );
    } else {
      this.addCheck(
        "Required Environment Variables",
        "FAIL",
        `Missing ${missingVars.length} required environment variables`,
        { missing: missingVars }
      );
      this.recommendations.push(
        `Add missing environment variables: ${missingVars.join(", ")}`
      );
    }

    // Check optional environment variables
    const optionalVars = [
      "WHATSAPP_PROVIDER",
      "LOG_LEVEL",
      "CORS_ORIGIN",
      "GOOGLE_MAPS_API_KEY",
      "STRIPE_API_KEY",
    ];

    const presentOptionalVars = optionalVars.filter((v) => process.env[v]);

    if (presentOptionalVars.length >= 2) {
      this.addCheck(
        "Optional Environment Variables",
        "PASS",
        `${presentOptionalVars.length}/${optionalVars.length} optional variables configured`,
        { configured: presentOptionalVars }
      );
    } else {
      this.addCheck(
        "Optional Environment Variables",
        "WARNING",
        `Only ${presentOptionalVars.length}/${optionalVars.length} optional variables configured`,
        { configured: presentOptionalVars }
      );
    }
  }

  async verifyBuild(): Promise<void> {
    console.log("\n🔨 Verifying Build...");

    try {
      // Run TypeScript check
      const { stdout, stderr } = await exec("npm run check 2>&1");

      if (stderr && stderr.includes("error TS")) {
        this.addCheck(
          "TypeScript Compilation",
          "FAIL",
          "TypeScript compilation errors found",
          { errors: stderr.split("\n").filter((l) => l.includes("error TS")) }
        );
        this.recommendations.push("Fix TypeScript compilation errors before deployment");
      } else {
        this.addCheck(
          "TypeScript Compilation",
          "PASS",
          "No TypeScript compilation errors",
          { output: stdout ? stdout.substring(0, 200) : "Clean" }
        );
      }
    } catch (error: any) {
      this.addCheck(
        "TypeScript Compilation",
        "FAIL",
        "TypeScript check failed",
        { error: error.message }
      );
      this.recommendations.push("Run 'npm run check' to identify and fix compilation errors");
    }

    // Check build artifacts exist
    const buildDirs = ["dist", "public"];
    for (const dir of buildDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).length;
        this.addCheck(
          `Build Artifact: ${dir}`,
          "PASS",
          `Directory exists with ${files} items`,
          { path: dirPath, itemCount: files }
        );
      } else {
        this.addCheck(
          `Build Artifact: ${dir}`,
          "WARNING",
          `Directory does not exist (will be created during build)`,
          { path: dirPath }
        );
      }
    }
  }

  async verifyDependencies(): Promise<void> {
    console.log("\n📦 Verifying Dependencies...");

    // Check package.json exists
    const pkgJsonPath = path.join(this.projectRoot, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      this.addCheck(
        "package.json",
        "PASS",
        `Found with ${Object.keys(pkg.dependencies || {}).length} dependencies`,
        {
          dependencies: Object.keys(pkg.dependencies || {}).length,
          devDependencies: Object.keys(pkg.devDependencies || {}).length,
        }
      );
    } else {
      this.addCheck(
        "package.json",
        "FAIL",
        "package.json not found",
        { path: pkgJsonPath }
      );
    }

    // Check node_modules
    const nodeModulesPath = path.join(this.projectRoot, "node_modules");
    if (fs.existsSync(nodeModulesPath)) {
      const modules = fs.readdirSync(nodeModulesPath).length;
      this.addCheck(
        "node_modules",
        "PASS",
        `Directory exists with ${modules} packages installed`,
        { path: nodeModulesPath, packageCount: modules }
      );
    } else {
      this.addCheck(
        "node_modules",
        "FAIL",
        "node_modules directory not found. Run 'npm install'",
        { path: nodeModulesPath }
      );
      this.recommendations.push("Run 'npm install' to install dependencies");
    }

    // Check for security vulnerabilities
    try {
      const { stdout } = await exec("npm audit --json 2>&1");
      const audit = JSON.parse(stdout);

      if (audit.metadata && audit.metadata.vulnerabilities) {
        const { critical, high, moderate, low } =
          audit.metadata.vulnerabilities;
        const criticalOrHigh = (critical || 0) + (high || 0);

        if (criticalOrHigh > 0) {
          this.addCheck(
            "Security Vulnerabilities",
            "FAIL",
            `Found ${critical || 0} critical and ${high || 0} high severity vulnerabilities`,
            { critical, high, moderate, low }
          );
          this.recommendations.push("Run 'npm audit fix' to resolve security vulnerabilities");
        } else if (moderate || low) {
          this.addCheck(
            "Security Vulnerabilities",
            "WARNING",
            `Found ${moderate || 0} moderate and ${low || 0} low severity vulnerabilities`,
            { moderate, low }
          );
        } else {
          this.addCheck(
            "Security Vulnerabilities",
            "PASS",
            "No security vulnerabilities found",
            audit.metadata.vulnerabilities
          );
        }
      }
    } catch (error: any) {
      this.addCheck(
        "Security Vulnerabilities",
        "WARNING",
        "Could not verify security vulnerabilities",
        { error: error.message }
      );
    }
  }

  async verifyDatabase(): Promise<void> {
    console.log("\n🗄️  Verifying Database Connectivity...");

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      this.addCheck(
        "Database Connection",
        "FAIL",
        "MONGODB_URI environment variable not set",
        { mongoUri }
      );
      return;
    }

    try {
      await mongoose.connect(mongoUri);

      const connection = mongoose.connection;
      const db = connection.db;

      if (!db) {
        throw new Error("Database object not initialized");
      }

      // List collections
      const collections = await db.listCollections().toArray();

      this.addCheck(
        "Database Connection",
        "PASS",
        `Connected to MongoDB with ${collections.length} collections`,
        {
          host: mongoUri.split("@")[1]?.split("/")[0] || "local",
          collections: collections.length,
        }
      );

      // Verify indexes
      let indexCount = 0;
      for (const collection of collections) {
        const col = db.collection(collection.name);
        const indexes = await col.listIndexes().toArray();
        indexCount += indexes.length;
      }

      if (indexCount > 0) {
        this.addCheck(
          "Database Indexes",
          "PASS",
          `${indexCount} indexes found across ${collections.length} collections`,
          { indexCount, collectionCount: collections.length }
        );
      } else {
        this.addCheck(
          "Database Indexes",
          "WARNING",
          "No indexes found - index creation may be needed",
          { indexCount }
        );
      }

      // Test query on a few collections
      const testCollections = [
        "customers",
        "users",
        "notifications",
        "settings",
      ];
      const queryableCollections = [];

      for (const collName of testCollections) {
        const col = db.collection(collName);
        try {
          const count = await col.countDocuments({});
          queryableCollections.push({ name: collName, count });
        } catch {
          // Collection may not exist, skip
        }
      }

      if (queryableCollections.length > 0) {
        this.addCheck(
          "Collection Accessibility",
          "PASS",
          `Successfully queried ${queryableCollections.length} collections`,
          { collections: queryableCollections }
        );
      }

      await mongoose.disconnect();
    } catch (error: any) {
      this.addCheck(
        "Database Connection",
        "FAIL",
        `Database connection failed: ${error.message}`,
        { mongoUri, error: error.message }
      );
      this.recommendations.push(
        "Ensure MongoDB is running and MONGODB_URI is correctly set"
      );
    }
  }

  async verifyFileSystem(): Promise<void> {
    console.log("\n📁 Verifying File System...");

    const requiredDirs = [
      "server",
      "client/src",
      "scripts",
      "tests",
      "public",
    ];
    const requiredFiles = [
      "package.json",
      "tsconfig.json",
      "vite.config.ts",
      ".env.example",
    ];

    // Check directories
    const missingDirs: string[] = [];
    for (const dir of requiredDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(dirPath)) {
        missingDirs.push(dir);
      }
    }

    if (missingDirs.length === 0) {
      this.addCheck(
        "Required Directories",
        "PASS",
        `All ${requiredDirs.length} required directories exist`,
        { directories: requiredDirs }
      );
    } else {
      this.addCheck(
        "Required Directories",
        "FAIL",
        `Missing ${missingDirs.length} required directories`,
        { missing: missingDirs }
      );
    }

    // Check files
    const missingFiles: string[] = [];
    for (const file of requiredFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length === 0) {
      this.addCheck(
        "Required Files",
        "PASS",
        `All ${requiredFiles.length} required files exist`,
        { files: requiredFiles }
      );
    } else {
      this.addCheck(
        "Required Files",
        "FAIL",
        `Missing ${missingFiles.length} required files`,
        { missing: missingFiles }
      );
    }

    // Check write permissions
    const testDir = path.join(this.projectRoot, ".deployment-test");
    try {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      fs.writeFileSync(path.join(testDir, "test.txt"), "test");
      fs.rmSync(testDir, { recursive: true, force: true });

      this.addCheck(
        "Write Permissions",
        "PASS",
        "Project directory is writable",
        { testDir }
      );
    } catch (error: any) {
      this.addCheck(
        "Write Permissions",
        "FAIL",
        "Cannot write to project directory",
        { error: error.message }
      );
      this.recommendations.push("Verify file system permissions");
    }
  }

  async verifySecurity(): Promise<void> {
    console.log("\n🔒 Verifying Security...");

    // Check for hardcoded secrets in code
    const sensitivePatterns = [
      { pattern: /['"]sk-/, name: "API keys (sk-)" },
      { pattern: /['"]sk_/, name: "Stripe keys" },
      { pattern: /password\s*[:=]\s*['"][^'"]+['"]/, name: "Hardcoded passwords" },
    ];

    let secretsFound = 0;
    const testFile = path.join(this.projectRoot, ".env");

    if (!fs.existsSync(testFile)) {
      this.addCheck(
        ".env File",
        "WARNING",
        ".env file not found (required for development)",
        { path: testFile }
      );
    } else {
      this.addCheck(
        ".env File",
        "PASS",
        ".env file exists",
        { path: testFile }
      );
    }

    // Check .gitignore for sensitive files
    const gitignorePath = path.join(this.projectRoot, ".gitignore");
    const expectedIgnores = [".env", "node_modules", "dist", "*.log"];

    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, "utf-8");
      const presentIgnores = expectedIgnores.filter((i) =>
        gitignore.includes(i)
      );

      if (presentIgnores.length === expectedIgnores.length) {
        this.addCheck(
          ".gitignore Configuration",
          "PASS",
          "All sensitive files are in .gitignore",
          { checked: expectedIgnores }
        );
      } else {
        this.addCheck(
          ".gitignore Configuration",
          "WARNING",
          `Only ${presentIgnores.length}/${expectedIgnores.length} sensitive files in .gitignore`,
          { present: presentIgnores, missing: expectedIgnores.filter((i) => !presentIgnores.includes(i)) }
        );
      }
    }

    // Check for HTTPS/TLS
    if (process.env.NODE_ENV === "production") {
      const hasHttps = process.env.HTTPS_KEY && process.env.HTTPS_CERT;
      if (hasHttps) {
        this.addCheck(
          "HTTPS/TLS Configuration",
          "PASS",
          "HTTPS/TLS configuration present",
          { configured: true }
        );
      } else {
        this.addCheck(
          "HTTPS/TLS Configuration",
          "FAIL",
          "HTTPS/TLS not configured for production",
          { configured: false }
        );
        this.recommendations.push("Configure HTTPS/TLS certificates for production deployment");
      }
    } else {
      this.addCheck(
        "HTTPS/TLS Configuration",
        "WARNING",
        "HTTPS/TLS check skipped (development environment)",
        { environment: process.env.NODE_ENV }
      );
    }

    // Check for CORS configuration
    if (process.env.CORS_ORIGIN) {
      this.addCheck(
        "CORS Configuration",
        "PASS",
        "CORS origin configured",
        { origin: process.env.CORS_ORIGIN }
      );
    } else {
      this.addCheck(
        "CORS Configuration",
        "WARNING",
        "CORS origin not configured (will use defaults)",
        { origin: "default" }
      );
    }
  }

  async verifyExternalServices(): Promise<void> {
    console.log("\n🌐 Verifying External Services...");

    // Check SendGrid configuration
    if (process.env.SENDGRID_API_KEY) {
      this.addCheck(
        "SendGrid Configuration",
        "PASS",
        "SendGrid API key configured",
        { configured: true }
      );
    } else {
      this.addCheck(
        "SendGrid Configuration",
        "WARNING",
        "SendGrid API key not configured",
        { configured: false }
      );
    }

    // Check Twilio configuration
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.addCheck(
        "Twilio Configuration",
        "PASS",
        "Twilio credentials configured",
        { configured: true }
      );
    } else {
      this.addCheck(
        "Twilio Configuration",
        "WARNING",
        "Twilio credentials not configured",
        { configured: false }
      );
    }

    // Check WhatsApp provider
    const whatsappProvider = process.env.WHATSAPP_PROVIDER || "local";
    this.addCheck(
      "WhatsApp Provider",
      "PASS",
      `WhatsApp provider set to: ${whatsappProvider}`,
      { provider: whatsappProvider }
    );
  }

  generateReport(): VerificationReport {
    const passed = this.checks.filter((c) => c.status === "PASS").length;
    const failed = this.checks.filter((c) => c.status === "FAIL").length;
    const warnings = this.checks.filter((c) => c.status === "WARNING").length;

    let overallStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
    if (failed > 0) {
      overallStatus = "FAIL";
    } else if (warnings > 0) {
      overallStatus = "WARNING";
    }

    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      checks: this.checks,
      summary: {
        total: this.checks.length,
        passed,
        failed,
        warnings,
        overallStatus,
      },
      recommendations: this.recommendations,
    };
  }

  async run(): Promise<VerificationReport> {
    console.log("🚀 Pre-Deployment Verification Starting...\n");
    console.log(`Project Root: ${this.projectRoot}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    await this.verifyEnvironment();
    await this.verifyBuild();
    await this.verifyDependencies();
    await this.verifyFileSystem();
    await this.verifySecurity();
    await this.verifyExternalServices();
    await this.verifyDatabase();

    const report = this.generateReport();

    console.log("\n" + "=".repeat(60));
    console.log("📊 VERIFICATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Checks: ${report.summary.total}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Warnings: ${report.summary.warnings}`);
    console.log(`Overall Status: ${report.summary.overallStatus}`);

    if (report.recommendations.length > 0) {
      console.log("\n📋 Recommendations:");
      report.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    console.log("\n" + "=".repeat(60));

    return report;
  }
}

async function main() {
  try {
    const verifier = new PreDeploymentVerifier();
    const report = await verifier.run();

    // Output JSON report to file
    const reportPath = path.join(process.cwd(), ".deployment-verification.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Full report saved to: ${reportPath}`);

    // Also output to stdout for CI/CD
    console.log("\n📄 JSON Report:");
    console.log(JSON.stringify(report, null, 2));

    // Exit with appropriate code
    process.exit(report.summary.overallStatus === "FAIL" ? 1 : 0);
  } catch (error) {
    console.error("Fatal error during verification:", error);
    process.exit(2);
  }
}

main();
