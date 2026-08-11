/**
 * Post-Deployment Smoke Tests
 * Validates core functionality after deployment
 *
 * Usage: tsx tests/smoke.test.ts
 * Output: JSON report with test results
 */

import fetch from "node-fetch";
import mongoose from "mongoose";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "TIMEOUT";
  message: string;
  details?: Record<string, any>;
  duration: number;
  timestamp: string;
}

interface SmokeTestReport {
  timestamp: string;
  serverUrl: string;
  mongoUri: string;
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    timeouts: number;
    overallStatus: "PASS" | "FAIL" | "TIMEOUT";
  };
}

class SmokeTests {
  private results: TestResult[] = [];
  private serverUrl: string;
  private mongoUri: string;
  private requestTimeout: number = 5000; // 5 seconds

  constructor() {
    this.serverUrl = process.env.SERVER_URL || "http://localhost:5050";
    this.mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fleetpro";
  }

  private async runTest(
    name: string,
    testFn: () => Promise<void>
  ): Promise<TestResult> {
    const start = Date.now();

    try {
      await Promise.race([
        testFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Test timeout")), this.requestTimeout)
        ),
      ]);

      const duration = Date.now() - start;
      const result: TestResult = {
        name,
        status: "PASS",
        message: "Test passed",
        duration,
        timestamp: new Date().toISOString(),
      };

      this.results.push(result);
      console.log(`✅ ${name} (${duration}ms)`);
      return result;
    } catch (error: any) {
      const duration = Date.now() - start;
      const status = error.message === "Test timeout" ? "TIMEOUT" : "FAIL";

      const result: TestResult = {
        name,
        status,
        message: error.message,
        details: {
          error: error.toString(),
        },
        duration,
        timestamp: new Date().toISOString(),
      };

      this.results.push(result);
      console.log(`❌ ${name}: ${error.message} (${duration}ms)`);
      return result;
    }
  }

  async testServerStartup(): Promise<void> {
    await this.runTest("Server Health Endpoint", async () => {
      const response = await fetch(`${this.serverUrl}/health`, {
        timeout: this.requestTimeout,
      });

      if (response.status !== 200) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const data = (await response.json()) as Record<string, any>;
      if (!data.status) {
        throw new Error("Health check response missing status field");
      }
    });
  }

  async testDatabaseConnectivity(): Promise<void> {
    await this.runTest("Database Connectivity", async () => {
      await mongoose.connect(this.mongoUri);

      const connection = mongoose.connection;
      const db = connection.db;

      if (!db) {
        throw new Error("Database object not initialized");
      }

      const collections = await db.listCollections().toArray();
      if (collections.length === 0) {
        throw new Error("No collections found in database");
      }

      await mongoose.disconnect();
    });
  }

  async testDatabaseQueries(): Promise<void> {
    await this.runTest("Collection Queries", async () => {
      await mongoose.connect(this.mongoUri);
      const db = mongoose.connection.db;

      if (!db) {
        throw new Error("Database not initialized");
      }

      // Test querying some core collections
      const testCollections = ["customers", "users"];

      for (const collName of testCollections) {
        const col = db.collection(collName);
        const count = await col.countDocuments({});
        if (count < 0) {
          throw new Error(`Invalid document count for ${collName}`);
        }
      }

      await mongoose.disconnect();
    });
  }

  async testNotificationManagers(): Promise<void> {
    await this.runTest("Notification Managers Status", async () => {
      const response = await fetch(
        `${this.serverUrl}/api/notifications/managers/status`,
        {
          timeout: this.requestTimeout,
        }
      );

      if (response.status === 404) {
        // Endpoint may not exist, skip
        return;
      }

      if (response.status !== 200) {
        throw new Error(`Failed to fetch managers status: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, any>;
      if (!Array.isArray(data.managers)) {
        throw new Error("Managers status response invalid");
      }
    });
  }

  async testNotificationChannels(): Promise<void> {
    await this.runTest("Notification Channels", async () => {
      const response = await fetch(
        `${this.serverUrl}/api/notifications/channels/status`,
        {
          timeout: this.requestTimeout,
        }
      );

      if (response.status === 404) {
        // Endpoint may not exist, skip
        return;
      }

      if (response.status !== 200) {
        throw new Error(`Failed to fetch channels status: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, any>;
      if (!Array.isArray(data.channels)) {
        throw new Error("Channels status response invalid");
      }
    });
  }

  async testApiEndpoints(): Promise<void> {
    const endpoints = [
      { path: "/api/customers", method: "GET", name: "List Customers" },
      { path: "/api/users", method: "GET", name: "List Users" },
      { path: "/api/vehicles", method: "GET", name: "List Vehicles" },
      { path: "/api/bookings", method: "GET", name: "List Bookings" },
    ];

    for (const endpoint of endpoints) {
      await this.runTest(`API: ${endpoint.name}`, async () => {
        const response = await fetch(`${this.serverUrl}${endpoint.path}`, {
          method: endpoint.method,
          timeout: this.requestTimeout,
        });

        // Accept 200, 401 (unauthorized), 403 (forbidden) as "working" endpoints
        if (![200, 401, 403].includes(response.status)) {
          throw new Error(
            `Endpoint returned ${response.status}. Expected 200, 401, or 403`
          );
        }
      });
    }
  }

  async testAuthentication(): Promise<void> {
    await this.runTest("Authentication System", async () => {
      const response = await fetch(`${this.serverUrl}/api/auth/session`, {
        method: "GET",
        timeout: this.requestTimeout,
      });

      // Session endpoint should return 200 or 401, not 404
      if (response.status === 404) {
        throw new Error("Authentication endpoint not found");
      }
    });
  }

  async testExternalIntegrations(): Promise<void> {
    // Test SendGrid configuration
    await this.runTest("SendGrid Configuration", async () => {
      if (!process.env.SENDGRID_API_KEY) {
        throw new Error("SENDGRID_API_KEY not configured");
      }
      // Just verify the key format
      if (!process.env.SENDGRID_API_KEY.startsWith("SG.")) {
        throw new Error("Invalid SendGrid API key format");
      }
    });

    // Test WhatsApp configuration
    await this.runTest("WhatsApp Provider Configuration", async () => {
      const provider = process.env.WHATSAPP_PROVIDER || "local";
      if (!["local", "official", "mock"].includes(provider)) {
        throw new Error(`Unknown WhatsApp provider: ${provider}`);
      }
    });
  }

  async testResponseTimes(): Promise<void> {
    await this.runTest("Response Time Baseline", async () => {
      const start = Date.now();

      const response = await fetch(`${this.serverUrl}/health`, {
        timeout: this.requestTimeout,
      });

      const responseTime = Date.now() - start;

      if (responseTime > 1000) {
        throw new Error(
          `Health endpoint took ${responseTime}ms (expected < 1000ms)`
        );
      }

      if (response.status !== 200) {
        throw new Error(`Health check failed: ${response.status}`);
      }
    });
  }

  async testNotificationDelivery(): Promise<void> {
    await this.runTest("Notification Delivery", async () => {
      try {
        // Try to send a test notification (if endpoint exists)
        const response = await fetch(
          `${this.serverUrl}/api/notifications/test-send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: "in_app",
              title: "Test Notification",
              message: "This is a test",
            }),
            timeout: this.requestTimeout,
          }
        );

        // Accept 200, 201, 404 (endpoint may not exist in all environments)
        if (![200, 201, 404].includes(response.status)) {
          throw new Error(`Unexpected response: ${response.status}`);
        }
      } catch (error: any) {
        if (error.message.includes("404")) {
          // Endpoint not required, skip
          return;
        }
        throw error;
      }
    });
  }

  generateReport(): SmokeTestReport {
    const passed = this.results.filter((t) => t.status === "PASS").length;
    const failed = this.results.filter((t) => t.status === "FAIL").length;
    const timeouts = this.results.filter((t) => t.status === "TIMEOUT").length;

    let overallStatus: "PASS" | "FAIL" | "TIMEOUT" = "PASS";
    if (failed > 0) {
      overallStatus = "FAIL";
    } else if (timeouts > 0) {
      overallStatus = "TIMEOUT";
    }

    return {
      timestamp: new Date().toISOString(),
      serverUrl: this.serverUrl,
      mongoUri: this.mongoUri.replace(/([^:]*:[^@]*)@/, "$1:***@"), // Hide password
      tests: this.results,
      summary: {
        total: this.results.length,
        passed,
        failed,
        timeouts,
        overallStatus,
      },
    };
  }

  async run(): Promise<SmokeTestReport> {
    console.log("🧪 Post-Deployment Smoke Tests Starting...\n");
    console.log(`Server URL: ${this.serverUrl}`);
    console.log(`Database: ${this.mongoUri.replace(/([^:]*:[^@]*)@/, "$1:***@")}\n`);

    // Run all tests
    await this.testServerStartup();
    await this.testDatabaseConnectivity();
    await this.testDatabaseQueries();
    await this.testNotificationManagers();
    await this.testNotificationChannels();
    await this.testApiEndpoints();
    await this.testAuthentication();
    await this.testExternalIntegrations();
    await this.testResponseTimes();
    await this.testNotificationDelivery();

    const report = this.generateReport();

    console.log("\n" + "=".repeat(60));
    console.log("📊 SMOKE TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Timeouts: ${report.summary.timeouts}`);
    console.log(`Overall Status: ${report.summary.overallStatus}`);
    console.log("=".repeat(60) + "\n");

    return report;
  }
}

async function main() {
  try {
    const tests = new SmokeTests();
    const report = await tests.run();

    // Output JSON report
    console.log("📄 JSON Report:");
    console.log(JSON.stringify(report, null, 2));

    // Exit with appropriate code
    process.exit(report.summary.overallStatus === "PASS" ? 0 : 1);
  } catch (error) {
    console.error("Fatal error during smoke tests:", error);
    process.exit(2);
  }
}

main();
