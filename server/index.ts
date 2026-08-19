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

import path from "path";
import fs from "fs";
import https from "https";
import { fileURLToPath } from "url";
import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes, getSessionMiddleware } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import connectDB from "./connectDB";
import { storage } from "./storage-mongodb";
import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import { setTelephonyEventEmitter, type TelephonyEvent } from "./telephony/index";
import { startGpsPollingScheduler, stopGpsPollingScheduler } from "./gps/ingestion/pollingScheduler";
import { startOperationsReminderScheduler, stopOperationsReminderScheduler } from "./operations/reminderEngine";
import { initializeAutoSyncScheduler } from "./services/payrollAutoSyncScheduler";
import SaaSSchedulerService from "./services/saas-scheduler-service";
import BillingScheduler from "./services/billing-scheduler";
// TASK-ROOT-SUPPORT-03 (Root Control Plane) additive middleware — attaches
// a correlation ID to every request (not just /api/root/**) before any
// route/error path runs. See docs/root-control-plane/ROOT-INTEGRATION-report.md.
import { correlationIdMiddleware } from "./root/middleware/correlationId";
import { requestLoggingMiddleware } from "./middleware/requestLogger";
import { errorHandlingMiddleware } from "./middleware/errorHandler";
import { healthMonitor } from "./utils/healthCheck";
import { createLogger } from "./utils/logger";

const log2 = createLogger('Server');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Trust only the known number of reverse-proxy hops. `true` trusts arbitrary
// X-Forwarded-For input when the app is directly reachable, allowing an
// attacker to rotate spoofed IPs and bypass IP rate limits.
const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS);
app.set('trust proxy', Number.isInteger(configuredProxyHops) && configuredProxyHops >= 0
  ? configuredProxyHops
  : (process.env.NODE_ENV === 'production' ? 1 : false));
