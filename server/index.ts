// Suppress Rollup bundle size warnings during development
if (process.env.NODE_ENV === 'development') {
  // Override process.emitWarning to filter out Rollup warnings
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function(warning: string | Error, ...args: any[]) {
    if (typeof warning === 'string') {
      // Filter out Rollup bundle size warnings
      if (warning.includes('build.rollupOptions.output.manualChunks') ||
          warning.includes('improve chunking') ||
          warning.includes('Bundle is larger than recommended limit') ||
          warning.includes('chunkSizeWarningLimit')) {
        return;
      }
    }
    return (originalEmitWarning as any).call(process, warning, ...args);
  };

  // Override console.warn to filter out Rollup warnings
  const originalConsoleWarn = console.warn;
  console.warn = function(...args) {
    const message = args.join(' ');
    
    // Filter out Rollup bundle size warnings
    if (message.includes('build.rollupOptions.output.manualChunks') ||
        message.includes('improve chunking') ||
        message.includes('https://rollupjs.org/configuration-options/#output-manualchunks') ||
        message.includes('Adjust chunk size limit for this warning via build.chunkSizeWarningLimit')) {
      return;
    }
    
    // Show other warnings
    originalConsoleWarn.apply(console, args);
  };
}

import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import connectDB from "./connectDB";
import { storage } from "./storage-mongodb";
import mongoose from "mongoose";
import { startGpsPollingScheduler, stopGpsPollingScheduler } from "./gps/ingestion/pollingScheduler";
import { startOperationsReminderScheduler, stopOperationsReminderScheduler } from "./operations/reminderEngine";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Trust only the known number of reverse-proxy hops. `true` trusts arbitrary
// X-Forwarded-For input when the app is directly reachable, allowing an
// attacker to rotate spoofed IPs and bypass IP rate limits.
const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS);
app.set('trust proxy', Number.isInteger(configuredProxyHops) && configuredProxyHops >= 0
  ? configuredProxyHops
  : (process.env.NODE_ENV === 'production' ? 1 : false));
// gzip/br response compression — over a real LAN link (vs loopback) this
// materially cuts transfer time for JSON API responses and any
// non-Vite-bundled assets; negligible CPU cost on a local dev machine.
app.use(compression());
// verify captures the raw request body alongside the existing parsed-body
// behavior — needed by the GPS webhook receiver (TASK-GPS-INGESTION-04) to
// verify provider signatures against the actual bytes sent, not a
// reconstructed buffer. Nothing about existing routes' req.body usage changes.
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Connect to MongoDB Atlas
  await connectDB();
  
  // Skip default admin user creation - secure admin already exists
  console.log('✅ Using existing secure admin credentials');

  // Check for emergency admin creation from environment variables
  try {
    const { createEmergencyAdmin } = await import("./admin-recovery");
    await createEmergencyAdmin();
  } catch (error) {
    // Silently continue if emergency admin creation fails
  }
  
  const server = await registerRoutes(app);
  
  // Store server instance globally for notifications
  (global as any).notificationServer = server;

  // P0 FIX: the global error handler must never throw after sending a
  // response — doing so previously crashed the Node process (or, depending
  // on the host, left the request hanging) on every handled error. It now
  // logs server-side without leaking stack traces/internal details to the
  // client, and never re-throws.
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 ? "Internal Server Error" : (err.message || "Request error");

    console.error(`Unhandled error on ${req.method} ${req.path}:`, err?.message || err);
    if (process.env.NODE_ENV !== 'production' && err?.stack) {
      console.error(err.stack);
    }

    if (res.headersSent) {
      return;
    }
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // P0 FIX: honor process.env.PORT (required by most hosting platforms —
  // Render, Heroku, etc — which assign the port dynamically) instead of a
  // hard-coded value, falling back to 5000 for local development.
  const port = Number(process.env.PORT) || 5000;
  const host = process.env.HOST || "0.0.0.0";

  // Use HTTPS if SSL certs exist (for network testing)
  const certPath = path.join(__dirname, '../ssl/cert.pem');
  const keyPath = path.join(__dirname, '../ssl/key.pem');
  const useSSL = fs.existsSync(certPath) && fs.existsSync(keyPath);

  if (useSSL) {
    const options = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
    https.createServer(options, app).listen({
      port,
      host,
    }, () => {
      log(`🔒 serving HTTPS on ${host}:${port}`);
    });
  } else {
    server.listen({
      port,
      host,
    }, () => {
      log(`serving HTTP on ${host}:${port}`);
    });
  }

  // P1 FIX: background job must not be re-registered on every 'connected'
  // event (e.g. reconnect after a network blip), which previously stacked
  // up duplicate intervals — each running the "mark expired bookings"
  // sweep concurrently and multiplying load/writes. We now guard with a
  // single module-level interval reference and only ever start one.
  let backgroundJobInterval: NodeJS.Timeout | undefined;

  const startBackgroundJob = () => {
    if (backgroundJobInterval) return; // already running
    log('MongoDB connected - starting background job');
    backgroundJobInterval = setInterval(async () => {
      try {
        if (mongoose.connection.readyState === 1) {
          const completedCount = await storage.markExpiredBookingsAsCompleted();
          if (completedCount > 0) {
            log(`Marked ${completedCount} expired booking(s) as completed`);
          }
        }
      } catch (error) {
        console.error(`Error in background job:`, error instanceof Error ? error.message : error);
      }
    }, 300000); // 5 minutes
  };

  const stopBackgroundJob = () => {
    if (backgroundJobInterval) {
      clearInterval(backgroundJobInterval);
      backgroundJobInterval = undefined;
      log('MongoDB disconnected - stopped background job');
    }
  };

  if (mongoose.connection.readyState === 1) {
    startBackgroundJob();
  }
  mongoose.connection.on('connected', startBackgroundJob);
  mongoose.connection.on('disconnected', stopBackgroundJob);

  // GPS telemetry polling (TASK-GPS-INGESTION-04) — same guarded-single-interval pattern as
  // the background job above; startGpsPollingScheduler() is itself idempotent (no-ops if
  // already running), so this is safe even if 'connected' fires more than once.
  if (mongoose.connection.readyState === 1) {
    startGpsPollingScheduler();
  }
  mongoose.connection.on('connected', () => startGpsPollingScheduler());
  mongoose.connection.on('disconnected', () => stopGpsPollingScheduler());

  // Booking End Reminder sweep (Live Operations) — persistent server-side
  // engine: every run re-derives due reminders from canonical Booking times,
  // so restarts lose nothing and a closed browser changes nothing (spec §48,
  // §58). Same guarded-single-interval pattern as the schedulers above.
  if (mongoose.connection.readyState === 1) {
    startOperationsReminderScheduler();
  }
  mongoose.connection.on('connected', () => startOperationsReminderScheduler());
  mongoose.connection.on('disconnected', () => stopOperationsReminderScheduler());

  // NOTE: this in-process interval only runs once per Node process. If this
  // app is ever deployed with multiple instances/replicas, move this sweep
  // to a dedicated cron/worker process or use a distributed lock (e.g. a
  // MongoDB-backed lock document) to avoid every instance racing to update
  // the same expired bookings. Documented in IMPLEMENTATION_PLAN.md (P1).

  // Cleanup on process termination
  process.on('SIGINT', () => {
    clearInterval(backgroundJobInterval);
    stopGpsPollingScheduler();
    stopOperationsReminderScheduler();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(backgroundJobInterval);
    stopGpsPollingScheduler();
    stopOperationsReminderScheduler();
    process.exit(0);
  });
})();
