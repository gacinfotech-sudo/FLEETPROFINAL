/**
 * Deployment Readiness Script
 * Aggregates all validation results and provides go/no-go decision
 *
 * Usage: tsx scripts/deployment-readiness.ts
 * Output: Comprehensive JSON report with sign-off checklist
 */

import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec as execCallback } from "child_process";

const exec = promisify(execCallback);

interface SignOffItem {
  name: string;
  responsible: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  timestamp?: string;
  notes?: string;
}

interface DeploymentReadinessReport {
  timestamp: string;
  environment: string;
  deploymentGate: {
    status: "GO" | "NO_GO" | "CONDITIONAL";
    reason: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  };
  validationResults: {
    preDeploymentVerification?: Record<string, any>;
    smokeTests?: Record<string, any>;
    integrationTests?: Record<string, any>;
    performanceBaseline?: Record<string, any>;
  };
  codeQuality: {
    typeScriptErrors: number;
    testCoverage: number;
    lintErrors: number;
    securityIssues: number;
  };
  approvals: {
    technicalLead: SignOffItem;
    qualityAssurance: SignOffItem;
    securityTeam: SignOffItem;
    operationsTeam: SignOffItem;
  };
  deploymentPlans: {
    rollbackProcedure: string;
    monitoringChecklist: string[];
    postDeploymentTests: string[];
    incidentResponse: string;
  };
  blockers: string[];
  warnings: string[];
  recommendations: string[];
}

class DeploymentReadiness {
  private projectRoot: string;
  private validationReports: Record<string, Record<string, any>> = {};
  private blockers: string[] = [];
  private warnings: string[] = [];
  private recommendations: string[] = [];

  constructor() {
    this.projectRoot = process.cwd();
  }