// ULTRA FAST: Aggressive compression for slow networks
// - Level 9: Maximum compression (slightly slower but much smaller)
// - Threshold: 512 bytes (compress everything)
// - Brotli: Higher quality compression if supported
app.use(compression({
  level: 9,  // Maximum compression level (1-11 for brotli, 1-9 for gzip)
  threshold: 512,  // Compress responses > 512 bytes (default 1024)
  filter: (req, res) => {
    // Compress everything except images and already-compressed files
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Add structured request logging middleware
app.use(requestLoggingMiddleware);

// Capture the raw request body bytes alongside the parsed JSON — needed by
// both the telephony webhook (TASK-02) and GPS webhook (TASK-GPS-INGESTION-04)
// receivers to verify provider signatures against the actual wire bytes sent,
// not a reconstructed/re-serialized buffer (unsafe for a provider that signs
// literal bytes, e.g. differing whitespace/key order). Additive — every
// existing express.json() consumer is unaffected; req.rawBody is simply also
// populated now.
app.use(express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: false }));
app.use(correlationIdMiddleware);

// ULTRA FAST: Aggressive caching for static assets and API responses
app.use((req, res, next) => {
  // Cache static assets for 1 year (they have hash in filename)
  if (req.path.startsWith('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // Cache static files for 1 day
  else if (req.path.match(/\.(js|css|svg|woff2)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  // Cache API GET responses for 5 minutes (except user-specific data)
  else if (req.method === 'GET' && req.path.startsWith('/api/')) {
    if (req.path.includes('public') || req.path.includes('list') || req.path.includes('search')) {
      res.setHeader('Cache-Control', 'public, max-age=300');  // 5 minutes
    }
  }
  // Disable cache for mutations and user data
  else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

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
  log2.info('MongoDB connected successfully', { database: mongoose.connection.name });

  // Skip default admin user creation - secure admin already exists
  log2.info('Using existing secure admin credentials');

  // Check for emergency admin creation from environment variables
  try {
    const { createEmergencyAdmin } = await import("./admin-recovery");
    await createEmergencyAdmin();
  } catch (error) {
    // Silently continue if emergency admin creation fails
  }

  // Migrate ROOT user to have platformRole
  try {
    const { migrateRootPlatformRole } = await import("./migrations/migrate-root-platform-role");
    await migrateRootPlatformRole();
  } catch (error) {
    console.error('Migration error:', error);
    // Silently continue if migration fails
  }

  // Initialize database with default data if empty
  try {
    console.log("🔄 Checking database initialization...");

    // Check if root user exists
    let rootUser = await storage.getUser('fleet_root_admin_1d2af76b');
    if (!rootUser) {
      // Create root user with default password
      // Note: createUser will hash the password, so pass plain password here
      rootUser = await storage.createUser({
        userId: 'fleet_root_admin_1d2af76b',
        email: 'fleet_root_admin_1d2af76b@fleetpro.local',
        password: 'Change@123',
        platformRole: 'PLATFORM_ROOT',
        name: 'Root Admin',
        isActive: true,
        role: 'root',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log("✅ Root user created during initialization");
    }

    // Check if platform company exists
    const companies = await storage.getCompanies?.() || [];
    if (!companies || companies.length === 0) {
      try {
        const platformCompany = await storage.createPlatformCompany({
          name: 'FleetPro Platform',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log("✅ Platform company initialized");
      } catch (err) {
        // Platform company creation may fail if schema doesn't support it
        console.log("ℹ️  Platform company initialization skipped (not applicable)");
      }
    }

    console.log("✅ Database initialization complete");
  } catch (error) {
    console.error("Database initialization error:", error instanceof Error ? error.message : error);
    // Don't throw - allow app to continue even if initialization fails
  }

  // Dashboard route - serve dashboard.html directly
  app.get('/dashboard.html', (req, res) => {
    const dashboardPath = path.join(__dirname, '../public/dashboard.html');
    res.sendFile(dashboardPath);
  });

  // Health check endpoint for monitoring
  app.get('/health', async (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    const health = await healthMonitor.getStatus(dbConnected, mongoose.connection.name);
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;
    res.status(statusCode).json(health);
  });

  const server = await registerRoutes(app);

  // Store server instance globally for notifications
  (global as any).notificationServer = server;

  // Ensure notification system indexes
  try {
    const { notificationIndexManager } = await import('./utils/notificationIndexes');
    await notificationIndexManager.ensureIndexes();
    log2.info('Notification indexes verified');
  } catch (error) {
    log2.error('Failed to ensure notification indexes', { error });
  }

  // Initialize notification templates
  try {
    const { notificationTemplateManager } = await import('./utils/notificationTemplates');
    await notificationTemplateManager.initializeBuiltInTemplates();
    log2.info('Notification templates initialized');
  } catch (error) {
    log2.error('Failed to initialize notification templates', { error });
  }

  // Start notification scheduler
  try {
    const { notificationScheduler } = await import('./utils/notificationScheduler');
    notificationScheduler.start();
    log2.info('Notification scheduler started');
  } catch (error) {
    log2.error('Failed to start notification scheduler', { error });
  }

  // Start notification retry manager
  try {
    const { notificationRetryManager } = await import('./utils/notificationRetry');
    await notificationRetryManager.start();
    log2.info('Notification retry manager started');
  } catch (error) {
    log2.error('Failed to start notification retry manager', { error });
  }

  // Start notification rate limiter
  try {
    const { notificationRateLimiter } = await import('./utils/notificationRateLimiter');
    await notificationRateLimiter.start();
    log2.info('Notification rate limiter started');
  } catch (error) {
    log2.error('Failed to start notification rate limiter', { error });
  }

  // Start WhatsApp reminder processor
  try {
    const { startReminderProcessor } = await import('./services/whatsapp-reminder-scheduler');
    startReminderProcessor();
    log2.info('WhatsApp reminder processor started');
  } catch (error) {
    log2.error('Failed to start WhatsApp reminder processor', { error });
  }

  // Start WhatsApp auto-reconnect monitor
  try {
    const { WhatsAppAutoReconnect } = await import('./services/whatsapp-auto-reconnect');
    WhatsAppAutoReconnect.startAutoReconnectMonitor(5000);
    log2.info('WhatsApp auto-reconnect monitor started (checks every 5 seconds)');
  } catch (error) {
    log2.error('Failed to start WhatsApp auto-reconnect monitor', { error });
  }

  // Start WhatsApp fast connect cleanup job
  try {
    const { WhatsAppFastConnect } = await import('./services/whatsapp-fast-connect');
    WhatsAppFastConnect.startCleanupJob(60000);
    log2.info('WhatsApp fast connect cleanup started (every 60 seconds)');
  } catch (error) {
    log2.error('Failed to start WhatsApp fast connect cleanup', { error });
  }

  // Start notification webhook manager
  try {
    const { notificationWebhookManager } = await import('./utils/notificationWebhooks');
    await notificationWebhookManager.start();
    log2.info('Notification webhook manager started');
  } catch (error) {
    log2.error('Failed to start notification webhook manager', { error });
  }

  // Start notification batch processor
  try {
    const { notificationBatchProcessor } = await import('./utils/notificationBatchProcessor');
    await notificationBatchProcessor.start();
    log2.info('Notification batch processor started');
  } catch (error) {
    log2.error('Failed to start notification batch processor', { error });
  }

  // Integrator addition (TASK-02 telephony real-time hand-off — see
  // .claude/tasks/reports/TASK-02-report.md "Proposed WebSocket bootstrap
  // + room design"). No WebSocket/Socket.IO layer existed anywhere in this
  // codebase before this; server/telephony/services/callService.ts already
  // calls emitTelephonyEvent() at every point a room event should fire and
  // was a no-op until setTelephonyEventEmitter() below is wired in.
  //
  // Auth: reuse the existing session cookie via the same express-session
  // middleware instance server/routes.ts configured (exported via
  // getSessionMiddleware()), so a socket can only ever join rooms for the
  // tenant/user it already has an authenticated HTTP session for. Room
  // membership is decided entirely server-side from that session — never
  // from a client-supplied tenantId/userId — so a compromised client
  // cannot join another tenant's or another user's room by requesting it.
  const io = new SocketIOServer(server, {
    path: '/ws/telephony',
    cors: { origin: false }, // same-origin only; revisit if a separate frontend origin is introduced
  });

  const sessionMiddleware = getSessionMiddleware();
  if (sessionMiddleware) {
    io.engine.use(sessionMiddleware);
  } else {
    console.error('Telephony WebSocket: session middleware unavailable — sockets will be rejected.');
  }

  io.on('connection', (socket) => {
    void (async () => {
      try {
        const req = socket.request as any;
        const sessionUserId = req.session?.userId as string | undefined;
        if (!sessionUserId) {
          socket.disconnect(true);
          return;
        }
        const user = await storage.getUserBySessionId(sessionUserId);
        if (!user || !user.isActive) {
          socket.disconnect(true);
          return;
        }

        // Room membership, decided server-side from the authenticated
        // session only — see the room design table in TASK-02-report.md.
        socket.join(`user:${user.userId}`);
        const tenantId = user.tenantId
          ? (typeof user.tenantId === 'object' ? (user.tenantId as any)._id?.toString() : (user.tenantId as any).toString())
          : undefined;
        if (tenantId && (user.role === 'client' || user.role === 'admin')) {
          // Owner/admin combined-pipeline aggregation view (any executive's
          // call). `team:<tenantId>` is reserved for a future distinct
          // "manager over multiple executives" tier that doesn't exist in
          // the current admin|manager|client role enum.
          socket.join(`tenant:${tenantId}`);
        }

        // A client-initiated, explicitly-scoped join for whoever has a
        // specific call's detail page open. Gated by the same ownership
        // check as GET /api/telephony/calls/:id so a socket can't join an
        // arbitrary call room it has no access to.
        socket.on('telephony:subscribeCall', async (callSessionId: unknown) => {
          if (typeof callSessionId !== 'string' || !tenantId) return;
          try {
            const { getCallSessionForActor } = await import('./telephony/services/callService');
            const actor = { userId: user.userId, role: user.role as 'admin' | 'client' | 'manager' };
            const call = await getCallSessionForActor(actor, tenantId, callSessionId);
            if (call) socket.join(`call:${callSessionId}`);
          } catch (error) {
            console.error('telephony:subscribeCall error:', error instanceof Error ? error.message : error);
          }
        });
        socket.on('telephony:unsubscribeCall', (callSessionId: unknown) => {
          if (typeof callSessionId === 'string') socket.leave(`call:${callSessionId}`);
        });
      } catch (error) {
        console.error('Telephony WebSocket connection error:', error instanceof Error ? error.message : error);
        socket.disconnect(true);
      }
    })();
  });

  setTelephonyEventEmitter((event: TelephonyEvent) => {
    if (event.targetUserId) io.to(`user:${event.targetUserId}`).emit(event.type, event.payload);
    io.to(`tenant:${event.tenantId}`).emit(event.type, event.payload); // owner/admin aggregation view
    io.to(`call:${event.callSessionId}`).emit(event.type, event.payload); // anyone actively viewing this call's detail page
  });

  // Register socket.io for real-time updates (booking/driver/staff)
  try {
    const { setSocketIOInstance } = await import('./services/realtime-updates');
    setSocketIOInstance(io);
    log2.info('Socket.IO registered for real-time updates');
  } catch (error) {
    log2.error('Failed to register Socket.IO:', { error });
  }

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

  // Use HTTPS if SSL certs exist, otherwise HTTP
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
      log2.info(`HTTPS server started`, { host, port, ssl: true });
    });
  } else {
    server.listen({
      port,
      host,
    }, () => {
      log(`serving HTTP on ${host}:${port}`);
      log2.info(`HTTP server started`, { host, port, ssl: false });
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

  // Payroll Auto-Sync Scheduler — 100% automated driver salary processing
  // Runs hourly to sync attendance, bookings, advances, and recalculate salaries
  // Also processes monthly payroll automatically on 1st of each month
  if (mongoose.connection.readyState === 1) {
    try {
      initializeAutoSyncScheduler();
    } catch (error) {
      console.error('[SCHEDULER] Failed to initialize auto-sync scheduler:', error);
    }
  }
  mongoose.connection.on('connected', () => {
    try {
      initializeAutoSyncScheduler();
    } catch (error) {
      console.error('[SCHEDULER] Failed to initialize auto-sync scheduler on reconnect:', error);
    }
  });

  // SaaS Platform Scheduler — automated metrics aggregation and data sync
  // Runs hourly tenant metrics, billing every 6h, and comprehensive sync at 2 AM
  if (mongoose.connection.readyState === 1) {
    try {
      await SaaSSchedulerService.initialize();
    } catch (error) {
      console.error('[SAAS-SCHEDULER] Failed to initialize SaaS scheduler:', error);
    }
  }
  mongoose.connection.on('connected', async () => {
    try {
      await SaaSSchedulerService.initialize();
    } catch (error) {
      console.error('[SAAS-SCHEDULER] Failed to initialize SaaS scheduler on reconnect:', error);
    }
  });

  // Billing Scheduler — PHASE 4: Auto-invoicing for subscription renewals (P0-001 fix)
  // Generates monthly invoices at renewal dates, processes revenue metrics
  if (mongoose.connection.readyState === 1) {
    try {
      BillingScheduler.startScheduler();
    } catch (error) {
      console.error('[BILLING-SCHEDULER] Failed to initialize billing scheduler:', error);
    }
  }
  mongoose.connection.on('connected', () => {
    try {
      BillingScheduler.startScheduler();
    } catch (error) {
      console.error('[BILLING-SCHEDULER] Failed to initialize billing scheduler on reconnect:', error);
    }
  });

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
    SaaSSchedulerService.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(backgroundJobInterval);
    stopGpsPollingScheduler();
    stopOperationsReminderScheduler();
    SaaSSchedulerService.stop();
    process.exit(0);
  });
})();