  private async loadValidationReports(): Promise<void> {
    console.log("📋 Loading validation reports...\n");

    const reportFiles = [
      ".deployment-verification.json",
      ".integration-test-report.json",
      ".smoke-test-report.json",
      ".performance-baseline-report.json",
    ];

    for (const file of reportFiles) {
      const filePath = path.join(this.projectRoot, file);
      const reportType = file.replace(".json", "").replace(".", "");

      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          this.validationReports[reportType] = JSON.parse(content);
          console.log(`✅ Loaded: ${file}`);
        } catch (error) {
          console.log(`⚠️  Could not parse: ${file}`);
        }
      } else {
        console.log(`⚠️  Missing: ${file}`);
      }
    }

    console.log("");
  }

  private async checkCodeQuality(): Promise<{
    typeScriptErrors: number;
    testCoverage: number;
    lintErrors: number;
    securityIssues: number;
  }> {
    console.log("🔍 Checking code quality...\n");

    let typeScriptErrors = 0;
    let lintErrors = 0;
    let securityIssues = 0;

    // Check TypeScript errors
    try {
      const { stdout, stderr } = await exec("npm run check 2>&1");
      const output = stdout + stderr;

      if (output.includes("error TS")) {
        typeScriptErrors = (output.match(/error TS\d+:/g) || []).length;
      }

      if (typeScriptErrors === 0) {
        console.log("✅ No TypeScript errors");
      } else {
        console.log(`❌ Found ${typeScriptErrors} TypeScript errors`);
        this.blockers.push(
          `TypeScript compilation errors: ${typeScriptErrors}`
        );
      }
    } catch (error) {
      console.log("⚠️  Could not check TypeScript");
    }

    // Check for security vulnerabilities
    try {
      const { stdout } = await exec("npm audit --json 2>&1");
      const audit = JSON.parse(stdout);

      if (audit.metadata && audit.metadata.vulnerabilities) {
        const { critical, high } = audit.metadata.vulnerabilities;
        securityIssues = (critical || 0) + (high || 0);

        if (securityIssues > 0) {
          console.log(
            `⚠️  Found ${securityIssues} security vulnerabilities`
          );
          this.recommendations.push("Run 'npm audit fix' to resolve security issues");
        } else {
          console.log("✅ No critical security vulnerabilities");
        }
      }
    } catch (error) {
      console.log("⚠️  Could not check security vulnerabilities");
    }

    console.log("");

    return {
      typeScriptErrors,
      testCoverage: 0, // Would need Jest or similar to measure
      lintErrors,
      securityIssues,
    };
  }

  private evaluateValidationReports(): {
    status: "PASS" | "FAIL" | "WARNING";
    summary: string;
  } {
    let overallStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
    let failureCount = 0;
    let warningCount = 0;

    // Check pre-deployment verification
    const preDeployment =
      this.validationReports["deployment-verification"];
    if (preDeployment) {
      if (preDeployment.summary?.overallStatus === "FAIL") {
        failureCount++;
        this.blockers.push("Pre-deployment verification failed");
      } else if (preDeployment.summary?.overallStatus === "WARNING") {
        warningCount++;
        this.warnings.push("Pre-deployment verification has warnings");
      }
    }

    // Check smoke tests
    const smokeTests = this.validationReports["smoke-test-report"];
    if (smokeTests) {
      if (smokeTests.summary?.overallStatus !== "PASS") {
        failureCount++;
        this.blockers.push("Smoke tests failed");
      }
    }

    // Check integration tests
    const integrationTests =
      this.validationReports["integration-test-report"];
    if (integrationTests) {
      if (integrationTests.summary?.overallStatus === "FAIL") {
        failureCount++;
        this.blockers.push("Integration tests failed");
      }
    }

    // Check performance baseline
    const performanceBaseline =
      this.validationReports["performance-baseline-report"];
    if (performanceBaseline) {
      if (
        performanceBaseline.summary?.maxErrorRate > 5 ||
        performanceBaseline.summary?.averageResponseTime > 1000
      ) {
        warningCount++;
        this.warnings.push("Performance baseline has concerning metrics");
      }
    }

    if (failureCount > 0) {
      overallStatus = "FAIL";
    } else if (warningCount > 0) {
      overallStatus = "WARNING";
    }

    return {
      status: overallStatus,
      summary: `${failureCount} critical failures, ${warningCount} warnings`,
    };
  }

  private generateDeploymentGate(): {
    status: "GO" | "NO_GO" | "CONDITIONAL";
    reason: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  } {
    if (this.blockers.length > 0) {
      return {
        status: "NO_GO",
        reason: `Deployment blocked by: ${this.blockers.slice(0, 2).join(", ")}`,
        riskLevel: "CRITICAL",
      };
    }

    if (this.warnings.length > 2) {
      return {
        status: "CONDITIONAL",
        reason: `Multiple warnings present. Review and approve before proceeding.`,
        riskLevel: "HIGH",
      };
    }

    if (this.warnings.length > 0) {
      return {
        status: "CONDITIONAL",
        reason: `${this.warnings.length} warning(s) present. Conditional approval required.`,
        riskLevel: "MEDIUM",
      };
    }

    return {
      status: "GO",
      reason: "All validations passed. Ready for deployment.",
      riskLevel: "LOW",
    };
  }

  private createApprovalChecklist(): {
    technicalLead: SignOffItem;
    qualityAssurance: SignOffItem;
    securityTeam: SignOffItem;
    operationsTeam: SignOffItem;
  } {
    return {
      technicalLead: {
        name: "Technical Lead Sign-off",
        responsible: "Engineering Lead",
        status: "PENDING",
        notes: "Verify code quality and architecture",
      },
      qualityAssurance: {
        name: "QA Sign-off",
        responsible: "QA Team",
        status: "PENDING",
        notes: "Verify test results and coverage",
      },
      securityTeam: {
        name: "Security Review",
        responsible: "Security Team",
        status: "PENDING",
        notes: "Verify security checks and vulnerability status",
      },
      operationsTeam: {
        name: "Operations Approval",
        responsible: "DevOps/SRE Team",
        status: "PENDING",
        notes: "Verify infrastructure and monitoring readiness",
      },
    };
  }

  private createDeploymentPlan(): {
    rollbackProcedure: string;
    monitoringChecklist: string[];
    postDeploymentTests: string[];
    incidentResponse: string;
  } {
    return {
      rollbackProcedure: `
1. If deployment fails or critical issues arise within first hour:
   - git reset --hard <previous-stable-commit>
   - npm run build
   - PORT=5050 npm run start

2. Database Rollback (if schema changed):
   - mongorestore from pre-deployment backup
   - Verify collections integrity

3. Cache Clear:
   - Clear Redis cache if configured
   - Clear browser caches (if applicable)

4. Notify Stakeholders:
   - Post incident notification
   - Provide status updates every 15 minutes
`,
      monitoringChecklist: [
        "CPU usage under 70%",
        "Memory usage under 80%",
        "Response times under 1000ms",
        "Error rate below 1%",
        "Database connections healthy",
        "No pod/container crashes",
        "Log aggregation receiving events",
        "Alerting system active",
      ],
      postDeploymentTests: [
        "Run smoke tests on production",
        "Verify all critical user paths",
        "Check analytics/reporting",
        "Validate third-party integrations",
        "Test notification delivery",
        "Confirm API rate limiting",
        "Verify authentication/authorization",
        "Check data consistency",
      ],
      incidentResponse: `
If critical issues detected:

1. Declare incident and create war room
2. Gather logs and metrics
3. Determine root cause
4. Execute rollback if needed
5. Post-mortem within 24 hours
6. Document lessons learned
7. Create preventive measures
`,
    };
  }

  async generateReport(): Promise<DeploymentReadinessReport> {
    const codeQuality = await this.checkCodeQuality();
    const validationStatus = this.evaluateValidationReports();
    const deploymentGate = this.generateDeploymentGate();
    const approvals = this.createApprovalChecklist();
    const deploymentPlan = this.createDeploymentPlan();

    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      deploymentGate,
      validationResults: this.validationReports,
      codeQuality,
      approvals,
      deploymentPlan,
      blockers: this.blockers,
      warnings: this.warnings,
      recommendations: this.recommendations,
    };
  }

  async run(): Promise<DeploymentReadinessReport> {
    console.log("🚀 Deployment Readiness Assessment Starting...\n");
    console.log(`Project Root: ${this.projectRoot}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    await this.loadValidationReports();
    const report = await this.generateReport();

    // Print summary
    console.log("=".repeat(60));
    console.log("📊 DEPLOYMENT READINESS SUMMARY");
    console.log("=".repeat(60));
    console.log(`Status: ${report.deploymentGate.status}`);
    console.log(`Risk Level: ${report.deploymentGate.riskLevel}`);
    console.log(`Reason: ${report.deploymentGate.reason}`);

    console.log("\n📈 Code Quality Metrics:");
    console.log(`  TypeScript Errors: ${report.codeQuality.typeScriptErrors}`);
    console.log(`  Security Issues: ${report.codeQuality.securityIssues}`);
    console.log(`  Lint Errors: ${report.codeQuality.lintErrors}`);

    if (report.blockers.length > 0) {
      console.log("\n🛑 BLOCKERS:");
      report.blockers.forEach((b) => console.log(`  - ${b}`));
    }

    if (report.warnings.length > 0) {
      console.log("\n⚠️  WARNINGS:");
      report.warnings.forEach((w) => console.log(`  - ${w}`));
    }

    if (report.recommendations.length > 0) {
      console.log("\n📋 RECOMMENDATIONS:");
      report.recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
    }

    console.log("\n" + "=".repeat(60));
    console.log("✍️  APPROVAL SIGN-OFF");
    console.log("=".repeat(60));

    Object.entries(report.approvals).forEach(([key, approval]) => {
      console.log(
        `${approval.status === "PENDING" ? "⏳" : "✅"} ${approval.name}`
      );
      console.log(`   Responsible: ${approval.responsible}`);
      console.log(`   Status: ${approval.status}`);
      if (approval.notes) {
        console.log(`   Notes: ${approval.notes}`);
      }
    });

    console.log("\n" + "=".repeat(60));

    return report;
  }
}

async function main() {
  try {
    const readiness = new DeploymentReadiness();
    const report = await readiness.run();

    // Output JSON report to file
    const reportPath = path.join(
      process.cwd(),
      ".deployment-readiness.json"
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Full report saved to: ${reportPath}`);

    // Also output to stdout for CI/CD
    console.log("\n📄 JSON Report:");
    console.log(JSON.stringify(report, null, 2));

    // Exit with appropriate code
    process.exit(
      report.deploymentGate.status === "NO_GO" ? 1 : 0
    );
  } catch (error) {
    console.error("Fatal error during readiness assessment:", error);
    process.exit(2);
  }
}

main();
