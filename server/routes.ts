import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MongoStore from "connect-mongo";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { fileTypeFromFile } from "file-type";
import { storage } from "./storage-mongodb";
import { authenticateUser, requireAdmin, requireTenant, type AuthRequest } from "./middleware/auth";
import { requirePermission, PERMISSIONS } from "./middleware/permissions";
import { 
  validatePasswordStrength, 
  loginRateLimit, 
  loginSpeedLimit, 
  httpsRedirect, 
  securityHeaders,
  trackLoginAttempt,
  getRecentFailedAttempts,
  getLastLoginInfo,
  checkUserLockout,
  loginAttempts,
  sanitizeInput,
  ipBlockingMiddleware,
  sessionSecurityMiddleware,
  databaseSecurityMiddleware,
  issueCsrfToken,
  csrfProtection,
  type LoginAttempt
} from "./middleware/security";
import { z } from "zod";
import { nanoid } from "nanoid";
import mongoose from "mongoose";
import {
  mongoTenantSchema,
  mongoUserSchema,
  mongoVehicleSchema,
  mongoDriverSchema,
  mongoBookingSchema
} from "./schemas/mongodb-schemas";
import {
  transitionBooking,
  getAllowedNextStatuses,
  isValidStatus,
  InvalidTransitionError,
  type BookingStatus,
} from "./services/bookingStateMachine";
import { buildLiveOperations } from "./services/liveOperations";
import { buildUpcomingBookings, classifyUpcomingBookings } from "./services/upcomingBookings";
import { buildPaymentDues } from "./services/paymentDues";
import { whatsappProvider } from "./whatsapp/index";
import { buildMessage, type MessageType } from "./whatsapp/templates";
import { normalizeIndianPhone } from "./whatsapp/phone";
import { WhatsAppMessage, Booking } from "./models/index";
import { sendBookingMessage } from "./whatsapp/sendBookingMessage";
import { buildCustomerTemplatePreviews, CUSTOMER_TEMPLATE_KEYS, type CustomerTemplateKey } from "./whatsapp/customerTemplates";
import { findVehicleConflicts, checkDriverAvailability, combineDateTime } from "./services/availability";
import { recordPayment, reversePayment, recomputeBookingPaymentSummary, RECEIPT_TYPES } from "./services/paymentLedger";
import { PaymentTransaction, Customer } from "./models/index";
import { findOrCreateCustomer, recomputeCustomerStats, classifyCustomer } from "./services/customerService";
import { creditBookingReward, reverseBookingReward, previewRedemption, commitRedemption, computeLoyaltyTier, getRewardRule, adjustRewardPoints, creditVerifiedGoogleReviewReward } from "./services/rewardService";
import { RewardTransaction, RewardRule } from "./models/index";
import { computeSegments, computeTagCounts, getSegmentFilter } from "./services/segmentService";
import { CustomerTagEvent, CustomerFeedback, CustomerComplaint, CustomerFollowUp, CustomerRequirement, CustomerConsentEvent, CustomerBillingProfile, Invoice, Campaign, CampaignRecipient, GoogleReviewTracking, Inquiry, Lead, Quotation, LeadFollowUp, BookingDraft } from "./models/index";
import { nextInquiryNumber } from "./services/inquiryNumbering";
import { isTerminalInquiryStatus, assertValidInquiryTransition, getMissingQualificationFields, type InquiryStatusValue } from "./services/inquiryStatus";
import { nextLeadNumber } from "./services/leadNumbering";
import { assertValidLeadTransition, type LeadStatusValue } from "./services/leadStatus";
import { nextQuotationNumber } from "./services/quotationNumbering";
import { assertValidQuotationTransition, isImmutableQuotationStatus, computeOptionTotalPaise, type QuotationStatusValue } from "./services/quotationStatus";
import { sendQuotationMessage } from "./whatsapp/sendQuotationMessage";
import { computeCustomerTimeline } from "./services/timelineService";
import { previewCampaign, sendCampaign } from "./services/campaignService";
import { buildDriverPerformance } from "./services/driverPerformance";
import { buildVehiclePerformance } from "./services/vehiclePerformance";
import { findDuplicateCandidates, mergeCustomers } from "./services/customerMergeService";
import { buildCustomerFinancialSummary, buildPaymentReceipt } from "./services/customerFinancialService";
import { addCurrentInvoiceSettlements, createAdjustmentNote, createInvoiceDraft, finalizeInvoice, previewInvoice, reviseInvoice, updateInvoiceDraft } from "./services/invoiceService";
import { getInvoiceSettings, upsertInvoiceSettings } from "./services/invoiceSettingsService";
import { buildCustomerDriverHistory, buildDriverFeedbackProfile } from "./services/driverFeedbackService";
import { buildCustomerVehicleHistory, buildVehicleFeedbackProfile } from "./services/vehicleFeedbackService";
import { DriverLeave, DriverAttendance } from "./models/index";

// Statuses where the booking has been financially finalized — further
// financial edits require an explicit adjustment reason instead of a
// silent field overwrite ("a closed booking cannot be financially edited
// without an adjustment entry").
const FINANCIAL_FIELDS = [
  'totalAmount', 'paymentStatus', 'tollCharges', 'parkingCharges', 'petrolCharges',
  'dieselCharges', 'cngCharges', 'miscellaneousAmount', 'thirdPartyDriverCharges',
];

const GOOGLE_REVIEW_CHANNELS = ['whatsapp', 'email', 'sms', 'phone', 'in_person', 'other'] as const;
const REVIEW_ELIGIBLE_STATUSES = new Set(['completed', 'payment_pending', 'closed']);

function safeGoogleReviewUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const googleOwnedHost = host === 'g.page' || host === 'goo.gl' || host.endsWith('.goo.gl')
      || host === 'google.com' || host.endsWith('.google.com');
    return ['http:', 'https:'].includes(url.protocol) && googleOwnedHost ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function googleReviewRequestMessage(customer: any, booking: any, tenant: any, reviewPageUrl: string) {
  const business = tenant?.businessName || tenant?.name || 'FleetPro';
  return [
    `Namaste ${customer.name || 'Customer'} ji,`,
    `Booking ${booking.bookingId} (${booking.pickupLocation} → ${booking.dropoffLocation || '-'}) ke liye dhanyavaad.`,
    'Aap apna genuine experience Google par share kar sakte hain:',
    reviewPageUrl,
    'Review dena poori tarah optional hai. Aapke honest feedback se hume service improve karne mein madad milegi.',
    `- ${business}`,
  ].join('\n');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // P0 SECURITY HELPER: admin users are allowed cross-tenant access (see
  // requireTenant middleware); everyone else must be scoped to their own
  // tenant on every single-record read/update/delete to prevent IDOR
  // (one tenant reading/modifying another tenant's data by guessing an id).
  const scopeTenant = (req: AuthRequest): string | undefined =>
    req.user?.role === "admin" ? undefined : req.tenantId;

  const escapeRegex = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Mongoose reads in this file are often populated, while request bodies
  // contain plain string IDs. Normalize both shapes before comparison or
  // availability queries; String(populatedDocument) is "[object Object]".
  const refId = (value: any): string => {
    if (!value) return '';
    const raw = value._id ?? value;
    return raw?.toString?.() ?? String(raw);
  };

  // P0 SECURITY HELPER: extension allow-list based on the *declared*
  // mimetype, used only to pick a safe filename to write to disk. This is
  // NOT itself the security boundary — see verifyUploadedImage() below,
  // which re-checks the actual file bytes after upload, since a client can
  // lie about both the filename and the mimetype header.
  const SAFE_IMAGE_EXTENSIONS: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  function getSafeImageExtension(_originalName: string, mimetype: string): string | null {
    return SAFE_IMAGE_EXTENSIONS[mimetype] || null;
  }

  // P0 SECURITY: verify the file we just wrote to disk is *actually* an
  // image of the type its extension claims, by sniffing its magic bytes —
  // a client-supplied `Content-Type`/filename can trivially lie (e.g.
  // upload a polyglot HTML/SVG-with-script file named "logo.png"). If the
  // real file signature doesn't match an allowed image type, delete the
  // file and reject the request. Callers should invoke this from inside
  // the route handler (after multer has already written the file) and
  // return a 400 if it returns false.
  async function verifyUploadedImage(filePath: string): Promise<boolean> {
    try {
      const type = await fileTypeFromFile(filePath);
      const allowed = new Set(['jpg', 'png', 'webp']);
      if (!type || !allowed.has(type.ext)) {
        await fs.promises.unlink(filePath).catch(() => {});
        return false;
      }
      return true;
    } catch {
      await fs.promises.unlink(filePath).catch(() => {});
      return false;
    }
  }

  // P1 PATTERN (for future private documents — self-drive KYC, driving
  // licence, Aadhaar, damage photos; see IMPLEMENTATION_PLAN.md P2): any
  // route that serves a tenant-private uploaded file MUST go through
  // something like this instead of express.static, so cross-tenant access
  // is impossible even if a filename is guessed/leaked.
  function servePrivateTenantFile(baseDir: string) {
    return async (req: AuthRequest, res: express.Response) => {
      const requestedTenantId = req.params.tenantId;
      if (scopeTenant(req) && scopeTenant(req) !== requestedTenantId) {
        return res.status(404).json({ message: "Not found" });
      }
      const safeName = path.basename(req.params.filename); // strip any path traversal
      const filePath = path.join(baseDir, requestedTenantId, safeName);
      if (!filePath.startsWith(path.resolve(baseDir))) {
        return res.status(400).json({ message: "Invalid path" });
      }
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Not found" });
      }
      res.sendFile(path.resolve(filePath));
    };
  }
  // Registered here so it's available to P2 work without re-plumbing;
  // currently unused because no private-document upload routes exist yet.
  void servePrivateTenantFile;

  // Apply enhanced security middleware
  app.use(httpsRedirect);
  app.use(securityHeaders);
  app.use(ipBlockingMiddleware);
  app.use(sanitizeInput);
  app.use(databaseSecurityMiddleware);
  
  // P0 FIX: SESSION_SECRET is now mandatory. A hard-coded fallback secret
  // means anyone who reads the source (which is what happened here) can
  // forge valid session cookies for any user, including admins. Fail fast
  // instead of silently booting with a known, guessable secret.
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    console.error(
      "FATAL: SESSION_SECRET environment variable is missing or too short. " +
      "Set SESSION_SECRET to a random string of at least 32 characters " +
      "(e.g. `openssl rand -hex 32`) before starting the server."
    );
    process.exit(1);
  }

  // P0 FIX: express-session defaults to MemoryStore, which leaks memory,
  // does not work across multiple processes/instances, and loses all
  // sessions on every restart/deploy. Use a MongoDB-backed store so
  // sessions are durable and shareable across instances.
  const mongoUrl = process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error("FATAL: MONGODB_URI is required to configure the session store.");
    process.exit(1);
  }

  // Session configuration with enhanced security and PWA support
  app.use(session({
    secret: sessionSecret,
    name: 'fleetpro.sid', // avoid leaking that this is an express app via default 'connect.sid'
    resave: false,
    saveUninitialized: false,
    rolling: true, // reset maxAge on every response -> sliding session expiry
    store: MongoStore.create({
      mongoUrl,
      collectionName: 'sessions',
      ttl: 30 * 24 * 60 * 60, // 30 days, mirrors cookie maxAge below
      crypto: { secret: sessionSecret }, // encrypt session payload at rest
      autoRemove: 'native',
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for PWA persistence
      sameSite: 'lax' // Changed from 'strict' to 'lax' for better PWA compatibility
    }
  }));

  // Apply session security middleware (hijacking/fingerprint checks)
  app.use(sessionSecurityMiddleware);

  // Issue a CSRF token into every session, then enforce it on state-changing
  // requests. See middleware/security.ts for rationale.
  app.use(issueCsrfToken);
  app.use(csrfProtection);

  // Client fetches this once on load / after login to get the current
  // CSRF token to echo back as the X-CSRF-Token header.
  app.get("/api/csrf-token", (req: any, res) => {
    res.json({ csrfToken: req.session.csrfToken });
  });

  // Multer configuration for logo uploads
  const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads/logos';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const userId = user?.userId || 'user';
      const timestamp = Date.now();
      // P0 FIX: sanitize the extension instead of trusting the client's
      // original filename verbatim — a crafted filename like
      // "logo.png.php" or one containing path separators could otherwise
      // be used for path traversal or to smuggle an executable extension
      // onto disk. We only ever accept one of the allow-listed extensions.
      const ext = getSafeImageExtension(file.originalname, file.mimetype);
      if (!ext) {
        return cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'), '');
      }
      const filename = `logo_${userId}_${timestamp}${ext}`;
      cb(null, filename);
    }
  });

  const logoUpload = multer({
    storage: logoStorage,
    limits: {
      fileSize: 20480 // 20KB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
      }
    }
  });

  // Signature upload configuration
  const signatureStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads/signatures';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const userId = user?.userId || 'user';
      const timestamp = Date.now();
      const ext = getSafeImageExtension(file.originalname, file.mimetype);
      if (!ext) {
        return cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'), '');
      }
      const filename = `signature_${userId}_${timestamp}${ext}`;
      cb(null, filename);
    }
  });

  const signatureUpload = multer({
    storage: signatureStorage,
    limits: {
      fileSize: 20480 // 20KB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
      }
    }
  });

  // P0 FIX: `express.static` served the ENTIRE uploads/ directory to
  // anyone, unauthenticated, with no tenant check — this is acceptable for
  // /uploads/logos and /uploads/signatures (business branding assets meant
  // to appear on customer-facing invoices/booking pages), but is NOT safe
  // for any future private document (self-drive KYC, driving licence,
  // Aadhaar, damage photos — see IMPLEMENTATION_PLAN.md P2). We therefore
  // scope the public static mount to only those two known-public
  // subdirectories, and provide `servePrivateTenantFile` below as the
  // pattern future private-document routes must use instead of
  // express.static.
  app.use('/uploads/logos', express.static('uploads/logos'));
  app.use('/uploads/signatures', express.static('uploads/signatures'));

  // Auth Routes with security enhancements
  app.post("/api/auth/login", loginRateLimit, loginSpeedLimit, checkUserLockout, async (req, res) => {
    // P0 FIX: no bodies/passwords are logged for auth endpoints.
    try {
      const { userId, password } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      
      if (!userId || !password) {
        return res.status(400).json({ message: "User ID and password are required" });
      }

      // Check for recent failed attempts
      const recentFailedAttempts = getRecentFailedAttempts(userId);
      if (recentFailedAttempts >= 5) {
        trackLoginAttempt(userId, clientIP, false, userAgent);
        return res.status(429).json({ 
          message: "Account temporarily locked due to too many failed login attempts. Please wait 5 minutes.",
          lockoutTime: 5 * 60
        });
      }

      const user = await storage.getUserByCredentials(userId, password);
      
      if (!user) {
        // Track failed login attempt
        trackLoginAttempt(userId, clientIP, false, userAgent);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user is active
      if (!user.isActive) {
        if (user.role === 'client') {
          return res.status(403).json({
            message: "Your service has been paused due to pending payment. Please contact your administrator to reactivate your account.",
            code: "ACCOUNT_INACTIVE"
          });
        } else if (user.role === 'manager') {
          return res.status(403).json({
            message: "Your organization has deactivated your account. Please contact your administrator for assistance.",
            code: "ACCOUNT_DEACTIVATED"
          });
        } else {
          // Covers 'admin' and any future role: a deactivated account must
          // never be allowed to complete login, regardless of role.
          return res.status(403).json({
            message: "This account has been deactivated. Please contact support for assistance.",
            code: "ACCOUNT_DEACTIVATED"
          });
        }
      }

      // Track successful login
      trackLoginAttempt(userId, clientIP, true, userAgent);
      
      // Update last login information in database
      await storage.updateUserLoginInfo(user.id, clientIP, userAgent);

      // PWA-friendly session management - allow longer sessions but prevent concurrent logins
      const sessionId = nanoid();
      const deviceInfo = {
        userAgent: userAgent,
        ip: clientIP,
        loginTime: new Date()
      };
      
      // Always update session in database
      try {
        await storage.updateUserSession(user.id, sessionId, deviceInfo);
        // P0 FIX: never log the session id — it is a bearer credential
        // equivalent to a password; anyone with log access could hijack the
        // session with it.
        console.log('Session updated successfully for user:', user.userId);
      } catch (error) {
        console.error('Error updating user session:', error);
        return res.status(500).json({ message: "Failed to create session" });
      }
      
      // Set session cookie
      (req.session as any).userId = sessionId;
      
      // Save session to ensure it's properly stored before response
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
          return res.status(500).json({ message: "Failed to save session" });
        }
        
        res.json({
          user: {
            id: user.id,
            userId: user.userId,
            role: user.role,
            tenantId: user.tenantId,
            mustResetPassword: user.mustResetPassword,
            hasCompletedOnboarding: user.hasCompletedOnboarding || false,
            isActive: user.isActive
          }
        });
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Fix tenant association for users without tenantId
  app.post("/api/admin/fix-tenant-links", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenants = await storage.getTenants();
      const users = await storage.getUsers();
      
      let fixedCount = 0;
      
      for (const user of users) {
        if (user.role === 'client' && !user.tenantId) {
          // Find tenant with matching name to userId
          const tenant = tenants.find(t => t.name === user.userId);
          if (tenant) {
            console.log(`Linking user ${user.userId} to tenant ${tenant._id}`);
            await storage.updateUser((user._id || user.id).toString(), { tenantId: tenant._id || tenant.id });
            fixedCount++;
          }
        }
      }
      
      res.json({ message: `Fixed ${fixedCount} users`, fixedCount });
    } catch (error) {
      console.error('Error fixing tenant links:', error);
      res.status(500).json({ message: "Failed to fix tenant links" });
    }
  });

  app.post("/api/auth/logout", authenticateUser, async (req: AuthRequest, res) => {
    try {
      await storage.updateUserSession(req.user.id, null);
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: "Logout failed" });
        }
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      res.status(500).json({ message: "Logout failed" });
    }
  });

  app.get("/api/auth/me", authenticateUser, async (req: AuthRequest, res) => {
    try {
      // Get fresh user data from database to ensure hasCompletedOnboarding is current
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        user: {
          id: user.id,
          userId: user.userId,
          role: user.role,
          tenantId: user.tenantId,
          mustResetPassword: user.mustResetPassword,
          hasCompletedOnboarding: user.hasCompletedOnboarding || false,
          isActive: user.isActive
        }
      });
    } catch (error) {
      console.error('Error in /api/auth/me:', error);
      res.status(500).json({ message: "Failed to fetch user data" });
    }
  });

  app.post("/api/auth/complete-onboarding", authenticateUser, async (req: AuthRequest, res) => {
    try {
      console.log('Complete onboarding request from user:', req.user.userId, 'role:', req.user.role);
      
      // Only allow client users to complete onboarding
      if (req.user.role !== 'client') {
        return res.status(403).json({ message: "Only client users can complete onboarding" });
      }
      
      await storage.markOnboardingComplete(req.user.userId);
      console.log('Onboarding completed successfully for user:', req.user.userId);
      res.json({ message: "Onboarding completed successfully" });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  app.post("/api/auth/reset-password", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { newPassword, confirmPassword } = req.body;
      
      // Validate passwords
      if (!newPassword || !confirmPassword) {
        return res.status(400).json({ message: "Both password fields are required" });
      }
      
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }
      
      // Enhanced password strength validation
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ message: passwordValidation.message });
      }
      
      // Reset password
      await storage.resetUserPassword(req.user.id, newPassword);
      
      // Clear session to force re-login with new password
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: "Password reset failed" });
        }
        res.json({ message: "Password reset successfully. Please login with your new password." });
      });
    } catch (error) {
      res.status(500).json({ message: "Password reset failed" });
    }
  });

  // Business profile routes
  app.get("/api/auth/business-profile", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      let businessDetails = null;
      let tenantInfo = null;
      
      if (user.role === 'manager') {
        // For managers, don't return business details in profile view
        // They inherit the profile for invoices but can't see the details
        businessDetails = null;
        
        if (user.tenantId) {
          const tenantIdString = typeof user.tenantId === 'object' && user.tenantId._id 
            ? user.tenantId._id.toString() 
            : user.tenantId.toString();
          tenantInfo = await storage.getTenant(tenantIdString);
        }
      } else if (user.role === 'client') {
        // For client users, use their own business profile and get tenant info
        businessDetails = user.businessDetails || null;
        
        if (user.tenantId) {
          const tenantIdString = typeof user.tenantId === 'object' && user.tenantId._id 
            ? user.tenantId._id.toString() 
            : user.tenantId.toString();
          tenantInfo = await storage.getTenant(tenantIdString);
        }
      } else {
        // For admin users, use their own profile (if any)
        businessDetails = user.businessDetails || null;
      }
      
      res.json({ 
        businessDetails,
        maxManagers: tenantInfo?.maxManagers || 5
      });
    } catch (error) {
      console.error('Error fetching business profile:', error);
      res.status(500).json({ message: "Failed to fetch business profile" });
    }
  });

  // Separate endpoint for invoice/report business profile data (includes inherited data for managers)
  app.get("/api/auth/business-profile-for-documents", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      let businessDetails = null;
      
      if (user.role === 'manager') {
        // For managers, get business profile from their company owner (client) for documents
        if (user.tenantId) {
          const tenantIdString = typeof user.tenantId === 'object' && user.tenantId._id 
            ? user.tenantId._id.toString() 
            : user.tenantId.toString();
          
          // Find the client user for this tenant who has the business profile
          const tenantUsers = await storage.getUsersByTenant(tenantIdString);
          const clientUser = tenantUsers.find(u => u.role === 'client');
          
          if (clientUser && clientUser.businessDetails) {
            businessDetails = clientUser.businessDetails;
          }
        }
      } else if (user.role === 'client') {
        // For client users, use their own business profile
        businessDetails = user.businessDetails || null;
      } else {
        // For admin users, use their own profile (if any)
        businessDetails = user.businessDetails || null;
      }
      
      res.json({ 
        businessDetails
      });
    } catch (error) {
      console.error('Error fetching business profile for documents:', error);
      res.status(500).json({ message: "Failed to fetch business profile for documents" });
    }
  });

  app.put("/api/auth/business-profile", authenticateUser, async (req: AuthRequest, res) => {
    try {
      // Only allow client users and admins to update business profile
      if (req.user.role === 'manager') {
        return res.status(403).json({ 
          message: "Access denied. Managers inherit business profile from their company owner. Contact your administrator to update business details." 
        });
      }
      
      const { businessName, ownerName, businessAddress, gstNumber, businessEmail, businessPhone } = req.body;
      
      // Validate required fields
      if (!businessName || !ownerName || !businessAddress || !businessEmail || !businessPhone) {
        return res.status(400).json({ message: "All fields except GST number are required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(businessEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Get existing user data to preserve logo and signature URLs
      const existingUser = await storage.getUser(req.user.id);
      const existingBusinessDetails = existingUser?.businessDetails as any || {};
      
      console.log('Preserving existing business details:', {
        logoUrl: existingBusinessDetails?.logoUrl,
        signatureUrl: existingBusinessDetails?.signatureUrl
      });

      const businessDetails = {
        businessName,
        ownerName,
        businessAddress,
        gstNumber: gstNumber || "",
        businessEmail,
        businessPhone,
        // Preserve existing logo and signature URLs
        logoUrl: existingBusinessDetails?.logoUrl || "",
        signatureUrl: existingBusinessDetails?.signatureUrl || ""
      };

      console.log('Updated business details with preserved URLs:', businessDetails);

      await storage.updateUser(req.user.id, { businessDetails });
      res.json({ message: "Business profile updated successfully", businessDetails });
    } catch (error) {
      res.status(500).json({ message: "Failed to update business profile" });
    }
  });

  // Logo upload endpoint
  app.post("/api/auth/upload-logo", authenticateUser, logoUpload.single('logo'), async (req: AuthRequest, res) => {
    console.log('Logo upload attempt by user:', req.user.id);
    console.log('File received:', req.file ? `${req.file.filename} (${req.file.size} bytes)` : 'No file');
    
    try {
      // Only allow client users and admins to upload logos
      if (req.user.role === 'manager') {
        // Remove uploaded file if it exists
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ 
          message: "Access denied. Managers inherit business profile from their company owner. Contact your administrator to update logo." 
        });
      }
      
      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ message: "No logo file provided" });
      }

      console.log('File details:', {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      });

      // Validate file size again on server side
      if (req.file.size > 76800) {
        console.log('File too large, removing:', req.file.path);
        // Remove the uploaded file if it's too large
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "File size must be 75KB or less" });
      }

      // Check if file actually exists on disk
      if (!fs.existsSync(req.file.path)) {
        return res.status(500).json({ message: "File upload failed - file not saved" });
      }

      // P0 FIX: verify actual file bytes match an allowed image signature
      // — the client-supplied mimetype/extension can be spoofed.
      if (!(await verifyUploadedImage(req.file.path))) {
        return res.status(400).json({ message: "Invalid image file. Only genuine JPG, PNG, or WebP files are allowed." });
      }

      // Convert logo to base64 for permanent storage
      const logoBuffer = fs.readFileSync(req.file.path);
      const logoBase64 = `data:${req.file.mimetype};base64,${logoBuffer.toString('base64')}`;

      // Clean up the temporary file
      fs.unlinkSync(req.file.path);

      // Update user's business details with logo base64
      const user = await storage.getUser(req.user.id);
      if (!user) {
        console.log('User not found');
        return res.status(404).json({ message: "User not found" });
      }

      console.log('Current user business details:', user.businessDetails);

      // Update business details with logo base64 - preserve existing details or use defaults
      const existingDetails = user.businessDetails || {} as any;
      const updatedBusinessDetails = {
        businessName: existingDetails.businessName || "Company Name",
        ownerName: existingDetails.ownerName || "Owner Name", 
        businessAddress: existingDetails.businessAddress || "Business Address",
        gstNumber: existingDetails.gstNumber || "",
        businessEmail: existingDetails.businessEmail || "contact@company.com",
        businessPhone: existingDetails.businessPhone || "0000000000",
        logoUrl: logoBase64
      };

      console.log('Updating business details with:', updatedBusinessDetails);
      
      const updatedUser = await storage.updateUser(req.user.id, { businessDetails: updatedBusinessDetails });
      
      if (!updatedUser) {
        console.log('Failed to update user with logo data');
        return res.status(500).json({ message: "Failed to save logo data to database" });
      }
      
      console.log('Logo upload successful for user:', req.user.id);
      console.log('Updated user business details:', updatedUser.businessDetails);

      res.json({ 
        message: "Logo uploaded successfully", 
        logoUrl: logoBase64,
        filename: req.file.filename 
      });
    } catch (error) {
      console.error('Logo upload error:', error);
      // Remove uploaded file on error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('Removed failed upload file:', req.file.path);
        } catch (unlinkError) {
          console.error('Failed to remove uploaded file:', unlinkError);
        }
      }
      res.status(500).json({ message: "Failed to upload logo: " + (error as Error).message });
    }
  });

  // Signature upload endpoint
  app.post("/api/auth/upload-signature", authenticateUser, signatureUpload.single('signature'), async (req: AuthRequest, res) => {
    console.log('Signature upload attempt by user:', req.user.id);
    console.log('File received:', req.file ? `${req.file.filename} (${req.file.size} bytes)` : 'No file');
    
    try {
      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ message: "No signature file provided" });
      }

      console.log('File details:', {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      });

      // Validate file size again on server side
      if (req.file.size > 20480) {
        console.log('File too large, removing:', req.file.path);
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "File size must be 20KB or less" });
      }

      // Check if file actually exists on disk
      if (!fs.existsSync(req.file.path)) {
        return res.status(500).json({ message: "File upload failed - file not saved" });
      }

      // P0 FIX: verify actual file bytes match an allowed image signature.
      if (!(await verifyUploadedImage(req.file.path))) {
        return res.status(400).json({ message: "Invalid image file. Only genuine JPG, PNG, or WebP files are allowed." });
      }

      // Convert signature to base64 for permanent storage
      const signatureBuffer = fs.readFileSync(req.file.path);
      const signatureBase64 = `data:${req.file.mimetype};base64,${signatureBuffer.toString('base64')}`;

      // Clean up the temporary file
      fs.unlinkSync(req.file.path);

      // Update user's business details with signature base64
      const user = await storage.getUser(req.user.id);
      if (!user) {
        console.log('User not found');
        return res.status(404).json({ message: "User not found" });
      }

      console.log('Current user business details:', user.businessDetails);

      // Update business details with signature base64 - preserve existing details
      const existingDetails = user.businessDetails || {} as any;
      const updatedBusinessDetails = {
        businessName: existingDetails.businessName || "Company Name",
        ownerName: existingDetails.ownerName || "Owner Name", 
        businessAddress: existingDetails.businessAddress || "Business Address",
        gstNumber: existingDetails.gstNumber || "",
        businessEmail: existingDetails.businessEmail || "contact@company.com",
        businessPhone: existingDetails.businessPhone || "0000000000",
        logoUrl: existingDetails.logoUrl || "",
        signatureUrl: signatureBase64
      };

      console.log('Updating business details with:', updatedBusinessDetails);
      
      const updatedUser = await storage.updateUser(req.user.id, { businessDetails: updatedBusinessDetails });
      
      if (!updatedUser) {
        console.log('Failed to update user with signature data');
        return res.status(500).json({ message: "Failed to save signature data to database" });
      }
      
      console.log('Signature upload successful for user:', req.user.id);
      console.log('Updated user business details:', updatedUser.businessDetails);

      res.json({ 
        message: "Signature uploaded successfully", 
        signatureUrl: signatureBase64,
        filename: req.file.filename 
      });
    } catch (error) {
      console.error('Signature upload error:', error);
      // Remove uploaded file on error if it still exists
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('Removed failed upload file:', req.file.path);
        } catch (unlinkError) {
          console.error('Failed to remove uploaded file:', unlinkError);
        }
      }
      res.status(500).json({ message: "Failed to upload signature: " + (error as Error).message });
    }
  });

  // Admin Security Monitoring
  app.get("/api/admin/security/stats", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      // Flatten all login attempts from the Map into a single array
      const allAttempts: LoginAttempt[] = [];
      Array.from(loginAttempts.entries()).forEach(([userId, userAttempts]) => {
        allAttempts.push(...userAttempts);
      });
      
      // Filter for recent attempts (last 24 hours)
      const recentAttempts = allAttempts.filter((attempt: LoginAttempt) => 
        Date.now() - attempt.timestamp.getTime() < 24 * 60 * 60 * 1000
      );
      
      const failedAttempts = recentAttempts.filter((attempt: LoginAttempt) => !attempt.success);
      const successfulAttempts = recentAttempts.filter((attempt: LoginAttempt) => attempt.success);
      
      const uniqueFailedIPs = Array.from(new Set(failedAttempts.map((attempt: LoginAttempt) => attempt.ip)));
      const failedByUser = failedAttempts.reduce((acc: Record<string, number>, attempt: LoginAttempt) => {
        acc[attempt.userId] = (acc[attempt.userId] || 0) + 1;
        return acc;
      }, {});
      
      res.json({
        totalAttempts: recentAttempts.length,
        successfulLogins: successfulAttempts.length,
        failedLogins: failedAttempts.length,
        uniqueFailedIPs: uniqueFailedIPs.length,
        suspiciousUsers: Object.entries(failedByUser)
          .filter(([_, count]) => (count as number) >= 3)
          .map(([userId, count]) => ({ userId, attempts: count })),
        recentFailures: failedAttempts
          .slice(-10)
          .map((attempt: LoginAttempt) => ({
            userId: attempt.userId,
            ip: attempt.ip,
            timestamp: attempt.timestamp,
            userAgent: attempt.userAgent
          }))
      });
    } catch (error) {
      console.error("Error getting security stats:", error);
      res.status(500).json({ message: "Failed to get security statistics" });
    }
  });

  // Admin Routes
  app.get("/api/admin/tenants", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.post("/api/admin/tenants", authenticateUser, requireAdmin, async (req, res) => {
    try {
      // Clean the data before validation
      const cleanedData = { ...req.body };
      if (cleanedData.email === "") delete cleanedData.email;
      if (cleanedData.phone === "") delete cleanedData.phone;
      if (cleanedData.address === "") delete cleanedData.address;
      
      const tenantData = mongoTenantSchema.parse(cleanedData);
      const tenant = await storage.createTenant(tenantData);
      res.json(tenant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log('Validation errors:', error.errors);
        return res.status(400).json({ message: "Invalid tenant data", errors: error.errors });
      }
      console.error('Tenant creation error:', error);
      res.status(500).json({ message: "Failed to create tenant" });
    }
  });

  app.put("/api/admin/tenants/:id", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const tenantData = mongoTenantSchema.partial().parse(req.body);
      const tenant = await storage.updateTenant(id, tenantData);
      
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ message: "Failed to update tenant" });
    }
  });

  app.delete("/api/admin/tenants/:id", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      
      // First, find and delete the associated user(s) for this tenant
      const tenantUsers = await storage.getUsersByTenant(id);
      for (const user of tenantUsers) {
        await storage.deleteUser(user.id);
      }
      
      // Then delete the tenant
      await storage.deleteTenant(id);
      
      res.json({ message: "Client and associated user(s) deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  app.get("/api/admin/users", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const userData = mongoUserSchema.parse(req.body);
      // Create user data with proper ObjectId conversion
      const userToCreate: any = { ...userData };
      if (userData.tenantId) {
        userToCreate.tenantId = new mongoose.Types.ObjectId(userData.tenantId);
      }
      const user = await storage.createUser(userToCreate);
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/admin/users/:id", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const userData = mongoUserSchema.partial().parse(req.body);
      // Convert tenantId to ObjectId if it's a string  
      const userToUpdate: any = { ...userData };
      if (userData.tenantId) {
        userToUpdate.tenantId = new mongoose.Types.ObjectId(userData.tenantId);
      }
      const user = await storage.updateUser(id, userToUpdate);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/admin/users/:id/reset-password", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { tempPassword } = req.body;
      
      if (!tempPassword) {
        return res.status(400).json({ message: "Temporary password is required" });
      }
      
      if (tempPassword.length < 6) {
        return res.status(400).json({ message: "Temporary password must be at least 6 characters long" });
      }
      
      await storage.adminResetUserPassword(userId, tempPassword);
      res.json({ message: "User password reset successfully. User will be required to set a new password on next login." });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Admin toggle user activation endpoint
  app.patch("/api/admin/users/:id/toggle-activation", authenticateUser, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean value" });
      }
      
      await storage.updateUser(userId, { isActive });
      res.json({ message: `User ${isActive ? 'activated' : 'deactivated'} successfully` });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user activation status" });
    }
  });

  // Enhanced Admin Routes for Manager Control

  // Get managers for a specific tenant
  app.get("/api/admin/tenants/:tenantId/managers", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const managers = await storage.getManagersByTenant(tenantId);
      res.json(managers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch managers" });
    }
  });

  // Update tenant manager limit
  app.patch("/api/admin/tenants/:tenantId/manager-limit", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { maxManagers } = req.body;
      
      if (typeof maxManagers !== 'number' || maxManagers < 0) {
        return res.status(400).json({ message: "maxManagers must be a positive number" });
      }
      
      await storage.updateTenant(tenantId, { maxManagers });
      res.json({ message: "Manager limit updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update manager limit" });
    }
  });

  // Reset manager password (admin action)
  app.post("/api/admin/managers/:managerId/reset-password", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const managerId = req.params.managerId;
      const { tempPassword } = req.body;
      
      if (!tempPassword || tempPassword.length < 6) {
        return res.status(400).json({ message: "Temporary password must be at least 6 characters long" });
      }
      
      await storage.adminResetUserPassword(managerId, tempPassword);
      res.json({ message: "Manager password reset successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset manager password" });
    }
  });

  // Deactivate client and all managers
  app.patch("/api/admin/tenants/:tenantId/deactivate-all", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      await storage.deactivateClientAndManagers(tenantId);
      res.json({ message: "Client and all managers deactivated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to deactivate client and managers" });
    }
  });

  // Activate client and all managers
  app.patch("/api/admin/tenants/:tenantId/activate-all", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      await storage.activateClientAndManagers(tenantId);
      res.json({ message: "Client and all managers activated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to activate client and managers" });
    }
  });

  // Delete manager (admin action)
  app.delete("/api/admin/managers/:managerId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const managerId = req.params.managerId;
      await storage.deleteUser(managerId);
      res.json({ message: "Manager deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete manager" });
    }
  });

  // Subscription Plan Management Routes
  
  // Get tenant plan and limits
  app.get("/api/admin/tenants/:tenantId/plan", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      
      const limits = await storage.getTenantLimits(tenantId);
      
      res.json({
        subscriptionPlan: tenant.subscriptionPlan || 'starter',
        limits: limits || { vehicles: 6, drivers: 3, managers: 1 }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch plan details" });
    }
  });

  // Update tenant plan and limits
  app.patch("/api/admin/tenants/:tenantId/plan", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { subscriptionPlan, limits } = req.body;
      
      // Validate subscription plan
      const validPlans = ['starter', 'pro', 'custom'];
      if (!validPlans.includes(subscriptionPlan)) {
        return res.status(400).json({ message: "Invalid subscription plan" });
      }
      
      // Validate limits
      if (!limits || typeof limits.vehicles !== 'number' || typeof limits.drivers !== 'number' || typeof limits.managers !== 'number') {
        return res.status(400).json({ message: "Invalid limits format" });
      }
      
      if (limits.vehicles < 1 || limits.drivers < 1 || limits.managers < 1) {
        return res.status(400).json({ message: "All limits must be at least 1" });
      }
      
      const updatedTenant = await storage.updateTenantPlan(tenantId, subscriptionPlan, limits);
      if (!updatedTenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      
      res.json({ 
        message: "Plan updated successfully",
        subscriptionPlan: updatedTenant.subscriptionPlan,
        limits: updatedTenant.limits
      });
    } catch (error) {
      console.error('Error updating tenant plan:', error);
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  // Check current usage vs limits for a tenant
  app.get("/api/admin/tenants/:tenantId/usage", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      
      const [vehicleUsage, driverUsage, managerUsage] = await Promise.all([
        storage.checkVehicleLimit(tenantId),
        storage.checkDriverLimit(tenantId),
        storage.checkManagerLimit(tenantId)
      ]);
      
      res.json({
        vehicles: vehicleUsage,
        drivers: driverUsage,
        managers: managerUsage
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch usage data" });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getTenantStats(req.tenantId!);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // User Management Routes (for admins and clients to manage sub-users)
  app.post("/api/users/sub-users", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      // Only allow admin and client users to create sub-users
      if (req.user?.role !== 'admin' && req.user?.role !== 'client') {
        return res.status(403).json({ message: "Access denied. Only admins and clients can create sub-users." });
      }

      // Check manager limit for clients (admins can bypass)
      if (req.user?.role === 'client') {
        const tenant = await storage.getTenant(req.tenantId!);
        if (!tenant) {
          return res.status(404).json({ message: "Tenant not found" });
        }

        const existingManagers = await storage.getManagersByTenant(req.tenantId!);
        const maxManagers = tenant.maxManagers || 5; // Default to 5 if not set

        if (existingManagers.length >= maxManagers) {
          return res.status(400).json({ 
            message: `You've reached the manager limit (${maxManagers}). Contact admin to increase your limit.`,
            currentCount: existingManagers.length,
            maxAllowed: maxManagers
          });
        }
      }

      // Extract and validate permissions
      const defaultPermissions = [
        'create_booking',
        'view_bookings',
        'edit_booking',
        'generate_invoice'
      ];
      
      const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : defaultPermissions;
      

      
      const userData = {
        userId: req.body.userId,
        password: req.body.password,
        name: req.body.name,
        role: 'manager', // Sub-users are always managers
        tenantId: req.tenantId, // Use the tenant ID from the authenticated user
        isActive: true,
        permissions: permissions
      };

      const subUser = await storage.createSubUser(userData, req.userId!);
      
      // Remove password from response
      const { password, ...userResponse } = subUser.toObject();
      
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Error creating sub-user:", error);
      res.status(500).json({ message: "Failed to create sub-user" });
    }
  });

  app.get("/api/users/sub-users", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      // Only allow admin and client users to view sub-users
      if (req.user?.role !== 'admin' && req.user?.role !== 'client') {
        return res.status(403).json({ message: "Access denied. Only admins and clients can view sub-users." });
      }

      const subUsers = await storage.getSubUsersByTenant(req.tenantId!);
      res.json(subUsers);
    } catch (error) {
      console.error("Error fetching sub-users:", error);
      res.status(500).json({ message: "Failed to fetch sub-users" });
    }
  });



  app.delete("/api/users/sub-users/:userId", authenticateUser, async (req: AuthRequest, res) => {
    try {
      // Only allow admin and client users to deactivate sub-users
      if (req.user?.role !== 'admin' && req.user?.role !== 'client') {
        return res.status(403).json({ message: "Access denied. Only admins and clients can deactivate sub-users." });
      }

      const userIdToDeactivate = req.params.userId;
      await storage.deactivateSubUser(userIdToDeactivate, req.userId!, scopeTenant(req));
      
      res.json({ message: "Sub-user deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating sub-user:", error);
      res.status(500).json({ message: "Failed to deactivate sub-user" });
    }
  });

  app.patch("/api/users/sub-users/:userId/reactivate", authenticateUser, async (req: AuthRequest, res) => {
    try {
      // Only allow admin and client users to reactivate sub-users
      if (req.user?.role !== 'admin' && req.user?.role !== 'client') {
        return res.status(403).json({ message: "Access denied. Only admins and clients can reactivate sub-users." });
      }

      const userIdToReactivate = req.params.userId;
      await storage.reactivateSubUser(userIdToReactivate, req.userId!, scopeTenant(req));
      
      res.json({ message: "Sub-user reactivated successfully" });
    } catch (error) {
      console.error("Error reactivating sub-user:", error);
      res.status(500).json({ message: "Failed to reactivate sub-user" });
    }
  });

  // Revenue Report
  app.get("/api/reports/revenue", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate } = req.query;
      console.log('Revenue Report API Debug:', {
        tenantId: req.tenantId,
        startDate,
        endDate,
        queryParams: req.query
      });
      
      const report = await storage.getRevenueReport(
        req.tenantId!,
        startDate as string,
        endDate as string
      );
      
      console.log('Revenue Report Results:', {
        totalRevenue: report.totalRevenue,
        totalBookings: report.completedBookings,
        dateRange: { startDate, endDate }
      });
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching revenue report:", error);
      res.status(500).json({ message: "Failed to fetch revenue report" });
    }
  });

  // Vehicle Routes
  app.get("/api/vehicles", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const vehicles = await storage.getVehiclesByTenant(req.tenantId!);
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vehicles" });
    }
  });

  app.get("/api/vehicles/:id/customer-feedback-profile", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid vehicle ID" });
      const profile = await buildVehicleFeedbackProfile(req.tenantId!, req.params.id);
      if (!profile) return res.status(404).json({ message: "Vehicle not found" });
      res.json(profile);
    } catch (error: any) {
      console.error('Vehicle customer-feedback profile error:', error?.message || error);
      res.status(500).json({ message: "Failed to build vehicle customer-feedback profile" });
    }
  });

  app.post("/api/vehicles", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res) => {
    try {
      // Check vehicle limit before adding
      const vehicleUsage = await storage.checkVehicleLimit(req.tenantId!);
      if (!vehicleUsage.canAdd) {
        return res.status(400).json({ 
          message: `You've reached your maximum allowed vehicles (${vehicleUsage.limit}). Upgrade your plan or contact admin.`,
          current: vehicleUsage.current,
          limit: vehicleUsage.limit
        });
      }

      // Map frontend field names to MongoDB schema
      const mappedData = {
        ...req.body,
        tenantId: req.tenantId,
        // Handle different model field names
        vehicleModel: req.body.vehicleModel || req.body.model,
        // Handle different license plate field names  
        licensePlate: req.body.licensePlate || req.body.registrationNumber,
        // Handle different vehicle type mappings
        type: req.body.vehicleType && ['sedan', 'hatchback', 'coupe', 'convertible'].includes(req.body.vehicleType) 
          ? req.body.vehicleType 
          : req.body.type || 'economy',
        // Handle different pricing field names
        pricePerDay: req.body.ratePerDay || req.body.dailyRate || req.body.pricePerDay || 0,
        pricePerHour: req.body.hourlyRate || req.body.pricePerHour || 0,
        pricePerKm: req.body.ratePerKm || req.body.pricePerKm || 0
      };
      
      const vehicleData = mongoVehicleSchema.parse(mappedData);
      const vehicle = await storage.createVehicle(vehicleData);
      res.json(vehicle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vehicle data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create vehicle" });
    }
  });

  app.put("/api/vehicles/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      
      // Map frontend field names to MongoDB schema for updates
      const mappedData = {
        ...req.body,
        // Handle different model field names
        vehicleModel: req.body.vehicleModel || req.body.model,
        // Handle different license plate field names  
        licensePlate: req.body.licensePlate || req.body.registrationNumber,
        // Handle different vehicle type mappings
        type: req.body.vehicleType && ['sedan', 'hatchback', 'coupe', 'convertible'].includes(req.body.vehicleType) 
          ? req.body.vehicleType 
          : req.body.type,
        // Handle different pricing field names
        pricePerDay: req.body.ratePerDay || req.body.dailyRate || req.body.pricePerDay,
        pricePerHour: req.body.hourlyRate || req.body.pricePerHour,
        pricePerKm: req.body.ratePerKm || req.body.pricePerKm
      };
      
      const vehicleData = mongoVehicleSchema.partial().parse(mappedData);
      const vehicle = await storage.updateVehicle(id, vehicleData, scopeTenant(req));
      
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      res.json(vehicle);
    } catch (error) {
      res.status(500).json({ message: "Failed to update vehicle" });
    }
  });

  app.delete("/api/vehicles/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      await storage.deleteVehicle(id, scopeTenant(req));
      res.json({ message: "Vehicle deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete vehicle" });
    }
  });

  app.get("/api/vehicles/available", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { pickupDate, returnDate } = req.query;
      
      if (!pickupDate || !returnDate) {
        return res.status(400).json({ message: "Pickup and return dates are required" });
      }
      
      const vehicles = await storage.getAvailableVehicles(
        req.tenantId!,
        pickupDate as string,
        returnDate as string
      );
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch available vehicles" });
    }
  });

  // Driver Routes
  app.get("/api/drivers", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const drivers = await storage.getDriversByTenant(req.tenantId!);
      res.json(drivers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch drivers" });
    }
  });

  app.get("/api/drivers/:id/customer-feedback-profile", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid driver ID" });
      const profile = await buildDriverFeedbackProfile(req.tenantId!, req.params.id);
      if (!profile) return res.status(404).json({ message: "Driver not found" });
      res.json(profile);
    } catch (error: any) {
      console.error('Driver customer-feedback profile error:', error?.message || error);
      res.status(500).json({ message: "Failed to build driver customer-feedback profile" });
    }
  });

  app.post("/api/drivers", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
    try {
      // Check driver limit before adding
      const driverUsage = await storage.checkDriverLimit(req.tenantId!);
      if (!driverUsage.canAdd) {
        return res.status(400).json({ 
          message: `You've reached your maximum allowed drivers (${driverUsage.limit}). Upgrade your plan or contact admin.`,
          current: driverUsage.current,
          limit: driverUsage.limit
        });
      }

      const driverData = mongoDriverSchema.parse({ ...req.body, tenantId: req.tenantId });
      const driver = await storage.createDriver(driverData);
      res.json(driver);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid driver data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create driver" });
    }
  });

  app.put("/api/drivers/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const driverData = mongoDriverSchema.partial().parse(req.body);
      const driver = await storage.updateDriver(id, driverData, scopeTenant(req));
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      res.json(driver);
    } catch (error) {
      res.status(500).json({ message: "Failed to update driver" });
    }
  });

  app.delete("/api/drivers/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      await storage.deleteDriver(id, scopeTenant(req));
      res.json({ message: "Driver deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete driver" });
    }
  });

  // P0 FIX: this previously called storage.getAvailableDrivers(), which
  // filtered bookings by `status: { $in: ['confirmed'] }` only — a driver
  // already on an 'ongoing', 'trip_started', 'vehicle_assigned' etc. trip
  // (i.e. almost every status in the real pipeline except the literal
  // word "confirmed") showed up as available. It also had no concept of
  // approved leave, which didn't exist yet when it was written. Now uses
  // the shared availability service (leave-aware, full status set) that
  // also backs the hard backend enforcement in PUT /api/bookings/:id —
  // one source of truth for "is this driver actually free", not two.
  app.get("/api/drivers/available", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { pickupDate, returnDate, pickupTime, returnTime, excludeBookingId, includeUnavailable } = req.query;

      if (!pickupDate || !returnDate) {
        return res.status(400).json({ message: "Pickup and return dates are required" });
      }

      // P0 FIX: this used to build start/end from the bare date query
      // params with no time-of-day at all. Two same-day bookings with
      // different, overlapping times (e.g. 2pm-10pm vs 3pm-11pm) both
      // collapse to the same midnight instant, giving a zero-width
      // "start === end" window that can never overlap anything — the
      // already-assigned driver kept showing up as available. Now
      // combines the date with pickupTime/returnTime (also newly
      // accepted here) into a real instant before checking.
      const start = combineDateTime(pickupDate as string, pickupTime as string | undefined);
      const end = combineDateTime(returnDate as string, returnTime as string | undefined);
      const wantUnavailable = includeUnavailable === 'true' || includeUnavailable === '1';
      const allDrivers = await storage.getDriversByTenant(req.tenantId!);

      const results = await Promise.all(allDrivers.map(async (d: any) => {
        const driverObj = typeof d.toObject === 'function' ? d.toObject() : d;

        if (d.status === 'inactive' || d.status === 'suspended') {
          if (!wantUnavailable) return null;
          return { ...driverObj, available: false, unavailabilityReason: d.status === 'inactive' ? 'Inactive' : 'Suspended' };
        }

        const avail = await checkDriverAvailability(req.tenantId!, d._id.toString(), start, end, excludeBookingId as string | undefined);
        if (avail.available) {
          return wantUnavailable ? { ...driverObj, available: true } : driverObj;
        }
        if (!wantUnavailable) return null;

        const bc = avail.bookingConflicts[0];
        const lc = avail.leaveConflicts[0];
        const reason = bc
          ? `Already assigned: ${bc.bookingId}, ${bc.pickupTime || '?'}–${bc.returnTime || '?'}`
          : lc
            ? `On leave (${lc.leaveType})`
            : 'Unavailable';
        return {
          ...driverObj,
          available: false,
          unavailabilityReason: reason,
          conflictingBooking: bc ? { bookingId: bc.bookingId, pickupDate: bc.pickupDate, pickupTime: bc.pickupTime, returnDate: bc.returnDate, returnTime: bc.returnTime } : undefined,
        };
      }));

      res.json(results.filter(Boolean));
    } catch (error) {
      console.error('Available drivers error:', error);
      res.status(500).json({ message: "Failed to fetch available drivers" });
    }
  });

  // Booking Routes
  app.get("/api/bookings", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getBookingsByTenant(req.tenantId!);



      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  // Operations -> Live Bookings panel. Buckets the tenant's bookings into
  // Starting Soon / Ongoing / Ending Soon / Payment Pending / Completed
  // Today / Delayed / Unassigned / Cancelled in one pass, driven off the
  // state-machine's status field so a booking's bucket is always
  // consistent with what the state machine actually allows.
  app.get("/api/operations/live-bookings", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const validWindows = ['1h', '3h', 'today', 'tomorrow'];
      const startingWindow = validWindows.includes(req.query.startingWindow as string)
        ? (req.query.startingWindow as any) : 'today';
      const endingWindow = validWindows.includes(req.query.endingWindow as string)
        ? (req.query.endingWindow as any) : 'today';

      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      const result = buildLiveOperations(bookings, new Date(), startingWindow, endingWindow);
      res.json(result);
    } catch (error) {
      console.error('Live operations error:', error);
      res.status(500).json({ message: "Failed to load live bookings" });
    }
  });

  app.get("/api/operations/upcoming-bookings", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const days = Math.min(7, Math.max(1, parseInt(req.query.days as string) || 3));
      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      res.json(buildUpcomingBookings(bookings, new Date(), days));
    } catch (error) {
      console.error('Upcoming bookings error:', error);
      res.status(500).json({ message: "Failed to load upcoming bookings" });
    }
  });

  // Dashboard Overview's Today/Tomorrow/Future/All Upcoming tabs. Reuses the
  // same tenant booking fetch and the same centralized upcoming-booking rule
  // as /api/operations/upcoming-bookings above, but returns full booking
  // documents (not the summarized shape) so the dashboard can reopen the
  // existing Booking Details dialog without a second, divergent definition
  // of "upcoming" anywhere in the codebase.
  app.get("/api/dashboard/upcoming-bookings", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      res.json(classifyUpcomingBookings(bookings, new Date()));
    } catch (error) {
      console.error('Dashboard upcoming bookings error:', error);
      res.status(500).json({ message: "Failed to load upcoming bookings" });
    }
  });

  // Dashboard Overview's Finance section — today's collection split by
  // payment mode. Sourced entirely from the PaymentTransaction ledger
  // (never a raw sum of booking fields — see the payment-accuracy
  // guidance in docs/SECURITY_AND_DATA_RISK_AUDIT.md), reusing the exact
  // same RECEIPT_TYPES definition paymentLedger.ts uses to decide what
  // counts as money actually received, so this can never silently drift
  // from the balance shown on a booking/invoice.
  app.get("/api/dashboard/finance-summary", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const transactions = await PaymentTransaction.find({
        tenantId: req.tenantId,
        status: 'completed',
        paymentType: { $in: Array.from(RECEIPT_TYPES) },
        receivedAt: { $gte: todayStart, $lt: todayEnd },
      }).lean();

      const summary = { cash: 0, upi: 0, bank: 0, card: 0, other: 0, total: 0 };
      for (const t of transactions) {
        const amount = t.amount || 0;
        if (t.paymentMode === 'cash') summary.cash += amount;
        else if (t.paymentMode === 'upi') summary.upi += amount;
        else if (t.paymentMode === 'bank_transfer') summary.bank += amount;
        else if (t.paymentMode === 'card') summary.card += amount;
        else summary.other += amount;
        summary.total += amount;
      }
      res.json(summary);
    } catch (error) {
      console.error('Dashboard finance summary error:', error);
      res.status(500).json({ message: "Failed to load finance summary" });
    }
  });

  // Dashboard Overview's booking-source chart — all-time count of bookings
  // per source, from the existing Booking.bookingSource field (already
  // populated at booking-creation time, no schema change).
  app.get("/api/dashboard/lead-sources", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const rows = await Booking.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(req.tenantId) } },
        { $group: { _id: { $ifNull: ["$bookingSource", "direct_customer"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      res.json(rows.map((r) => ({ source: r._id, count: r.count })));
    } catch (error) {
      console.error('Dashboard lead sources error:', error);
      res.status(500).json({ message: "Failed to load lead sources" });
    }
  });

  app.get("/api/operations/payment-dues", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      res.json(buildPaymentDues(bookings, new Date()));
    } catch (error) {
      console.error('Payment dues error:', error);
      res.status(500).json({ message: "Failed to load payment dues" });
    }
  });

  // Daily Operations popup. Deliberately reuses the same three services
  // (live ops, upcoming, payment dues) instead of re-deriving any of
  // their classification logic — one source of truth for "what's today".
  app.get("/api/operations/daily-summary", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      const now = new Date();

      const live = buildLiveOperations(bookings, now);
      const upcoming = buildUpcomingBookings(bookings, now, 3);
      const dues = buildPaymentDues(bookings, now);

      const today = upcoming[0];
      const tomorrow = upcoming[1];
      const dayAfter = upcoming[2];

      const earliestPickup = today?.bookings?.[0] || null;

      res.json({
        date: today?.date,
        today: today?.bookings || [],
        tomorrow: tomorrow?.bookings || [],
        dayAfterTomorrow: dayAfter?.bookings || [],
        startDue: live.startDue,
        startDelayed: live.startDelayed,
        unassigned: live.unassigned,
        paymentDues: dues,
        earliestPickup,
        counts: {
          today: today?.bookings?.length || 0,
          tomorrow: tomorrow?.bookings?.length || 0,
          dayAfterTomorrow: dayAfter?.bookings?.length || 0,
          startDue: live.startDue.length,
          startDelayed: live.startDelayed.length,
          unassigned: live.unassigned.length,
          paymentDues: dues.length,
          totalDueAmount: dues.reduce((sum, d) => sum + d.remainingBalance, 0),
        },
      });
    } catch (error) {
      console.error('Daily summary error:', error);
      res.status(500).json({ message: "Failed to load daily summary" });
    }
  });

  // Communication -> WhatsApp Panel: per-tenant session management.
  // Only admins/clients (tenant owners) can link/unlink WhatsApp — a
  // manager should not be able to disconnect the whole business's
  // WhatsApp session.
  const requireWhatsAppAdmin = (req: AuthRequest, res: any, next: any) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'client') {
      return res.status(403).json({ message: "Only admins or the account owner can manage WhatsApp." });
    }
    next();
  };

  app.post("/api/whatsapp/session/start", authenticateUser, requireTenant, requireWhatsAppAdmin, async (req: AuthRequest, res) => {
    try {
      const result = await whatsappProvider.startSession(req.tenantId!);
      res.json({ provider: whatsappProvider.kind, ...result });
    } catch (error: any) {
      console.error('WhatsApp session start error:', error?.message || error);
      res.status(500).json({ message: "Failed to start WhatsApp session" });
    }
  });

  app.get("/api/whatsapp/session/status", authenticateUser, requireTenant, requireWhatsAppAdmin, async (req: AuthRequest, res) => {
    try {
      const result = await whatsappProvider.getStatus(req.tenantId!);
      res.json({ provider: whatsappProvider.kind, ...result });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get WhatsApp session status" });
    }
  });

  app.post("/api/whatsapp/session/logout", authenticateUser, requireTenant, requireWhatsAppAdmin, async (req: AuthRequest, res) => {
    try {
      await whatsappProvider.logoutSession(req.tenantId!);
      res.json({ message: "WhatsApp session logged out" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to log out WhatsApp session" });
    }
  });

  // Booking Communication: preview / send / history. This is the actual
  // send path — messages are generated server-side from the booking
  // document (never hand-typed on the frontend) and always go through
  // the idempotency check before reaching the provider.
  async function loadBookingForMessage(req: AuthRequest, res: any, messageType: MessageType) {
    const booking: any = await Booking.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate('vehicleId')
      .populate('driverId');
    if (!booking) {
      res.status(404).json({ message: "Booking not found" });
      return null;
    }
    if (['cancelled', 'no_show'].includes(booking.status)) {
      res.status(400).json({ message: "Cannot send messages for a cancelled booking." });
      return null;
    }
    if (messageType === 'driver_duty' && !booking.driverId) {
      res.status(400).json({ message: "Driver is not assigned to this booking yet." });
      return null;
    }
    const recipientType = messageType === 'driver_duty' ? 'driver' : 'customer';
    const rawPhone = messageType === 'driver_duty' ? booking.driverId?.phone : booking.customerPhone;
    const recipientPhone = normalizeIndianPhone(rawPhone);
    if (!recipientPhone) {
      res.status(400).json({ message: `Invalid ${recipientType} phone number: "${rawPhone || ''}"` });
      return null;
    }
    const tenant = await storage.getTenant(req.tenantId!);
    if (!tenant) {
      res.status(404).json({ message: "Tenant not found" });
      return null;
    }
    return { booking, tenant, recipientType, recipientPhone };
  }

  app.get("/api/bookings/:id/whatsapp/preview", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const messageType = req.query.type as MessageType;
      if (messageType !== 'booking_confirmation' && messageType !== 'driver_duty') {
        return res.status(400).json({ message: "Invalid message type" });
      }
      const loaded = await loadBookingForMessage(req, res, messageType);
      if (!loaded) return;
      const { booking, tenant, recipientType, recipientPhone } = loaded;
      const content = buildMessage(messageType, booking, tenant);
      const recipientName = recipientType === 'driver' ? booking.driverId?.name : booking.customerName;
      res.json({ recipientType, recipientName, recipientPhone, content, bookingId: booking.bookingId });
    } catch (error: any) {
      console.error('WhatsApp preview error:', error?.message || error);
      res.status(500).json({ message: "Failed to generate message preview" });
    }
  });

  app.post("/api/bookings/:id/whatsapp/send", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { messageType, force } = req.body as { messageType: MessageType; force?: boolean };
      if (messageType !== 'booking_confirmation' && messageType !== 'driver_duty') {
        return res.status(400).json({ message: "Invalid message type" });
      }

      const result = await sendBookingMessage({
        tenantId: req.tenantId!,
        bookingId: req.params.id,
        messageType,
        actor: { userId: req.userId!, role: req.user?.role || 'client' },
        force: !!force,
      });

      if (result.ok) {
        return res.json({ message: "Message sent", messageDoc: result.messageDoc });
      }

      const statusByCode: Record<string, number> = {
        NOT_FOUND: 404,
        TENANT_NOT_FOUND: 404,
        CANCELLED: 400,
        NO_DRIVER: 400,
        INVALID_PHONE: 400,
        ALREADY_SENT: 409,
        SEND_FAILED: 502,
      };
      const httpStatus = statusByCode[result.code] || 500;
      const body: any = { message: result.message };
      if (result.code === 'ALREADY_SENT') {
        body.alreadySent = true;
        if (result.previousMessage) body.previousMessage = result.previousMessage;
      }
      if (result.messageDoc) body.messageDoc = result.messageDoc;
      res.status(httpStatus).json(body);
    } catch (error: any) {
      console.error('WhatsApp send error:', error?.message || error);
      res.status(500).json({ message: "Failed to send WhatsApp message" });
    }
  });

  app.get("/api/bookings/:id/whatsapp/messages", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const messages = await WhatsAppMessage.find({ tenantId: req.tenantId, bookingId: req.params.id })
        .sort({ createdAt: -1 });
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to load message history" });
    }
  });

  // Fix existing bookings - add createdBy field to bookings that don't have it
  // P0 FIX: this mutates data across the whole database and was previously
  // reachable by ANY authenticated user (not just admins).
  app.post("/api/admin/fix-booking-audit", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const result = await storage.fixBookingAuditTrail();
      res.json({ message: `Fixed ${result} bookings` });
    } catch (error) {
      res.status(500).json({ message: "Failed to fix booking audit trail" });
    }
  });

  app.get("/api/bookings/upcoming", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await storage.getUpcomingBookings(req.tenantId!);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch upcoming bookings" });
    }
  });

  // Booking wizard draft persistence — one slot per (tenant, user). Purely
  // additive: the Add Booking form works exactly as before if a caller never
  // touches these routes. Scoped to authenticateUser + requireTenant only
  // (same access level as creating the booking itself; a draft is not yet a
  // real booking so it doesn't need its own permission key).
  app.get("/api/booking-drafts/mine", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const draft = await BookingDraft.findOne({ tenantId: req.tenantId, userId: req.userId });
      res.json(draft || null);
    } catch (error: any) {
      console.error('Get booking draft error:', error?.message || error);
      res.status(500).json({ message: "Failed to load booking draft" });
    }
  });

  app.put("/api/booking-drafts/mine", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { step, formData, leadId } = req.body || {};
      const draft = await BookingDraft.findOneAndUpdate(
        { tenantId: req.tenantId, userId: req.userId },
        {
          $set: {
            step: typeof step === 'number' ? step : 1,
            formData: formData || {},
            ...(leadId !== undefined ? { leadId } : {}),
            updatedAt: new Date(),
          },
          $setOnInsert: { tenantId: req.tenantId, userId: req.userId, createdAt: new Date() },
        },
        { upsert: true, new: true },
      );
      res.json(draft);
    } catch (error: any) {
      console.error('Save booking draft error:', error?.message || error);
      res.status(500).json({ message: "Failed to save booking draft" });
    }
  });

  app.delete("/api/booking-drafts/mine", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      await BookingDraft.deleteOne({ tenantId: req.tenantId, userId: req.userId });
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete booking draft error:', error?.message || error);
      res.status(500).json({ message: "Failed to delete booking draft" });
    }
  });

  app.post("/api/bookings", authenticateUser, requireTenant, requirePermission(PERMISSIONS.CREATE_BOOKING), async (req: AuthRequest, res) => {
    try {
      // Map frontend field names to MongoDB schema
      // NOTE: bookingId is intentionally NOT set here — storage.createBooking()
      // generates a collision-resistant id (Date.now() + random suffix) and
      // also performs the vehicle-overlap check; setting it here previously
      // meant two near-simultaneous requests could get the same
      // millisecond-based id.
      const mappedData = {
        ...req.body,
        tenantId: req.tenantId,
        // Map amount to totalAmount
        totalAmount: req.body.amount || req.body.totalAmount,
        // Ensure proper field names
        dropoffLocation: req.body.dropoffLocation || req.body.dropOffLocation,
        // Handle customer email - convert empty string to undefined
        customerEmail: req.body.customerEmail || undefined,
        // Handle driverId - convert empty string to undefined for MongoDB ObjectId
        driverId: req.body.driverId && req.body.driverId.trim() !== '' ? req.body.driverId : undefined,
        // Handle totalKilometers for per-km pricing
        totalKilometers: req.body.totalKilometers || undefined,
        // Default values for optional fields
        tollCharges: req.body.tollCharges || 0,
        parkingCharges: req.body.parkingCharges || 0,
        // Add audit logging for who created the booking
        createdBy: {
          userId: req.userId!,
          role: req.user?.role || 'client'
        }
      };
      
      // P0 FIX: no longer logging the full mapped booking payload — it
      // contains customer PII (name, phone, email) and financial amounts.
      const bookingData: any = mongoBookingSchema.parse(mappedData);

      // Customer Database linking — resolved BEFORE the booking is
      // created (not after) so an "Apply Reward Points" redemption can be
      // validated against a real customer/balance and its discount
      // applied to bookingData.totalAmount before the booking's final
      // price is ever written, rather than patching the price afterward.
      let resolvedCustomer: any = null;
      try {
        const { customer } = await findOrCreateCustomer(
          req.tenantId!,
          { name: bookingData.customerName, phone: bookingData.customerPhone, email: bookingData.customerEmail },
          { userId: req.userId!, role: req.user?.role || 'client' }
        );
        resolvedCustomer = customer;
      } catch (err: any) {
        console.error('Customer resolution failed:', err?.message || err);
      }

      let redemption: { points: number; discountValue: number } | null = null;
      const requestedRedeemPoints = Number(req.body.redeemPoints) || 0;
      if (requestedRedeemPoints > 0) {
        if (!resolvedCustomer) {
          return res.status(400).json({ message: "Cannot redeem reward points: customer could not be resolved." });
        }
        try {
          // Validated against the ORIGINAL amount (before discount) —
          // matches the "final pricing preview" the frontend already
          // showed. Only a preview here (no ledger write yet) since the
          // real bookingId the transaction needs to be keyed against
          // doesn't exist until the booking is actually created below.
          const discountValue = await previewRedemption(
            req.tenantId!, resolvedCustomer._id.toString(), requestedRedeemPoints, bookingData.totalAmount
          );
          redemption = { points: requestedRedeemPoints, discountValue };
        } catch (err: any) {
          return res.status(400).json({ message: err.message || 'Could not redeem reward points.', code: err.code });
        }
      }

      if (redemption) {
        bookingData.originalAmount = bookingData.totalAmount;
        bookingData.totalAmount = Math.max(0, bookingData.totalAmount - redemption.discountValue);
        bookingData.rewardPointsRedeemed = redemption.points;
        bookingData.rewardDiscountApplied = redemption.discountValue;
      }

      let booking = await storage.createBooking(bookingData);

      if (resolvedCustomer) {
        try {
          booking.customerId = resolvedCustomer._id;
          await (booking as any).save();
          await recomputeCustomerStats(resolvedCustomer._id.toString());
          if (redemption) {
            try {
              await commitRedemption(
                req.tenantId!, resolvedCustomer._id.toString(), (booking as any)._id.toString(),
                redemption.points, { userId: req.userId!, role: req.user?.role || 'client' }
              );
            } catch (redemptionError) {
              // Never leave a discounted booking behind when the points
              // debit did not commit (e.g. two simultaneous redemptions).
              await storage.deleteBooking((booking as any)._id.toString(), req.tenantId!);
              await recomputeCustomerStats(resolvedCustomer._id.toString());
              throw redemptionError;
            }
          }
        } catch (err: any) {
          console.error('Customer linking failed:', err?.message || err);
        }
      }

      // An initial advance entered on the Add Booking form is recorded as
      // a real ledger transaction (not just the raw number on the
      // document) so it shows up in payment history from the start —
      // "restore Advance Payment" per the ledger design, not a bare
      // editable field. advancePaymentMode defaults to 'cash' so an
      // advance amount typed in without explicitly picking a mode still
      // produces a valid, consistent ledger entry rather than being
      // silently dropped.
      if (bookingData.advanceReceived && bookingData.advanceReceived > 0) {
        try {
          const result = await recordPayment({
            tenantId: req.tenantId!,
            bookingId: (booking as any)._id.toString(),
            amount: bookingData.advanceReceived,
            paymentType: 'advance',
            paymentMode: req.body.advancePaymentMode || 'cash',
            transactionReference: req.body.advanceTransactionReference,
            receivedBy: req.body.advanceReceivedBy,
            notes: req.body.advancePaymentNotes,
            createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
          });
          if (result.booking) booking = result.booking as any;
        } catch (err: any) {
          console.error('Failed to record initial advance payment:', err?.message || err);
        }
      }

      // Send real-time notification for new booking
      const server = (global as any).notificationServer;
      if (server && server.broadcastNotification) {
        server.broadcastNotification(req.tenantId!, {
          type: 'booking_created',
          message: `New booking created: ${booking.bookingId}`,
          data: {
            bookingId: booking.bookingId,
            customerName: booking.customerName,
            amount: booking.totalAmount,
            pickupDate: booking.pickupDate,
            bookingType: booking.bookingType
          },
          timestamp: new Date().toISOString()
        });
      }

      // Auto-send the customer WhatsApp confirmation once the booking is
      // actually committed to the database — never before. Best-effort:
      // a failed/not-connected WhatsApp session must not fail booking
      // creation itself; the attempt is still recorded (status 'failed')
      // so staff can see it and retry from the Booking Communication panel.
      // Only for bookings that are actually confirmed, not a bare enquiry.
      if (booking.status === 'confirmed') {
        sendBookingMessage({
          tenantId: req.tenantId!,
          bookingId: (booking as any)._id.toString(),
          messageType: 'booking_confirmation',
          actor: { userId: req.userId!, role: req.user?.role || 'client' },
        }).catch((err) => {
          console.error('Auto-send booking confirmation failed:', err?.message || err);
        });
      }

      res.json(booking);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid booking data", errors: error.errors });
      }
      // P0 FIX: surface double-booking conflicts as 409 with structured
      // conflict details so the client can show exactly which booking is
      // in the way, instead of a generic failure (or, for driver
      // conflicts, instead of silently creating a double-booked driver —
      // this is the hard backend stop that exists even if the frontend
      // dropdown incorrectly let the conflicting driver be selected).
      if (error?.code === 'VEHICLE_DOUBLE_BOOKING' || error?.code === 'DRIVER_TIME_CONFLICT' || error?.code === 'VEHICLE_TENTATIVELY_HELD') {
        const c = error.conflict;
        return res.status(409).json({
          success: false,
          code: error.code,
          message: error.message,
          conflict: c ? {
            bookingNumber: c.bookingId,
            startDateTime: c.pickupDate,
            endDateTime: c.returnDate,
          } : undefined,
        });
      }
      console.error('Booking creation error:', error?.message || error);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.put("/api/bookings/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;

      // status is no longer editable through the generic update route —
      // it must go through POST /api/bookings/:id/status so every status
      // change is validated by the state machine and recorded in
      // statusHistory. This also stops the "status update loop" class of
      // bug where two different code paths could both silently write
      // status with no shared validation.
      if (req.body.status !== undefined) {
        return res.status(400).json({
          message: "Use POST /api/bookings/:id/status to change booking status.",
        });
      }

      const bookingData: any = mongoBookingSchema.partial().parse(req.body);

      // advanceReceived is a ledger-derived cached summary, not a plain
      // editable field, once a booking exists — allowing a raw overwrite
      // here is exactly the "one editable advance number" the ledger
      // redesign was meant to replace. Recording a real payment goes
      // through POST /api/bookings/:id/payments instead; that route
      // recomputes this field itself after inserting a transaction.
      delete bookingData.advanceReceived;

      const existing = await storage.getBooking(id, scopeTenant(req));
      if (!existing) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const touchesFinancials = FINANCIAL_FIELDS.some((f) => (bookingData as any)[f] !== undefined);
      if (touchesFinancials && existing.status === 'closed' && !req.body.adjustmentReason) {
        return res.status(400).json({
          message: "This booking is closed. Provide adjustmentReason to record a financial adjustment.",
        });
      }

      // Revalidate whenever the schedule OR either assigned resource changes.
      // Previously changing dates with the same driver/vehicle bypassed every
      // overlap check even though changing the driver itself was checked.
      const scheduleFields = ['pickupDate', 'pickupTime', 'returnDate', 'returnTime'];
      const scheduleChanged = scheduleFields.some((f) => bookingData[f] !== undefined);
      const driverChanged = bookingData.driverId !== undefined
        && refId((existing as any).driverId) !== refId(bookingData.driverId);
      const vehicleChanged = bookingData.vehicleId !== undefined
        && refId((existing as any).vehicleId) !== refId(bookingData.vehicleId);
      if (scheduleChanged || driverChanged || vehicleChanged) {
        const rangeStart = combineDateTime(
          bookingData.pickupDate || existing.pickupDate,
          bookingData.pickupTime ?? existing.pickupTime
        );
        const rangeEnd = combineDateTime(
          bookingData.returnDate || existing.returnDate || bookingData.pickupDate || existing.pickupDate,
          bookingData.returnTime ?? existing.returnTime ?? bookingData.pickupTime ?? existing.pickupTime
        );
        if (rangeEnd <= rangeStart) {
          return res.status(400).json({ message: "Return date/time must be after pickup date/time." });
        }

        const conflicts: any = {};
        const effectiveVehicleId = bookingData.vehicleId ?? (existing as any).vehicleId;
        const effectiveDriverId = bookingData.driverId ?? (existing as any).driverId;
        if (effectiveVehicleId) {
          const rows = await findVehicleConflicts(req.tenantId!, refId(effectiveVehicleId), rangeStart, rangeEnd, id);
          if (rows.length) conflicts.vehicle = rows;
        }
        if (effectiveDriverId) {
          const availability = await checkDriverAvailability(req.tenantId!, refId(effectiveDriverId), rangeStart, rangeEnd, id);
          if (availability.bookingConflicts.length) conflicts.driverBookings = availability.bookingConflicts;
          if (availability.leaveConflicts.length) conflicts.driverLeave = availability.leaveConflicts;
        }
        if (Object.keys(conflicts).length) {
          if (!req.body.override) {
            return res.status(409).json({ message: "Driver or vehicle is unavailable for this schedule.", code: "AVAILABILITY_CONFLICT", conflicts });
          }
          if (!req.user || !['admin', 'client'].includes(req.user.role)) {
            return res.status(403).json({ message: "Only an admin or account owner can override a scheduling conflict." });
          }
          if (!req.body.adjustmentReason && !req.body.overrideReason) {
            return res.status(400).json({ message: "An override reason is required." });
          }
        }
      }

      const booking = await storage.updateBooking(id, bookingData, scopeTenant(req));

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Auto-send driver duty details the moment a driver is newly
      // assigned or changed — after the update is committed, never
      // before. Best-effort: a WhatsApp failure must not fail the save.
      if (driverChanged && bookingData.driverId && !['cancelled', 'no_show'].includes(booking.status)) {
        sendBookingMessage({
          tenantId: req.tenantId!,
          bookingId: id,
          messageType: 'driver_duty',
          actor: { userId: req.userId!, role: req.user?.role || 'client' },
          force: true, // a new driver assignment always gets a fresh duty message, even if one was sent to a previous driver
        }).catch((err) => {
          console.error('Auto-send driver duty failed:', err?.message || err);
        });
      }

      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid booking data", errors: error.errors });
      }
      console.error('Booking update error:', error);
      res.status(500).json({ message: "Failed to update booking" });
    }
  });

  // Payment ledger — GET history / POST record / POST reverse. This is
  // the actual "Advance Payment" restoration: booking.advanceReceived is
  // a read-only cached summary now, these are the only writes.
  app.get("/api/bookings/:id/payments", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const booking = await storage.getBooking(req.params.id, scopeTenant(req));
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      const transactions = await PaymentTransaction.find({ tenantId: req.tenantId, bookingId: req.params.id })
        .sort({ receivedAt: -1 });
      res.json(transactions);
    } catch (error: any) {
      console.error('Payment history error:', error?.message || error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  app.post("/api/bookings/:id/payments", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { amount, paymentType, paymentMode, transactionReference, receivedBy, receivedAt, notes } = req.body || {};
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "A positive amount is required." });
      }
      const VALID_TYPES = ['advance', 'partial_payment', 'final_payment', 'refund', 'adjustment', 'driver_collection', 'vendor_collection'];
      if (!VALID_TYPES.includes(paymentType)) {
        return res.status(400).json({ message: `paymentType must be one of: ${VALID_TYPES.join(', ')}` });
      }
      const VALID_MODES = ['cash', 'upi', 'bank_transfer', 'card', 'payment_gateway', 'driver_collection', 'vendor_collection', 'credit'];
      if (!VALID_MODES.includes(paymentMode)) {
        return res.status(400).json({ message: `paymentMode must be one of: ${VALID_MODES.join(', ')}` });
      }

      const booking = await storage.getBooking(req.params.id, scopeTenant(req));
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      const result = await recordPayment({
        tenantId: req.tenantId!,
        bookingId: req.params.id,
        amount,
        paymentType,
        paymentMode,
        transactionReference,
        receivedBy,
        receivedAt: receivedAt ? new Date(receivedAt) : undefined,
        notes,
        createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
      });

      res.json(result);
    } catch (error: any) {
      console.error('Record payment error:', error?.message || error);
      res.status(500).json({ message: "Failed to record payment" });
    }
  });

  // Corrections only — ordinary staff record payments, but reversing one
  // (undoing a mistaken entry) is scoped to admins/owners the same way
  // driver-conflict overrides are, since it directly changes what a
  // customer is shown as owing.
  app.post("/api/bookings/:id/payments/:paymentId/reverse", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'client')) {
        return res.status(403).json({ message: "Only admins or the account owner can reverse a payment." });
      }
      const { reason } = req.body || {};
      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "A reason is required to reverse a payment." });
      }
      const result = await reversePayment(
        req.tenantId!, req.params.paymentId, reason,
        { userId: req.userId!, role: req.user?.role || 'client' }
      );
      if (!result) return res.status(404).json({ message: "Payment transaction not found" });
      res.json(result);
    } catch (error: any) {
      console.error('Reverse payment error:', error?.message || error);
      res.status(500).json({ message: "Failed to reverse payment" });
    }
  });

  // Customer Database (CRM Phase 1) — list, quick lookup for the booking
  // form's customer-selection summary, and the full Customer Dashboard.
  app.get("/api/customers", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { search, customerStatus, customerType, tag, city, minBookings, minSpending, lastBookingBefore, loyaltyTier, segment } = req.query;
      const query: any = { tenantId: req.tenantId, isDeleted: { $ne: true } };
      if (segment && typeof segment === 'string') {
        Object.assign(query, await getSegmentFilter(req.tenantId!, segment));
      }
      if (customerStatus) query.customerStatus = customerStatus;
      if (customerType) query.customerType = customerType;
      if (tag) query.tags = tag;
      if (city) query.city = { $regex: escapeRegex((city as string).trim().slice(0, 100)), $options: 'i' };
      if (loyaltyTier) query.loyaltyTier = loyaltyTier;
      if (minBookings) query.totalBookings = { $gte: Number(minBookings) };
      if (minSpending) query.totalSpending = { $gte: Number(minSpending) };
      if (lastBookingBefore) query.lastBookingDate = { $lt: new Date(lastBookingBefore as string) };
      if (search && typeof search === 'string' && search.trim()) {
        const normalized = normalizeIndianPhone(search) || search;
        const safeSearch = escapeRegex(search.trim().slice(0, 100));
        query.$or = [
          { name: { $regex: safeSearch, $options: 'i' } },
          { primaryMobile: { $regex: normalized.replace(/\D/g, '') } },
          { alternateMobile: { $regex: normalized.replace(/\D/g, '') } },
          { whatsappNumber: { $regex: normalized.replace(/\D/g, '') } },
          { phoneAliases: { $regex: normalized.replace(/\D/g, '') } },
          { email: { $regex: safeSearch, $options: 'i' } },
          { emailAliases: { $regex: safeSearch, $options: 'i' } },
          { companyAliases: { $regex: safeSearch, $options: 'i' } },
        ];
      }
      const customers = await Customer.find(query).sort({ lastBookingDate: -1, createdAt: -1 }).limit(500);
      res.json(customers);
    } catch (error: any) {
      console.error('List customers error:', error?.message || error);
      res.status(error?.status || 500).json({ message: error?.status ? error.message : "Failed to fetch customers" });
    }
  });

  // Segments — every count is a real query against Customer/Booking (see
  // services/segmentService.ts), never a hardcoded number. Each segment's
  // `query` field maps directly onto GET /api/customers' own filter
  // params, so clicking a segment card can just navigate to a filtered
  // customer list rather than needing a second, parallel filtering system.
  app.get("/api/customers/segments", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const segments = await computeSegments(req.tenantId!);
      res.json(segments);
    } catch (error: any) {
      console.error('Segments error:', error?.message || error);
      res.status(500).json({ message: "Failed to compute segments" });
    }
  });

  app.get("/api/customers/tags", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const tags = await computeTagCounts(req.tenantId!);
      res.json(tags);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  app.post("/api/customers/:id/tags", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { tag } = req.body || {};
      if (!tag || !tag.trim()) return res.status(400).json({ message: "A tag name is required." });
      const cleanTag = tag.trim();
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const actor = { userId: req.userId!, role: req.user?.role || 'client' };
      if (!customer.tags.includes(cleanTag)) {
        customer.tags.push(cleanTag);
        await customer.save();
        await CustomerTagEvent.create({ tenantId: req.tenantId, customerId: customer._id, tag: cleanTag, action: 'added', actor });
      }
      res.json(customer);
    } catch (error: any) {
      console.error('Add tag error:', error?.message || error);
      res.status(500).json({ message: "Failed to add tag" });
    }
  });

  app.delete("/api/customers/:id/tags/:tag", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const tag = decodeURIComponent(req.params.tag);
      if (customer.tags.includes(tag)) {
        customer.tags = customer.tags.filter((t: string) => t !== tag);
        await customer.save();
        await CustomerTagEvent.create({
          tenantId: req.tenantId, customerId: customer._id, tag, action: 'removed',
          actor: { userId: req.userId!, role: req.user?.role || 'client' },
        });
      }
      res.json(customer);
    } catch (error: any) {
      console.error('Remove tag error:', error?.message || error);
      res.status(500).json({ message: "Failed to remove tag" });
    }
  });

  // Feedback — driver/vehicle/service ratings tied to a specific booking.
  app.get("/api/customers/:id/feedback", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const rows = await CustomerFeedback.find({ tenantId: req.tenantId, customerId: req.params.id })
        .populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation')
        .populate('driverId', 'name phone status')
        .populate('vehicleId', 'make vehicleModel licensePlate')
        .sort({ createdAt: -1 });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  app.post("/api/customers/:id/feedback", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const {
        bookingId, type, overallRating, driverRating, vehicleRating, serviceRating,
        bookingProcessRating, officeCommunicationRating, tripSatisfactionRating, valueForMoneyRating,
        vehicleCleanlinessRating, vehicleComfortRating, vehicleAcRating, vehicleConditionRating,
        vehicleIssueReported, breakdownOccurred, vehicleIssueDescription,
        driverPunctualityRating, driverBehaviourRating, driverSafetyRating, driverRouteKnowledgeRating,
        driverCommunicationRating, driverAssistanceRating, driverPaymentHandlingRating,
        wouldBookAgain, wouldRecommend, responsibleParty, comments,
      } = req.body || {};
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      const booking: any = bookingId
        ? await Booking.findOne({ _id: bookingId, tenantId: req.tenantId, customerId: customer._id }).lean()
        : null;
      if (bookingId && !booking) return res.status(400).json({ message: "bookingId does not belong to this customer." });
      if (type && !['feedback', 'appreciation'].includes(type)) return res.status(400).json({ message: "Invalid feedback type." });

      const ratingFields = {
        overallRating, driverRating, vehicleRating, serviceRating, bookingProcessRating,
        officeCommunicationRating, tripSatisfactionRating, valueForMoneyRating,
        vehicleCleanlinessRating, vehicleComfortRating, vehicleAcRating, vehicleConditionRating,
        driverPunctualityRating,
        driverBehaviourRating, driverSafetyRating, driverRouteKnowledgeRating, driverCommunicationRating,
        driverAssistanceRating, driverPaymentHandlingRating,
      };
      for (const [field, value] of Object.entries(ratingFields)) {
        if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > 5)) {
          return res.status(400).json({ message: `${field} must be between 1 and 5.` });
        }
      }
      // Backward compatibility: the legacy form allowed one generic
      // driverRating even on self-drive/unassigned bookings. Preserve
      // those records, but require a real assigned Driver Master for the
      // new detailed driver dimensions that feed Driver Profile analytics.
      const hasDriverFeedback = [driverPunctualityRating, driverBehaviourRating, driverSafetyRating,
        driverRouteKnowledgeRating, driverCommunicationRating, driverAssistanceRating, driverPaymentHandlingRating]
        .some((value) => value !== undefined);
      if (hasDriverFeedback && !booking?.driverId) return res.status(400).json({ message: "Select a booking with an assigned driver for driver feedback." });
      const hasVehicleFeedback = [vehicleRating, vehicleCleanlinessRating, vehicleComfortRating, vehicleAcRating,
        vehicleConditionRating, vehicleIssueReported, breakdownOccurred, vehicleIssueDescription]
        .some((value) => value !== undefined && value !== false && value !== '');
      if (hasVehicleFeedback && !booking?.vehicleId) return res.status(400).json({ message: "Select a booking with an assigned vehicle for vehicle feedback." });
      if (responsibleParty === 'driver' && !booking?.driverId) return res.status(400).json({ message: "This booking has no assigned driver." });
      if (responsibleParty === 'vehicle' && !booking?.vehicleId) return res.status(400).json({ message: "This booking has no assigned vehicle." });
      if (responsibleParty && !['company', 'driver', 'vehicle', 'vendor', 'customer', 'unclear'].includes(responsibleParty)) {
        return res.status(400).json({ message: "Invalid responsible party." });
      }
      if (vehicleIssueReported !== undefined && typeof vehicleIssueReported !== 'boolean') return res.status(400).json({ message: "vehicleIssueReported must be boolean." });
      if (breakdownOccurred !== undefined && typeof breakdownOccurred !== 'boolean') return res.status(400).json({ message: "breakdownOccurred must be boolean." });
      if (vehicleIssueDescription !== undefined && typeof vehicleIssueDescription !== 'string') return res.status(400).json({ message: "vehicleIssueDescription must be text." });
      if (comments !== undefined && typeof comments !== 'string') return res.status(400).json({ message: "comments must be text." });
      if (!Object.values(ratingFields).some((value) => value !== undefined) && !comments?.trim() && !vehicleIssueReported && !breakdownOccurred) {
        return res.status(400).json({ message: "Add a rating or feedback comment." });
      }
      const feedbackType = type || 'feedback';
      if (bookingId && await CustomerFeedback.exists({ tenantId: req.tenantId, customerId: customer._id, bookingId, type: feedbackType })) {
        return res.status(409).json({ message: "Feedback for this booking already exists. The original record was preserved." });
      }

      const feedback = await CustomerFeedback.create({
        tenantId: req.tenantId, customerId: req.params.id, bookingId: bookingId || undefined,
        driverId: booking?.driverId, vehicleId: booking?.vehicleId,
        type: feedbackType, ...ratingFields, vehicleIssueReported, breakdownOccurred,
        vehicleIssueDescription: vehicleIssueDescription?.trim(), wouldBookAgain, wouldRecommend,
        responsibleParty, comments: comments?.trim(),
        createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      await feedback.populate(['bookingId', 'driverId', 'vehicleId']);
      res.status(201).json(feedback);
    } catch (error: any) {
      console.error('Add feedback error:', error?.message || error);
      res.status(500).json({ message: "Failed to record feedback" });
    }
  });

  app.get("/api/customers/:id/drivers", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid customer ID" });
      const customer = await Customer.exists({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      res.json(await buildCustomerDriverHistory(req.tenantId!, req.params.id));
    } catch (error: any) {
      console.error('Customer driver history error:', error?.message || error);
      res.status(500).json({ message: "Failed to build customer driver history" });
    }
  });

  app.get("/api/customers/:id/vehicles", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid customer ID" });
      const customer = await Customer.exists({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      res.json(await buildCustomerVehicleHistory(req.tenantId!, req.params.id));
    } catch (error: any) {
      console.error('Customer vehicle history error:', error?.message || error);
      res.status(500).json({ message: "Failed to build customer vehicle history" });
    }
  });

  // Complaints and service recovery.
  app.get("/api/customers/:id/complaints", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const rows = await CustomerComplaint.find({ tenantId: req.tenantId, customerId: req.params.id })
        .populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation')
        .populate('driverId', 'name phone status')
        .populate('vehicleId', 'make vehicleModel licensePlate')
        .sort({ createdAt: -1 });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch complaints" });
    }
  });

  app.post("/api/customers/:id/complaints", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { bookingId, category, severity, description, responsibleParty, responsibilityReason, assignedTo, resolutionDeadline } = req.body || {};
      if (!category || !description || !description.trim()) {
        return res.status(400).json({ message: "category and description are required." });
      }
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      const booking: any = bookingId
        ? await Booking.findOne({ _id: bookingId, tenantId: req.tenantId, customerId: customer._id }).lean()
        : null;
      if (bookingId && !booking) return res.status(400).json({ message: "bookingId does not belong to this customer." });
      const classifiedParty = responsibleParty || 'unclear';
      if (!['company', 'driver', 'vehicle', 'vendor', 'customer', 'unclear'].includes(classifiedParty)) {
        return res.status(400).json({ message: "Invalid responsible party." });
      }
      if (classifiedParty === 'driver' && !booking?.driverId) return res.status(400).json({ message: "This booking has no assigned driver." });
      if (classifiedParty === 'vehicle' && !booking?.vehicleId) return res.status(400).json({ message: "This booking has no assigned vehicle." });
      if (classifiedParty !== 'unclear' && !responsibilityReason?.trim()) {
        return res.status(400).json({ message: "A responsibility reason is required before assigning fault." });
      }
      const actor = { userId: req.userId!, role: req.user?.role || 'client' };

      const complaint = await CustomerComplaint.create({
        tenantId: req.tenantId, customerId: req.params.id, bookingId: bookingId || undefined,
        driverId: booking?.driverId, vehicleId: booking?.vehicleId,
        category, severity: severity || 'medium', description,
        responsibleParty: classifiedParty, responsibilityReason: responsibilityReason?.trim(), assignedTo,
        responsibilityVerifiedBy: classifiedParty !== 'unclear' ? actor : undefined,
        responsibilityVerifiedAt: classifiedParty !== 'unclear' ? new Date() : undefined,
        resolutionDeadline: resolutionDeadline ? new Date(resolutionDeadline) : undefined,
        status: 'open',
        createdBy: actor,
      });
      await complaint.populate(['bookingId', 'driverId', 'vehicleId']);
      res.status(201).json(complaint);
    } catch (error: any) {
      console.error('Add complaint error:', error?.message || error);
      res.status(500).json({ message: "Failed to record complaint" });
    }
  });

  // Resolving a complaint with financial/reward compensation creates a
  // REAL transaction in the payment or reward ledger — never a bare
  // "compensationAmount" field with nothing behind it. Every other field
  // update (status, assignee, resolution note) can happen without
  // compensation; compensation is opt-in via correctiveAction.
  app.put("/api/customers/:id/complaints/:complaintId", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const complaint = await CustomerComplaint.findOne({ _id: req.params.complaintId, tenantId: req.tenantId, customerId: req.params.id });
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      const { status, assignedTo, resolutionDeadline, correctiveAction, compensationAmount, compensationPoints, resolution, satisfactionAfterResolution, responsibleParty, responsibilityReason } = req.body || {};
      const actor = { userId: req.userId!, role: req.user?.role || 'client' };

      if (status) complaint.status = status;
      if (assignedTo !== undefined) complaint.assignedTo = assignedTo;
      if (resolutionDeadline) complaint.resolutionDeadline = new Date(resolutionDeadline);
      if (resolution !== undefined) complaint.resolution = resolution;
      if (satisfactionAfterResolution) complaint.satisfactionAfterResolution = satisfactionAfterResolution;
      if (responsibleParty !== undefined) {
        if (!['company', 'driver', 'vehicle', 'vendor', 'customer', 'unclear'].includes(responsibleParty)) {
          return res.status(400).json({ message: "Invalid responsible party." });
        }
        if (responsibleParty === 'driver' && !complaint.driverId) return res.status(400).json({ message: "This complaint has no linked driver." });
        if (responsibleParty === 'vehicle' && !complaint.vehicleId) return res.status(400).json({ message: "This complaint has no linked vehicle." });
        if (responsibleParty !== 'unclear' && !(responsibilityReason || complaint.responsibilityReason)?.trim()) {
          return res.status(400).json({ message: "A responsibility reason is required before assigning fault." });
        }
        complaint.responsibleParty = responsibleParty;
        complaint.responsibilityReason = responsibleParty === 'unclear' ? undefined : (responsibilityReason || complaint.responsibilityReason)?.trim();
        complaint.responsibilityVerifiedBy = responsibleParty === 'unclear' ? undefined : actor;
        complaint.responsibilityVerifiedAt = responsibleParty === 'unclear' ? undefined : new Date();
      } else if (responsibilityReason !== undefined) {
        complaint.responsibilityReason = responsibilityReason.trim();
      }

      if (correctiveAction && correctiveAction !== complaint.correctiveAction) {
        complaint.correctiveAction = correctiveAction;

        if ((correctiveAction === 'refund' || correctiveAction === 'partial_refund') && compensationAmount > 0 && complaint.bookingId) {
          const result = await recordPayment({
            tenantId: req.tenantId!, bookingId: complaint.bookingId.toString(),
            amount: compensationAmount, paymentType: 'refund', paymentMode: 'cash',
            notes: `Service recovery for complaint: ${complaint.category}`,
            createdBy: actor,
            idempotencyKey: `${req.tenantId}_${complaint._id}_service_recovery_refund`,
          });
          complaint.compensationAmount = compensationAmount;
          complaint.refundTransactionId = (result.transaction as any)._id;
        }

        if (correctiveAction === 'reward_points' && compensationPoints > 0) {
          const tx = await adjustRewardPoints(
            req.tenantId!, req.params.id, compensationPoints,
            `Service recovery for complaint: ${complaint.category}`,
            actor,
            `${req.tenantId}_${complaint._id}_service_recovery_points`,
          );
          complaint.compensationPoints = compensationPoints;
          complaint.rewardTransactionId = (tx as any)._id;
        }
      }

      if (status === 'resolved' || status === 'closed') {
        complaint.resolvedAt = complaint.resolvedAt || new Date();
      }

      await complaint.save();
      res.json(complaint);
    } catch (error: any) {
      console.error('Resolve complaint error:', error?.message || error);
      res.status(500).json({ message: "Failed to update complaint" });
    }
  });

  // Consent — Customer.consent is the fast-read current state,
  // CustomerConsentEvent is the append-only history behind it (same
  // split as tags). Every promotional send, once campaigns exist, must
  // check consent.promotional + status here, never assume consent.
  app.get("/api/customers/:id/consent", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      const history = await CustomerConsentEvent.find({ tenantId: req.tenantId, customerId: req.params.id }).sort({ createdAt: -1 });
      res.json({
        consent: customer.consent, consentSource: customer.consentSource, consentDate: customer.consentDate,
        optOutDate: customer.optOutDate, doNotContactReason: customer.doNotContactReason,
        status: customer.status, history,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch consent" });
    }
  });

  app.post("/api/customers/:id/consent", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { channel, source } = req.body || {};
      const VALID_CHANNELS = ['whatsapp', 'promotional', 'email', 'sms'];
      if (!VALID_CHANNELS.includes(channel)) {
        return res.status(400).json({ message: `channel must be one of: ${VALID_CHANNELS.join(', ')}` });
      }
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      customer.consent = customer.consent || { whatsapp: true, promotional: false, email: true, sms: true };
      (customer.consent as any)[channel] = true;
      customer.consentSource = source || 'manual';
      customer.consentDate = new Date();
      // Opting back into ANY channel is a real signal the customer wants
      // to be reachable again — a standing do_not_contact status must not
      // silently keep blocking them after they've explicitly said yes.
      if (customer.status === 'do_not_contact') {
        customer.status = 'active';
        customer.doNotContactReason = undefined;
      }
      await customer.save();

      await CustomerConsentEvent.create({
        tenantId: req.tenantId, customerId: customer._id, channel, action: 'opted_in', source: source || 'manual',
        actor: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      res.json(customer);
    } catch (error: any) {
      console.error('Grant consent error:', error?.message || error);
      res.status(500).json({ message: "Failed to record consent" });
    }
  });

  // channel='all' also flips Customer.status to 'do_not_contact' — the
  // hard stop every future campaign-recipient query must respect,
  // distinct from a single-channel opt-out (e.g. off WhatsApp, still
  // fine to email).
  app.post("/api/customers/:id/opt-out", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { channel, reason } = req.body || {};
      const VALID_CHANNELS = ['whatsapp', 'promotional', 'email', 'sms', 'all'];
      if (!VALID_CHANNELS.includes(channel)) {
        return res.status(400).json({ message: `channel must be one of: ${VALID_CHANNELS.join(', ')}` });
      }
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const actor = { userId: req.userId!, role: req.user?.role || 'client' };
      const channelsToRevoke = channel === 'all' ? ['whatsapp', 'promotional', 'email', 'sms'] : [channel];
      customer.consent = customer.consent || { whatsapp: true, promotional: false, email: true, sms: true };
      for (const ch of channelsToRevoke) {
        (customer.consent as any)[ch] = false;
        await CustomerConsentEvent.create({
          tenantId: req.tenantId, customerId: customer._id, channel: ch, action: 'opted_out',
          source: 'manual', reason, actor,
        });
      }
      customer.optOutDate = new Date();
      if (channel === 'all') {
        customer.status = 'do_not_contact';
        customer.doNotContactReason = reason;
      }
      await customer.save();
      res.json(customer);
    } catch (error: any) {
      console.error('Opt-out error:', error?.message || error);
      res.status(500).json({ message: "Failed to record opt-out" });
    }
  });

  // After-sales follow-up tasks. The global list (no :id) backs the
  // Customers -> After-Sales page — every task across every customer,
  // filterable by status, not scoped to one customer at a time.
  app.get("/api/follow-ups", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { status } = req.query;
      const query: any = { tenantId: req.tenantId };
      if (status) query.status = status;
      const rows = await CustomerFollowUp.find(query).populate('customerId', 'name primaryMobile').sort({ dueDate: 1 });
      res.json(rows);
    } catch (error: any) {
      console.error('List follow-ups error:', error?.message || error);
      res.status(500).json({ message: "Failed to fetch follow-up tasks" });
    }
  });

  app.get("/api/customers/:id/follow-ups", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const rows = await CustomerFollowUp.find({ tenantId: req.tenantId, customerId: req.params.id }).sort({ dueDate: 1 });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch follow-up tasks" });
    }
  });

  app.post("/api/customers/:id/follow-ups", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { bookingId, taskType, assignedTo, dueDate, priority, notes } = req.body || {};
      if (!taskType || !dueDate) return res.status(400).json({ message: "taskType and dueDate are required." });
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      if (bookingId && !await Booking.exists({ _id: bookingId, tenantId: req.tenantId, customerId: customer._id })) {
        return res.status(400).json({ message: "bookingId does not belong to this customer." });
      }
      const task = await CustomerFollowUp.create({
        tenantId: req.tenantId, customerId: req.params.id, bookingId: bookingId || undefined,
        taskType, assignedTo, dueDate: new Date(dueDate), priority: priority || 'medium', notes,
        createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      res.json(task);
    } catch (error: any) {
      console.error('Add follow-up error:', error?.message || error);
      res.status(500).json({ message: "Failed to create follow-up task" });
    }
  });

  app.put("/api/follow-ups/:taskId", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { status, notes, communicationResult, nextFollowUp, resolution, assignedTo } = req.body || {};
      const update: any = {};
      if (status) update.status = status;
      if (notes !== undefined) update.notes = notes;
      if (communicationResult !== undefined) update.communicationResult = communicationResult;
      if (nextFollowUp) update.nextFollowUp = new Date(nextFollowUp);
      if (resolution !== undefined) update.resolution = resolution;
      if (assignedTo !== undefined) update.assignedTo = assignedTo;

      const task = await CustomerFollowUp.findOneAndUpdate(
        { _id: req.params.taskId, tenantId: req.tenantId }, update, { new: true }
      );
      if (!task) return res.status(404).json({ message: "Follow-up task not found" });
      res.json(task);
    } catch (error: any) {
      console.error('Update follow-up error:', error?.message || error);
      res.status(500).json({ message: "Failed to update follow-up task" });
    }
  });

  // Google review tracking is deliberately confirmation-based. Sending a
  // request never marks a review as received; only the evidence-gated
  // /received action below can do that.
  app.get("/api/customers/:id/google-reviews", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid customer ID" });
      const customer = await Customer.exists({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      const rows = await GoogleReviewTracking.find({ tenantId: req.tenantId, customerId: req.params.id })
        .populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation status')
        .populate('requestMessageId', 'status provider providerMessageId sentAt')
        .populate('rewardTransactionId', 'transactionType points balanceAfter reason createdAt')
        .sort({ requestDate: -1, reviewDate: -1, createdAt: -1 });
      res.json(rows);
    } catch (error: any) {
      console.error('List Google reviews error:', error?.message || error);
      res.status(500).json({ message: "Failed to fetch Google review tracking" });
    }
  });

  app.post("/api/customers/:id/google-reviews/request", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { bookingId, channel, reviewPageUrl, requestId, confirmedSent } = req.body || {};
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid customer ID" });
      if (!mongoose.isValidObjectId(bookingId)) return res.status(400).json({ message: "A valid completed booking is required" });
      if (!GOOGLE_REVIEW_CHANNELS.includes(channel)) return res.status(400).json({ message: "Invalid review request channel" });
      if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) {
        return res.status(400).json({ message: "A valid requestId is required" });
      }
      const pageUrl = safeGoogleReviewUrl(reviewPageUrl);
      if (!pageUrl) return res.status(400).json({ message: "A valid Google review page URL is required" });

      const [customer, booking, tenant] = await Promise.all([
        Customer.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } }),
        Booking.findOne({ _id: bookingId, tenantId: req.tenantId, customerId: req.params.id }),
        storage.getTenant(req.tenantId!),
      ]);
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      if (!booking) return res.status(400).json({ message: "bookingId does not belong to this customer" });
      if (!REVIEW_ELIGIBLE_STATUSES.has(booking.status)) {
        return res.status(400).json({ message: "Google review requests are allowed only after trip completion" });
      }

      let tracking = await GoogleReviewTracking.findOne({ tenantId: req.tenantId, customerId: customer._id, bookingId: booking._id });
      if (tracking?.reviewReceived) return res.status(409).json({ message: "A received Google review is already confirmed for this booking" });
      const previousAttempt = tracking?.requestHistory?.find((attempt: any) => attempt.requestId === requestId);
      if (previousAttempt) {
        await tracking!.populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation status');
        return res.json({ alreadyProcessed: true, review: tracking });
      }

      const actor = { userId: req.userId!, role: req.user?.role || 'client' };
      let messageDoc: any;
      let sentAt = new Date();
      if (channel === 'whatsapp') {
        if (customer.status === 'do_not_contact' || customer.consent?.whatsapp === false) {
          return res.status(400).json({ message: "Customer has opted out of WhatsApp messages" });
        }
        const recipientPhone = normalizeIndianPhone(customer.whatsappNumber || customer.primaryMobile);
        if (!recipientPhone) return res.status(400).json({ message: "Customer WhatsApp number is invalid" });
        const idempotencyKey = `${req.tenantId}_${customer._id}_google_review_request_${requestId}`;
        messageDoc = await WhatsAppMessage.findOne({ idempotencyKey, status: { $in: ['queued', 'sent'] } });
        if (messageDoc?.status === 'queued') {
          return res.status(409).json({ message: "This Google review request is already being processed" });
        }
        if (!messageDoc) {
          messageDoc = await WhatsAppMessage.create({
            tenantId: req.tenantId, customerId: customer._id, bookingId: booking._id,
            recipientType: 'customer', recipientPhone, messageType: 'customer_google_review_request',
            content: googleReviewRequestMessage(customer, booking, tenant, pageUrl),
            provider: whatsappProvider.kind, status: 'queued', attemptCount: 0, createdBy: actor, idempotencyKey,
          });
          const result = await whatsappProvider.sendText(req.tenantId!, recipientPhone, messageDoc.content);
          messageDoc.attemptCount = 1;
          messageDoc.status = result.status === 'sent' ? 'sent' : 'failed';
          messageDoc.providerMessageId = result.providerMessageId || undefined;
          messageDoc.error = result.error || undefined;
          if (result.status === 'sent') messageDoc.sentAt = new Date();
          await messageDoc.save();
          if (result.status !== 'sent') {
            return res.status(502).json({ message: result.error || "Google review request was not sent", messageDoc });
          }
        }
        sentAt = messageDoc.sentAt || messageDoc.createdAt || sentAt;
      } else if (confirmedSent !== true) {
        return res.status(400).json({ message: "Confirm that the review request was actually sent through this channel" });
      }

      if (!tracking) {
        tracking = new GoogleReviewTracking({ tenantId: req.tenantId, customerId: customer._id, bookingId: booking._id });
      }
      tracking.reviewPageUrl = pageUrl;
      tracking.reviewRequested = true;
      tracking.requestDate = sentAt;
      tracking.requestSentThrough = channel;
      tracking.requestMessageId = messageDoc?._id;
      tracking.followUpRequired = true;
      tracking.lastUpdatedBy = actor;
      tracking.requestHistory.push({ sentAt, channel, messageId: messageDoc?._id, requestId, sentBy: actor });
      await tracking.save();

      const openReviewTask = await CustomerFollowUp.exists({
        tenantId: req.tenantId, customerId: customer._id, bookingId: booking._id,
        taskType: 'Google review follow-up', status: { $nin: ['resolved', 'closed', 'do_not_contact'] },
      });
      if (!openReviewTask) {
        const dueDate = new Date(sentAt); dueDate.setDate(dueDate.getDate() + 3);
        await CustomerFollowUp.create({
          tenantId: req.tenantId, customerId: customer._id, bookingId: booking._id,
          taskType: 'Google review follow-up', dueDate, priority: 'low',
          notes: `Review requested through ${String(channel).replace(/_/g, ' ')}`,
          createdBy: actor,
        });
      }
      await tracking.populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation status');
      res.status(201).json({ alreadyProcessed: false, review: tracking, message: messageDoc });
    } catch (error: any) {
      if (error?.code === 11000) return res.status(409).json({ message: "This review request is already being processed" });
      console.error('Send Google review request error:', error?.message || error);
      res.status(500).json({ message: "Failed to send Google review request" });
    }
  });

  app.put("/api/customers/:id/google-reviews/:reviewId/received", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { confirmedReceived, reviewDate, reviewRating, reviewLink, reviewReference, responseStatus, notes } = req.body || {};
      if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.reviewId)) {
        return res.status(400).json({ message: "Invalid customer or review ID" });
      }
      if (confirmedReceived !== true) return res.status(400).json({ message: "Explicit review-received confirmation is required" });
      const rating = Number(reviewRating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "Google review rating must be a whole number from 1 to 5" });
      const link = reviewLink ? safeGoogleReviewUrl(reviewLink) : undefined;
      if (reviewLink && !link) return res.status(400).json({ message: "Review link must be a valid HTTP or HTTPS URL" });
      if (!link && (typeof reviewReference !== 'string' || reviewReference.trim().length < 3)) {
        return res.status(400).json({ message: "Add the actual review link or a screenshot/reference before confirming receipt" });
      }
      if (responseStatus && !['not_required', 'pending', 'responded'].includes(responseStatus)) {
        return res.status(400).json({ message: "Invalid review response status" });
      }
      const receivedAt = reviewDate ? new Date(reviewDate) : new Date();
      if (Number.isNaN(receivedAt.getTime()) || receivedAt.getTime() > Date.now() + 300000) {
        return res.status(400).json({ message: "Review date is invalid or in the future" });
      }

      const review = await GoogleReviewTracking.findOne({ _id: req.params.reviewId, tenantId: req.tenantId, customerId: req.params.id });
      if (!review) return res.status(404).json({ message: "Google review tracking record not found" });
      const actor = { userId: req.userId!, role: req.user?.role || 'client' };
      if (review.reviewReceived) {
        const reward = await creditVerifiedGoogleReviewReward(req.tenantId!, req.params.id, review._id.toString(), actor);
        if (reward && review.rewardTransactionId?.toString() !== reward._id.toString()) {
          review.rewardTransactionId = reward._id;
          review.lastUpdatedBy = actor;
          await review.save();
        }
        await review.populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation status');
        await review.populate('rewardTransactionId', 'transactionType points balanceAfter reason createdAt');
        return res.json(review);
      }

      review.reviewReceived = true;
      review.reviewDate = receivedAt;
      review.reviewRating = rating;
      review.reviewLink = link;
      review.reviewReference = typeof reviewReference === 'string' ? reviewReference.trim() : undefined;
      review.followUpRequired = false;
      review.responseStatus = responseStatus || 'pending';
      review.notes = typeof notes === 'string' ? notes.trim() : review.notes;
      review.reviewConfirmedBy = actor;
      review.reviewConfirmedAt = new Date();
      review.lastUpdatedBy = actor;
      if (review.responseStatus === 'responded') {
        review.respondedAt = new Date();
        review.respondedBy = actor;
      }
      await review.save();
      const reward = await creditVerifiedGoogleReviewReward(req.tenantId!, req.params.id, review._id.toString(), actor);
      if (reward) {
        review.rewardTransactionId = reward._id;
        await review.save();
      }
      await CustomerFollowUp.updateMany({
        tenantId: req.tenantId, customerId: req.params.id, bookingId: review.bookingId,
        taskType: 'Google review follow-up', status: { $nin: ['resolved', 'closed'] },
      }, {
        $set: { status: 'resolved', resolution: 'Google review receipt confirmed with evidence.', communicationResult: `Received ${rating}-star Google review.` },
      });
      await review.populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation status');
      await review.populate('rewardTransactionId', 'transactionType points balanceAfter reason createdAt');
      res.json(review);
    } catch (error: any) {
      console.error('Confirm Google review receipt error:', error?.message || error);
      res.status(500).json({ message: "Failed to confirm Google review receipt" });
    }
  });

  app.put("/api/customers/:id/google-reviews/:reviewId", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.reviewId)) {
        return res.status(400).json({ message: "Invalid customer or review ID" });
      }
      const review = await GoogleReviewTracking.findOne({ _id: req.params.reviewId, tenantId: req.tenantId, customerId: req.params.id });
      if (!review) return res.status(404).json({ message: "Google review tracking record not found" });
      const { reviewPageUrl, reviewLink, reviewReference, reviewRating, reviewDate, followUpRequired, responseStatus, notes } = req.body || {};
      if (reviewPageUrl !== undefined) {
        const value = safeGoogleReviewUrl(reviewPageUrl);
        if (!value) return res.status(400).json({ message: "Google review page URL is invalid" });
        review.reviewPageUrl = value;
      }
      if (reviewLink !== undefined) {
        const value = reviewLink ? safeGoogleReviewUrl(reviewLink) : undefined;
        if (reviewLink && !value) return res.status(400).json({ message: "Review link is invalid" });
        review.reviewLink = value;
      }
      if (reviewReference !== undefined) review.reviewReference = String(reviewReference).trim() || undefined;
      if (reviewRating !== undefined) {
        if (!review.reviewReceived) return res.status(400).json({ message: "Confirm the review receipt before adding its rating" });
        const rating = Number(reviewRating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "Google review rating must be a whole number from 1 to 5" });
        review.reviewRating = rating;
      }
      if (reviewDate !== undefined) {
        if (!review.reviewReceived) return res.status(400).json({ message: "Confirm the review receipt before changing its date" });
        const value = new Date(reviewDate);
        if (Number.isNaN(value.getTime()) || value.getTime() > Date.now() + 300000) return res.status(400).json({ message: "Review date is invalid or in the future" });
        review.reviewDate = value;
      }
      if (followUpRequired !== undefined) {
        if (typeof followUpRequired !== 'boolean') return res.status(400).json({ message: "followUpRequired must be boolean" });
        review.followUpRequired = followUpRequired;
      }
      const actor = { userId: req.userId!, role: req.user?.role || 'client' };
      if (responseStatus !== undefined) {
        if (!['not_required', 'pending', 'responded'].includes(responseStatus)) return res.status(400).json({ message: "Invalid review response status" });
        if (responseStatus !== 'not_required' && !review.reviewReceived) return res.status(400).json({ message: "A response status requires a confirmed received review" });
        review.responseStatus = responseStatus;
        if (responseStatus === 'responded' && !review.respondedAt) {
          review.respondedAt = new Date();
          review.respondedBy = actor;
        } else if (responseStatus !== 'responded') {
          review.respondedAt = undefined;
          review.respondedBy = undefined;
        }
      }
      if (notes !== undefined) review.notes = String(notes).trim() || undefined;
      review.lastUpdatedBy = actor;
      await review.save();

      if (review.followUpRequired) {
        const openTask = await CustomerFollowUp.exists({
          tenantId: req.tenantId, customerId: req.params.id, bookingId: review.bookingId,
          taskType: 'Google review follow-up', status: { $nin: ['resolved', 'closed', 'do_not_contact'] },
        });
        if (!openTask) {
          const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 3);
          await CustomerFollowUp.create({
            tenantId: req.tenantId, customerId: req.params.id, bookingId: review.bookingId,
            taskType: 'Google review follow-up', dueDate, priority: 'low', notes: 'Added from Google Review tracking.', createdBy: actor,
          });
        }
      }
      await review.populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation status');
      res.json(review);
    } catch (error: any) {
      console.error('Update Google review tracking error:', error?.message || error);
      res.status(500).json({ message: "Failed to update Google review tracking" });
    }
  });

  // Quick lookup by phone while typing in the booking form — returns the
  // matching customer (if any) plus enough summary data for the "previous
  // bookings, tier, dues, warnings" panel from spec section 22, without
  // the caller having to separately fetch booking history.
  app.get("/api/customers/lookup", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const { phone } = req.query;
      const normalized = normalizeIndianPhone((phone as string) || '');
      if (!normalized) return res.json({ customer: null });

      const customer = await Customer.findOne({
        tenantId: req.tenantId, isDeleted: { $ne: true },
        $or: [{ primaryMobile: normalized }, { alternateMobile: normalized }, { whatsappNumber: normalized }, { phoneAliases: normalized }],
      });
      if (!customer) return res.json({ customer: null });

      const bookings = await Booking.find({ customerId: customer._id }).sort({ pickupDate: -1 }).limit(5);
      const pendingDue = bookings.reduce((sum, b: any) => sum + Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0)), 0);

      res.json({
        customer,
        recentBookings: bookings.map((b: any) => ({
          bookingId: b.bookingId, pickupLocation: b.pickupLocation, dropoffLocation: b.dropoffLocation,
          pickupDate: b.pickupDate, status: b.status, totalAmount: b.totalAmount,
        })),
        pendingDue,
      });
    } catch (error: any) {
      console.error('Customer lookup error:', error?.message || error);
      res.status(500).json({ message: "Failed to look up customer" });
    }
  });

  app.get("/api/customers/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.get("/api/customers/:id/bookings", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const bookings = await Booking.find({ customerId: req.params.id, tenantId: req.tenantId })
        .populate('vehicleId').populate('driverId')
        .sort({ pickupDate: -1 });
      res.json(bookings);
    } catch (error: any) {
      console.error('Customer bookings error:', error?.message || error);
      res.status(500).json({ message: "Failed to fetch customer bookings" });
    }
  });

  app.get("/api/customers/:id/duplicate-candidates", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const result = await findDuplicateCandidates(req.tenantId!, req.params.id);
      if (!result) return res.status(404).json({ message: "Customer not found" });
      res.json(result);
    } catch (error: any) {
      console.error('Duplicate candidate search error:', error?.message || error);
      res.status(500).json({ message: "Failed to find duplicate customers" });
    }
  });

  app.post("/api/customers/merge", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      if (!req.user || !['admin', 'client'].includes(req.user.role)) {
        return res.status(403).json({ message: "Only an administrator or account owner can merge customers." });
      }
      const { sourceCustomerId, targetCustomerId, reason } = req.body || {};
      const result = await mergeCustomers({
        tenantId: req.tenantId!, sourceCustomerId, targetCustomerId, reason: String(reason || ''),
        actor: { userId: req.userId!, role: req.user.role },
      });
      res.json(result);
    } catch (error: any) {
      console.error('Customer merge error:', error?.message || error);
      res.status(error?.status || 500).json({ message: error?.message || "Failed to merge customers" });
    }
  });

  // Requirements are immutable snapshots. Staff add a new version when a
  // customer's needs change so older booking agreements remain auditable.
  app.get("/api/customers/:id/requirements", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const customer = await Customer.exists({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      const rows = await CustomerRequirement.find({ tenantId: req.tenantId, customerId: req.params.id })
        .populate('bookingId', 'bookingId pickupDate')
        .sort({ createdAt: -1 });
      res.json(rows);
    } catch (error: any) {
      console.error('Customer requirements error:', error?.message || error);
      res.status(500).json({ message: "Failed to fetch customer requirements" });
    }
  });

  app.post("/api/customers/:id/requirements", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const customer = await Customer.exists({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } });
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const allowed = [
        'bookingId', 'tripRequirement', 'pickupRequirements', 'dropRequirements', 'route', 'multipleStops',
        'numberOfPassengers', 'luggage', 'hotelDetails', 'trainFlightDetails', 'seniorCitizenRequirement',
        'childRequirement', 'wheelchair', 'templeTiming', 'darshanTiming', 'vehicleCategory',
        'driverPreference', 'languagePreference', 'acRequirement', 'paymentArrangement',
        'tollParkingAgreement', 'includedServices', 'excludedServices', 'customerVisibleInstructions',
        'driverInstructions', 'officeOnlyNotes', 'billingInstructions',
      ];
      const payload: Record<string, any> = {};
      for (const key of allowed) if (req.body?.[key] !== undefined) payload[key] = req.body[key];
      for (const key of ['multipleStops', 'includedServices', 'excludedServices']) {
        if (payload[key] !== undefined && !Array.isArray(payload[key])) {
          return res.status(400).json({ message: `${key} must be an array.` });
        }
        if (Array.isArray(payload[key])) payload[key] = payload[key].map((value: any) => String(value).trim()).filter(Boolean);
      }
      if (payload.numberOfPassengers !== undefined) {
        payload.numberOfPassengers = Number(payload.numberOfPassengers);
        if (!Number.isInteger(payload.numberOfPassengers) || payload.numberOfPassengers < 1) {
          return res.status(400).json({ message: "numberOfPassengers must be a positive whole number." });
        }
      }
      if (payload.bookingId && !await Booking.exists({
        _id: payload.bookingId, tenantId: req.tenantId, customerId: req.params.id,
      })) {
        return res.status(400).json({ message: "bookingId does not belong to this customer." });
      }
      const hasRequirement = Object.entries(payload).some(([key, value]) => {
        if (key === 'bookingId' || value === undefined || value === null) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (typeof value === 'boolean') return value;
        if (Array.isArray(value)) return value.length > 0;
        return true;
      });
      if (!hasRequirement) return res.status(400).json({ message: "Add at least one requirement." });

      const requirement = await CustomerRequirement.create({
        tenantId: req.tenantId,
        customerId: req.params.id,
        ...payload,
        createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      await requirement.populate('bookingId', 'bookingId pickupDate');
      res.status(201).json(requirement);
    } catch (error: any) {
      console.error('Add customer requirement error:', error?.message || error);
      res.status(500).json({ message: "Failed to add customer requirement" });
    }
  });

  // ── Inquiry CRM (additive — see docs/INQUIRY_LEAD_EXISTING_AUDIT.md) ──
  // A real pre-sales pipeline entity, distinct from Booking's early
  // 'enquiry'/'quotation_sent' statuses, so office staff can log a phone
  // call that may never become a trip without creating a real Booking
  // (which requires a vehicleId today).

  const INQUIRY_ALLOWED_FIELDS = [
    'priority', 'source', 'sourceDetail', 'campaign', 'referrer', 'assignedExecutive', 'nextFollowUpAt',
    'customerName', 'primaryMobile', 'whatsappNumber', 'alternateMobile', 'email', 'linkedCustomerId',
    'tripType', 'pickupDate', 'pickupTime', 'returnDate', 'returnTime', 'flexibleDate',
    'pickupLocation', 'dropLocation', 'viaLocations', 'placesToVisit',
    'numberOfPassengers', 'seniorCitizens', 'children', 'infants', 'luggageCount',
    'route', 'vehicleCategory', 'driverPreference', 'languagePreference', 'acRequirement',
    'paymentArrangement', 'tollParkingAgreement', 'customerVisibleInstructions', 'driverInstructions',
    'officeOnlyNotes', 'billingInstructions', 'vehicleRequirements', 'customVehicleRequests', 'notes',
  ];

  function buildInquiryPayload(body: any): Record<string, any> {
    const payload: Record<string, any> = {};
    for (const key of INQUIRY_ALLOWED_FIELDS) if (body?.[key] !== undefined) payload[key] = body[key];
    return payload;
  }

  app.get("/api/inquiries", authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_INQUIRIES), async (req: AuthRequest, res) => {
    try {
      const query: Record<string, any> = { tenantId: req.tenantId };
      if (req.query.status) query.status = req.query.status;
      if (req.query.priority) query.priority = req.query.priority;
      if (req.query.assignedExecutive) query.assignedExecutive = req.query.assignedExecutive;
      if (req.query.search) {
        const term = String(req.query.search).trim();
        const normalizedPhone = normalizeIndianPhone(term);
        query.$or = [
          { customerName: { $regex: term, $options: 'i' } },
          { primaryMobile: { $regex: normalizedPhone || term, $options: 'i' } },
          { inquiryNumber: { $regex: term, $options: 'i' } },
        ];
      }
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
      const skip = Math.max(0, parseInt(req.query.skip as string) || 0);
      const [rows, total] = await Promise.all([
        Inquiry.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Inquiry.countDocuments(query),
      ]);
      res.json({ rows, total, limit, skip });
    } catch (error: any) {
      console.error('List inquiries error:', error?.message || error);
      res.status(500).json({ message: "Failed to load inquiries" });
    }
  });

  app.get("/api/inquiries/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_INQUIRIES), async (req: AuthRequest, res) => {
    try {
      const inquiry = await Inquiry.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
      res.json(inquiry);
    } catch (error: any) {
      console.error('Get inquiry error:', error?.message || error);
      res.status(500).json({ message: "Failed to load inquiry" });
    }
  });

  app.post("/api/inquiries", authenticateUser, requireTenant, requirePermission(PERMISSIONS.CREATE_INQUIRY), async (req: AuthRequest, res) => {
    try {
      if (!req.body?.customerName?.trim()) return res.status(400).json({ message: "Customer name is required." });
      if (!req.body?.primaryMobile?.trim()) return res.status(400).json({ message: "Primary mobile is required." });
      const normalizedMobile = normalizeIndianPhone(req.body.primaryMobile);
      if (!normalizedMobile) return res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number." });

      const payload = buildInquiryPayload(req.body);
      payload.customerName = req.body.customerName.trim();
      payload.primaryMobile = normalizedMobile;
      if (!payload.source) payload.source = 'phone_call';

      const inquiryNumber = await nextInquiryNumber(req.tenantId!);
      const inquiry = await Inquiry.create({
        tenantId: req.tenantId,
        inquiryNumber,
        status: 'new',
        ...payload,
        createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      res.status(201).json(inquiry);
    } catch (error: any) {
      console.error('Create inquiry error:', error?.message || error);
      res.status(500).json({ message: "Failed to create inquiry" });
    }
  });

  app.patch("/api/inquiries/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_INQUIRY), async (req: AuthRequest, res) => {
    try {
      const inquiry = await Inquiry.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
      if (isTerminalInquiryStatus(inquiry.status as InquiryStatusValue)) {
        return res.status(400).json({ message: `Cannot edit an inquiry that is already "${inquiry.status}".` });
      }

      const payload = buildInquiryPayload(req.body);
      if (payload.primaryMobile !== undefined) {
        const normalized = normalizeIndianPhone(payload.primaryMobile);
        if (!normalized) return res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number." });
        payload.primaryMobile = normalized;
      }
      for (const [key, value] of Object.entries(payload)) {
        (inquiry as any)[key] = value;
      }
      inquiry.updatedAt = new Date();
      await inquiry.save();
      res.json(inquiry);
    } catch (error: any) {
      console.error('Update inquiry error:', error?.message || error);
      res.status(500).json({ message: "Failed to update inquiry" });
    }
  });

  app.post("/api/inquiries/:id/qualify", authenticateUser, requireTenant, requirePermission(PERMISSIONS.QUALIFY_INQUIRY), async (req: AuthRequest, res) => {
    try {
      const inquiry = await Inquiry.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

      const missing = getMissingQualificationFields(inquiry as any);
      if (missing.length > 0) {
        return res.status(400).json({ message: "Missing required fields to qualify this inquiry.", missing });
      }
      try {
        assertValidInquiryTransition(inquiry.status as InquiryStatusValue, 'qualified');
      } catch (e: any) {
        return res.status(400).json({ message: e.message, code: e.code });
      }
      inquiry.status = 'qualified';
      inquiry.updatedAt = new Date();
      await inquiry.save();
      res.json(inquiry);
    } catch (error: any) {
      console.error('Qualify inquiry error:', error?.message || error);
      res.status(500).json({ message: "Failed to qualify inquiry" });
    }
  });

  // Converts a qualified Inquiry into a real Lead (one-to-one, enforced by
  // Lead's unique inquiryId index) and marks the Inquiry converted. Wrapped
  // in a transaction (with a standalone-MongoDB fallback, mirroring the
  // exact pattern already used by storage-mongodb.ts's createBooking) so
  // the two writes never partially succeed — an Inquiry is never left
  // "converted_to_lead" without a real Lead behind it, and vice versa.
  // The response now includes the created `lead` alongside the inquiry;
  // existing callers that only read the top-level inquiry fields (Phase 1's
  // UI) are unaffected by this additive response shape change.
  app.post("/api/inquiries/:id/convert-to-lead", authenticateUser, requireTenant, requirePermission(PERMISSIONS.CONVERT_INQUIRY_TO_LEAD), async (req: AuthRequest, res) => {
    try {
      const inquiry = await Inquiry.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
      if (inquiry.status === 'converted_to_lead') {
        return res.status(400).json({ message: "This inquiry has already been converted to a lead.", code: 'ALREADY_CONVERTED' });
      }
      const existingLead = await Lead.findOne({ tenantId: req.tenantId, inquiryId: inquiry._id });
      if (existingLead) {
        return res.status(400).json({ message: "A lead already exists for this inquiry.", code: 'ALREADY_CONVERTED', lead: existingLead });
      }
      try {
        assertValidInquiryTransition(inquiry.status as InquiryStatusValue, 'converted_to_lead');
      } catch (e: any) {
        return res.status(400).json({ message: e.message, code: e.code });
      }

      const leadNumber = await nextLeadNumber(req.tenantId!);
      const runConvert = async (session?: mongoose.ClientSession) => {
        const [lead] = await Lead.create([{
          tenantId: req.tenantId,
          leadNumber,
          inquiryId: inquiry._id,
          status: 'new',
          priority: inquiry.priority,
          assignedExecutive: inquiry.assignedExecutive,
          createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
        }], { session });
        inquiry.status = 'converted_to_lead';
        inquiry.convertedToLeadAt = new Date();
        inquiry.updatedAt = new Date();
        await inquiry.save({ session });
        return lead;
      };

      let lead;
      try {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => { lead = await runConvert(session); });
        } finally {
          await session.endSession();
        }
      } catch (error: any) {
        if (typeof error?.message === 'string' && error.message.includes('Transaction numbers')) {
          lead = await runConvert(undefined);
        } else {
          throw error;
        }
      }

      res.json({ ...inquiry.toObject(), lead });
    } catch (error: any) {
      console.error('Convert inquiry to lead error:', error?.message || error);
      res.status(500).json({ message: "Failed to convert inquiry to lead" });
    }
  });

  app.post("/api/inquiries/:id/mark-lost", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MARK_INQUIRY_LOST), async (req: AuthRequest, res) => {
    try {
      if (!req.body?.lostReason?.trim()) return res.status(400).json({ message: "A lost reason is required." });
      const inquiry = await Inquiry.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
      try {
        assertValidInquiryTransition(inquiry.status as InquiryStatusValue, 'lost');
      } catch (e: any) {
        return res.status(400).json({ message: e.message, code: e.code });
      }
      inquiry.status = 'lost';
      inquiry.lostReason = req.body.lostReason.trim();
      if (req.body.lostNotes !== undefined) inquiry.lostNotes = req.body.lostNotes;
      if (req.body.futureReconnectDate !== undefined) inquiry.futureReconnectDate = req.body.futureReconnectDate;
      inquiry.updatedAt = new Date();
      await inquiry.save();
      res.json(inquiry);
    } catch (error: any) {
      console.error('Mark inquiry lost error:', error?.message || error);
      res.status(500).json({ message: "Failed to mark inquiry as lost" });
    }
  });

  app.post("/api/inquiries/:id/reopen", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_INQUIRY), async (req: AuthRequest, res) => {
    try {
      const inquiry = await Inquiry.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
      try {
        assertValidInquiryTransition(inquiry.status as InquiryStatusValue, 'contacted');
      } catch (e: any) {
        return res.status(400).json({ message: e.message, code: e.code });
      }
      inquiry.status = 'contacted';
      inquiry.updatedAt = new Date();
      await inquiry.save();
      res.json(inquiry);
    } catch (error: any) {
      console.error('Reopen inquiry error:', error?.message || error);
      res.status(500).json({ message: "Failed to reopen inquiry" });
    }
  });

  // ── Lead pipeline (additive) ──
  // Every Lead references exactly one Inquiry (see the Lead model comment
  // in models/index.ts for why requirement/contact fields are read from
  // there rather than duplicated here).

  app.get("/api/leads", authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_LEADS), async (req: AuthRequest, res) => {
    try {
      const query: Record<string, any> = { tenantId: req.tenantId };
      if (req.query.status) query.status = req.query.status;
      if (req.query.assignedExecutive) query.assignedExecutive = req.query.assignedExecutive;
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
      const skip = Math.max(0, parseInt(req.query.skip as string) || 0);
      const [rows, total] = await Promise.all([
        Lead.find(query)
          .populate('inquiryId')
          .sort({ createdAt: -1 }).skip(skip).limit(limit),
        Lead.countDocuments(query),
      ]);
      res.json({ rows, total, limit, skip });
    } catch (error: any) {
      console.error('List leads error:', error?.message || error);
      res.status(500).json({ message: "Failed to load leads" });
    }
  });

  app.get("/api/leads/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_LEADS), async (req: AuthRequest, res) => {
    try {
      const lead = await Lead.findOne({ _id: req.params.id, tenantId: req.tenantId }).populate('inquiryId');
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      res.json(lead);
    } catch (error: any) {
      console.error('Get lead error:', error?.message || error);
      res.status(500).json({ message: "Failed to load lead" });
    }
  });

  app.patch("/api/leads/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_LEAD), async (req: AuthRequest, res) => {
    try {
      const lead = await Lead.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      if (req.body.status !== undefined) {
        try {
          assertValidLeadTransition(lead.status as LeadStatusValue, req.body.status);
        } catch (e: any) {
          return res.status(400).json({ message: e.message, code: e.code });
        }
        lead.status = req.body.status;
      }
      if (req.body.priority !== undefined) lead.priority = req.body.priority;
      if (req.body.assignedExecutive !== undefined) lead.assignedExecutive = req.body.assignedExecutive;
      lead.updatedAt = new Date();
      await lead.save();
      await lead.populate('inquiryId');
      res.json(lead);
    } catch (error: any) {
      console.error('Update lead error:', error?.message || error);
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  app.post("/api/leads/:id/mark-lost", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MARK_LEAD_LOST), async (req: AuthRequest, res) => {
    try {
      if (!req.body?.lostReason?.trim()) return res.status(400).json({ message: "A lost reason is required." });
      const lead = await Lead.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      try {
        assertValidLeadTransition(lead.status as LeadStatusValue, 'lost');
      } catch (e: any) {
        return res.status(400).json({ message: e.message, code: e.code });
      }
      lead.status = 'lost';
      lead.lostReason = req.body.lostReason.trim();
      if (req.body.lostNotes !== undefined) lead.lostNotes = req.body.lostNotes;
      lead.updatedAt = new Date();
      await lead.save();
      res.json(lead);
    } catch (error: any) {
      console.error('Mark lead lost error:', error?.message || error);
      res.status(500).json({ message: "Failed to mark lead as lost" });
    }
  });

  // ── Quotations (additive) ──
  // Options are validated and their totalPaise recomputed server-side from
  // the same computeOptionTotalPaise() used everywhere else, so a client
  // can never submit an inconsistent/manipulated total.

  function sanitizeQuotationOptions(rawOptions: any): any[] {
    if (!Array.isArray(rawOptions)) return [];
    return rawOptions.map((opt: any, i: number) => {
      const option = {
        optionNumber: i + 1,
        vehicleNameSnapshot: String(opt.vehicleNameSnapshot || '').trim(),
        quantity: Number(opt.quantity) || 1,
        pricingType: opt.pricingType || 'fixed',
        baseRatePaise: opt.baseRatePaise !== undefined ? Number(opt.baseRatePaise) : undefined,
        includedKm: opt.includedKm !== undefined ? Number(opt.includedKm) : undefined,
        extraKmRatePaise: opt.extraKmRatePaise !== undefined ? Number(opt.extraKmRatePaise) : undefined,
        includedHours: opt.includedHours !== undefined ? Number(opt.includedHours) : undefined,
        extraHourRatePaise: opt.extraHourRatePaise !== undefined ? Number(opt.extraHourRatePaise) : undefined,
        minimumKmPerDay: opt.minimumKmPerDay !== undefined ? Number(opt.minimumKmPerDay) : undefined,
        driverAllowancePaise: opt.driverAllowancePaise !== undefined ? Number(opt.driverAllowancePaise) : undefined,
        nightHaltPaise: opt.nightHaltPaise !== undefined ? Number(opt.nightHaltPaise) : undefined,
        tollTreatment: opt.tollTreatment || 'excluded',
        parkingTreatment: opt.parkingTreatment || 'excluded',
        stateTaxTreatment: opt.stateTaxTreatment || 'excluded',
        discountPaise: opt.discountPaise !== undefined ? Number(opt.discountPaise) : 0,
        taxableAmountPaise: opt.taxableAmountPaise !== undefined ? Number(opt.taxableAmountPaise) : undefined,
        gstPaise: opt.gstPaise !== undefined ? Number(opt.gstPaise) : 0,
        notes: opt.notes,
        totalPaise: 0,
      };
      option.totalPaise = computeOptionTotalPaise(option);
      return option;
    });
  }

  app.get("/api/leads/:leadId/quotations", authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_QUOTATIONS), async (req: AuthRequest, res) => {
    try {
      const rows = await Quotation.find({ tenantId: req.tenantId, leadId: req.params.leadId }).sort({ version: -1, createdAt: -1 });
      res.json(rows);
    } catch (error: any) {
      console.error('List quotations error:', error?.message || error);
      res.status(500).json({ message: "Failed to load quotations" });
    }
  });

  app.post("/api/leads/:leadId/quotations", authenticateUser, requireTenant, requirePermission(PERMISSIONS.CREATE_QUOTATION), async (req: AuthRequest, res) => {
    try {
      const lead = await Lead.findOne({ _id: req.params.leadId, tenantId: req.tenantId });
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      const options = sanitizeQuotationOptions(req.body?.options);
      if (options.length === 0) return res.status(400).json({ message: "At least one quotation option is required." });
      if (options.some((o) => !o.vehicleNameSnapshot)) return res.status(400).json({ message: "Every option needs a vehicle name." });

      const quotationNumber = await nextQuotationNumber(req.tenantId!);
      const quotation = await Quotation.create({
        tenantId: req.tenantId,
        quotationNumber,
        leadId: lead._id,
        status: 'draft',
        version: 1,
        options,
        validTill: req.body.validTill || undefined,
        paymentTerms: req.body.paymentTerms,
        termsAndConditions: req.body.termsAndConditions,
        cancellationTerms: req.body.cancellationTerms,
        createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      res.status(201).json(quotation);
    } catch (error: any) {
      console.error('Create quotation error:', error?.message || error);
      res.status(500).json({ message: "Failed to create quotation" });
    }
  });

  app.get("/api/quotations/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_QUOTATIONS), async (req: AuthRequest, res) => {
    try {
      const quotation = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!quotation) return res.status(404).json({ message: "Quotation not found" });
      res.json(quotation);
    } catch (error: any) {
      console.error('Get quotation error:', error?.message || error);
      res.status(500).json({ message: "Failed to load quotation" });
    }
  });

  app.patch("/api/quotations/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_QUOTATION_DRAFT), async (req: AuthRequest, res) => {
    try {
      const quotation = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!quotation) return res.status(404).json({ message: "Quotation not found" });
      if (isImmutableQuotationStatus(quotation.status as QuotationStatusValue)) {
        return res.status(400).json({ message: `Cannot edit a quotation that is already "${quotation.status}".` });
      }
      if (req.body.options !== undefined) {
        const options = sanitizeQuotationOptions(req.body.options);
        if (options.length === 0) return res.status(400).json({ message: "At least one quotation option is required." });
        quotation.options = options;
      }
      if (req.body.validTill !== undefined) quotation.validTill = req.body.validTill;
      if (req.body.paymentTerms !== undefined) quotation.paymentTerms = req.body.paymentTerms;
      if (req.body.termsAndConditions !== undefined) quotation.termsAndConditions = req.body.termsAndConditions;
      if (req.body.cancellationTerms !== undefined) quotation.cancellationTerms = req.body.cancellationTerms;
      quotation.updatedAt = new Date();
      await quotation.save();
      res.json(quotation);
    } catch (error: any) {
      console.error('Update quotation error:', error?.message || error);
      res.status(500).json({ message: "Failed to update quotation" });
    }
  });

  // Generic status transition for the non-side-effecting moves (review,
  // return-for-correction, viewed, customer_query, negotiation, reject,
  // expire, supersede) — approve/send/revise/accept below have their own
  // dedicated endpoints because each has a real side effect beyond the
  // status field itself.
  app.post("/api/quotations/:id/status", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_QUOTATION_DRAFT), async (req: AuthRequest, res) => {
    try {
      const quotation = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!quotation) return res.status(404).json({ message: "Quotation not found" });
      const { status } = req.body;
      if (!status) return res.status(400).json({ message: "A target status is required." });
      try {
        assertValidQuotationTransition(quotation.status as QuotationStatusValue, status);
      } catch (e: any) {
        return res.status(400).json({ message: e.message, code: e.code });
      }
      quotation.status = status;
      quotation.updatedAt = new Date();
      await quotation.save();
      res.json(quotation);
    } catch (error: any) {
      console.error('Quotation status change error:', error?.message || error);
      res.status(500).json({ message: "Failed to change quotation status" });
    }
  });

  app.post("/api/quotations/:id/approve", authenticateUser, requireTenant, requirePermission(PERMISSIONS.APPROVE_QUOTATION), async (req: AuthRequest, res) => {
    try {
      const quotation = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!quotation) return res.status(404).json({ message: "Quotation not found" });
      try {
        assertValidQuotationTransition(quotation.status as QuotationStatusValue, 'approved');
      } catch (e: any) {
        return res.status(400).json({ message: e.message, code: e.code });
      }
      quotation.status = 'approved';
      quotation.updatedAt = new Date();
      await quotation.save();
      res.json(quotation);
    } catch (error: any) {
      console.error('Approve quotation error:', error?.message || error);
      res.status(500).json({ message: "Failed to approve quotation" });
    }
  });

  // Sends the quotation via WhatsApp (text summary) and only flips status
  // -> 'sent' if the send actually succeeded, so a failed send never
  // silently leaves the quotation looking like it went out.
  app.post("/api/quotations/:id/send-whatsapp", authenticateUser, requireTenant, requirePermission(PERMISSIONS.SEND_QUOTATION), async (req: AuthRequest, res) => {
    try {
      const quotation = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!quotation) return res.status(404).json({ message: "Quotation not found" });
      if (quotation.status !== 'sent') {
        try {
          assertValidQuotationTransition(quotation.status as QuotationStatusValue, 'sent');
        } catch (e: any) {
          return res.status(400).json({ message: e.message, code: e.code });
        }
      }

      const result = await sendQuotationMessage({
        tenantId: req.tenantId!,
        quotationId: quotation._id.toString(),
        actor: { userId: req.userId!, role: req.user?.role || 'client' },
        force: !!req.body?.force,
      });
      if (!result.ok) {
        return res.status(result.code === 'ALREADY_SENT' ? 409 : 400).json(result);
      }

      if (quotation.status !== 'sent') {
        quotation.status = 'sent';
        quotation.sentAt = new Date();
        quotation.updatedAt = new Date();
        await quotation.save();
      }
      res.json({ quotation, messageDoc: result.messageDoc });
    } catch (error: any) {
      console.error('Send quotation error:', error?.message || error);
      res.status(500).json({ message: "Failed to send quotation" });
    }
  });

  // Sends the ACTUAL Quotation PDF as a WhatsApp document (with the same
  // Hinglish summary as its caption), closing the gap the text-only route
  // above always documented as a deferred follow-up. PDF generation still
  // happens client-side (the existing, already-tested html2pdf render used
  // for "Download PDF") — no server-side PDF rendering is introduced; the
  // client just uploads the resulting bytes here instead of only
  // downloading them. Memory storage only (never touches disk) since the
  // file is used once and discarded.
  app.post(
    "/api/quotations/:id/send-whatsapp-pdf",
    authenticateUser, requireTenant, requirePermission(PERMISSIONS.SEND_QUOTATION),
    multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') cb(null, true);
      else cb(new Error('Only PDF files are accepted.'));
    } }).single('pdf'),
    async (req: AuthRequest, res) => {
      try {
        const quotation = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!quotation) return res.status(404).json({ message: "Quotation not found" });
        if (!req.file) return res.status(400).json({ message: "A PDF file is required (field name: pdf)." });
        if (quotation.status !== 'sent') {
          try {
            assertValidQuotationTransition(quotation.status as QuotationStatusValue, 'sent');
          } catch (e: any) {
            return res.status(400).json({ message: e.message, code: e.code });
          }
        }

        const result = await sendQuotationMessage({
          tenantId: req.tenantId!,
          quotationId: quotation._id.toString(),
          actor: { userId: req.userId!, role: req.user?.role || 'client' },
          force: !!req.body?.force,
          pdf: { buffer: req.file.buffer, fileName: `Quotation_${quotation.quotationNumber || quotation._id}.pdf` },
        });
        if (!result.ok) {
          return res.status(result.code === 'ALREADY_SENT' ? 409 : 400).json(result);
        }

        if (quotation.status !== 'sent') {
          quotation.status = 'sent';
          quotation.sentAt = new Date();
          quotation.updatedAt = new Date();
          await quotation.save();
        }
        res.json({ quotation, messageDoc: result.messageDoc });
      } catch (error: any) {
        console.error('Send quotation PDF error:', error?.message || error);
        res.status(500).json({ message: error?.message?.includes('PDF') ? error.message : "Failed to send quotation PDF" });
      }
    },
  );

  // Creates a new draft version copying the current options (spec §19:
  // "Sent quotation revision creates a new version"); the original is
  // marked superseded and stays visible/immutable for history.
  app.post("/api/quotations/:id/revise", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_QUOTATION_DRAFT), async (req: AuthRequest, res) => {
    try {
      const original = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!original) return res.status(404).json({ message: "Quotation not found" });
      if (original.status === 'draft' || original.status === 'under_review') {
        return res.status(400).json({ message: "A draft or under-review quotation can be edited directly instead of revised." });
      }
      if (original.status === 'converted') {
        return res.status(400).json({ message: "Cannot revise a quotation that has already been converted to a booking." });
      }

      const quotationNumber = await nextQuotationNumber(req.tenantId!);
      const revision = await Quotation.create({
        tenantId: req.tenantId,
        quotationNumber,
        leadId: original.leadId,
        status: 'draft',
        version: (original.version || 1) + 1,
        parentQuotationId: original._id,
        options: original.options,
        validTill: original.validTill,
        paymentTerms: original.paymentTerms,
        termsAndConditions: original.termsAndConditions,
        cancellationTerms: original.cancellationTerms,
        createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
      });

      original.status = 'superseded';
      original.updatedAt = new Date();
      await original.save();

      res.status(201).json(revision);
    } catch (error: any) {
      console.error('Revise quotation error:', error?.message || error);
      res.status(500).json({ message: "Failed to revise quotation" });
    }
  });

  // Accepting a quotation also moves its Lead to customer_confirmed (spec
  // lifecycle: "Quotation Accepted -> Customer Confirmed"), and becomes
  // immutable from this point (spec §19).
  app.post("/api/quotations/:id/accept", authenticateUser, requireTenant, requirePermission(PERMISSIONS.ACCEPT_QUOTATION), async (req: AuthRequest, res) => {
    try {
      const quotation = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!quotation) return res.status(404).json({ message: "Quotation not found" });
      const acceptedOptionNumber = Number(req.body?.acceptedOptionNumber);
      if (!acceptedOptionNumber || !quotation.options.some((o: any) => o.optionNumber === acceptedOptionNumber)) {
        return res.status(400).json({ message: "acceptedOptionNumber must match one of this quotation's options." });
      }
      try {
        assertValidQuotationTransition(quotation.status as QuotationStatusValue, 'accepted');
      } catch (e: any) {
        return res.status(400).json({ message: e.message, code: e.code });
      }
      quotation.status = 'accepted';
      quotation.acceptedOptionNumber = acceptedOptionNumber;
      quotation.acceptedAt = new Date();
      quotation.updatedAt = new Date();
      await quotation.save();

      const lead = await Lead.findOne({ _id: quotation.leadId, tenantId: req.tenantId });
      if (lead && !['converted_to_customer', 'converted_to_booking', 'lost', 'cancelled'].includes(lead.status)) {
        try {
          assertValidLeadTransition(lead.status as LeadStatusValue, 'customer_confirmed');
          lead.status = 'customer_confirmed';
          lead.updatedAt = new Date();
          await lead.save();
        } catch {
          // Lead already past this point in its own pipeline — accepting
          // the quotation itself still succeeds; the lead status is a
          // best-effort convenience sync, not a hard dependency.
        }
      }

      res.json(quotation);
    } catch (error: any) {
      console.error('Accept quotation error:', error?.message || error);
      res.status(500).json({ message: "Failed to accept quotation" });
    }
  });

  // ── Lead follow-ups (additive) ──
  // Separate from the existing after-sales CustomerFollowUp — see the
  // LeadFollowUp model comment in models/index.ts for why.

  app.get("/api/leads/:leadId/followups", authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_FOLLOWUPS), async (req: AuthRequest, res) => {
    try {
      const rows = await LeadFollowUp.find({ tenantId: req.tenantId, leadId: req.params.leadId }).sort({ scheduledAt: -1 });
      res.json(rows);
    } catch (error: any) {
      console.error('List lead follow-ups error:', error?.message || error);
      res.status(500).json({ message: "Failed to load follow-ups" });
    }
  });

  app.post("/api/leads/:leadId/followups", authenticateUser, requireTenant, requirePermission(PERMISSIONS.CREATE_FOLLOWUP), async (req: AuthRequest, res) => {
    try {
      const lead = await Lead.findOne({ _id: req.params.leadId, tenantId: req.tenantId });
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      if (!req.body?.type?.trim()) return res.status(400).json({ message: "Follow-up type is required." });
      if (!req.body?.scheduledAt) return res.status(400).json({ message: "scheduledAt is required." });

      const followUp = await LeadFollowUp.create({
        tenantId: req.tenantId,
        leadId: lead._id,
        type: req.body.type.trim(),
        scheduledAt: req.body.scheduledAt,
        assignedTo: req.body.assignedTo,
        priority: req.body.priority || 'medium',
        purpose: req.body.purpose,
        previousDiscussion: req.body.previousDiscussion,
        outcome: 'pending',
        createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      res.status(201).json(followUp);
    } catch (error: any) {
      console.error('Create lead follow-up error:', error?.message || error);
      res.status(500).json({ message: "Failed to create follow-up" });
    }
  });

  // Tenant-wide follow-up list for a dashboard-style view: Due Today,
  // Overdue, Upcoming, or High-Priority (spec §22). Only 'pending' rows
  // are ever "due" — a completed row (any other outcome) never appears
  // here regardless of its scheduledAt, since it isn't waiting on anyone.
  app.get("/api/followups", authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_FOLLOWUPS), async (req: AuthRequest, res) => {
    try {
      const query: Record<string, any> = { tenantId: req.tenantId, outcome: 'pending' };
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

      // Mutually exclusive by actual urgency, not just calendar date — a
      // follow-up scheduled for 9am that's still pending at 2pm the same
      // day is genuinely overdue, not "due later today" (same distinction
      // liveOperations.ts already makes between startDue/startDelayed).
      const due = (req.query.due as string) || 'all';
      if (due === 'today') query.scheduledAt = { $gte: now, $lt: todayEnd };
      else if (due === 'overdue') query.scheduledAt = { $lt: now };
      else if (due === 'upcoming') query.scheduledAt = { $gte: todayEnd };
      if (req.query.priority) query.priority = req.query.priority;

      const rows = await LeadFollowUp.find(query)
        .populate({ path: 'leadId', select: 'leadNumber status inquiryId', populate: { path: 'inquiryId', select: 'inquiryNumber customerName primaryMobile' } })
        .sort({ scheduledAt: 1 })
        .limit(200);
      res.json(rows);
    } catch (error: any) {
      console.error('List follow-ups error:', error?.message || error);
      res.status(500).json({ message: "Failed to load follow-ups" });
    }
  });

  // Completing a follow-up can optionally chain a new one (nextFollowUpAt
  // + type) — a real convenience for "finish this call, schedule the next
  // one in the same action" rather than a required two-step flow.
  app.post("/api/followups/:followupId/complete", authenticateUser, requireTenant, requirePermission(PERMISSIONS.COMPLETE_FOLLOWUP), async (req: AuthRequest, res) => {
    try {
      const followUp = await LeadFollowUp.findOne({ _id: req.params.followupId, tenantId: req.tenantId });
      if (!followUp) return res.status(404).json({ message: "Follow-up not found" });
      if (followUp.outcome !== 'pending') {
        return res.status(400).json({ message: "This follow-up has already been completed." });
      }
      if (!req.body?.outcome || req.body.outcome === 'pending') {
        return res.status(400).json({ message: "A real outcome is required to complete a follow-up." });
      }

      followUp.outcome = req.body.outcome;
      if (req.body.customerResponse !== undefined) followUp.customerResponse = req.body.customerResponse;
      if (req.body.internalNote !== undefined) followUp.internalNote = req.body.internalNote;
      followUp.completedAt = new Date();
      followUp.completedBy = req.userId!;

      let nextFollowUp = null;
      if (req.body.nextFollowUpAt) {
        followUp.nextFollowUpAt = req.body.nextFollowUpAt;
        nextFollowUp = await LeadFollowUp.create({
          tenantId: req.tenantId,
          leadId: followUp.leadId,
          type: req.body.nextFollowUpType || followUp.type,
          scheduledAt: req.body.nextFollowUpAt,
          assignedTo: followUp.assignedTo,
          priority: followUp.priority,
          previousDiscussion: req.body.customerResponse || followUp.customerResponse,
          outcome: 'pending',
          createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
        });
      }
      await followUp.save();

      res.json({ followUp, nextFollowUp });
    } catch (error: any) {
      console.error('Complete follow-up error:', error?.message || error);
      res.status(500).json({ message: "Failed to complete follow-up" });
    }
  });

  // One-click Lead -> Customer conversion (spec §23). Reuses
  // findOrCreateCustomer() — the exact same dedupe-by-phone logic already
  // used by booking creation — rather than a second, divergent
  // duplicate-detection implementation. Neither the Inquiry nor the Lead
  // is ever deleted; this only adds a link.
  app.post("/api/leads/:id/convert-to-customer", authenticateUser, requireTenant, requirePermission(PERMISSIONS.CONVERT_LEAD_TO_CUSTOMER), async (req: AuthRequest, res) => {
    try {
      const lead = await Lead.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      if (lead.linkedCustomerId) {
        const existingCustomer = await Customer.findOne({ _id: lead.linkedCustomerId, tenantId: req.tenantId });
        return res.status(400).json({ message: "This lead is already linked to a customer.", code: 'ALREADY_CONVERTED', customer: existingCustomer });
      }

      const inquiry = await Inquiry.findOne({ _id: lead.inquiryId, tenantId: req.tenantId });
      if (!inquiry) return res.status(404).json({ message: "Linked inquiry not found" });

      let result;
      try {
        result = await findOrCreateCustomer(
          req.tenantId!,
          { name: inquiry.customerName, phone: inquiry.primaryMobile, email: inquiry.email },
          { userId: req.userId!, role: req.user?.role || 'client' },
        );
      } catch (e: any) {
        if (e.code === 'INVALID_PHONE') return res.status(400).json({ message: e.message, code: e.code });
        throw e;
      }

      lead.linkedCustomerId = result.customer._id;
      lead.convertedToCustomerAt = new Date();
      if (!inquiry.linkedCustomerId) inquiry.linkedCustomerId = result.customer._id;
      try {
        assertValidLeadTransition(lead.status as LeadStatusValue, 'converted_to_customer');
        lead.status = 'converted_to_customer';
      } catch {
        // Lead's own pipeline state doesn't allow this move yet (e.g. still
        // 'new') — the customer link itself still succeeds; see the same
        // best-effort-sync note on the quotation accept route above.
      }
      lead.updatedAt = new Date();
      await lead.save();
      await inquiry.save();

      res.json({ customer: result.customer, wasCreated: result.wasCreated, lead });
    } catch (error: any) {
      console.error('Convert lead to customer error:', error?.message || error);
      res.status(500).json({ message: "Failed to convert lead to customer" });
    }
  });

  // Completes the Lead -> Booking conversion (spec §24) after the actual
  // Booking has already been created through the existing, unmodified
  // POST /api/bookings endpoint (with its own full availability
  // validation) — this route only records the link, it never creates or
  // touches a Booking document itself, so there is exactly one place a
  // real booking gets created in this whole codebase.
  app.post("/api/leads/:leadId/link-booking", authenticateUser, requireTenant, requirePermission(PERMISSIONS.CONVERT_LEAD_TO_BOOKING), async (req: AuthRequest, res) => {
    try {
      const lead = await Lead.findOne({ _id: req.params.leadId, tenantId: req.tenantId });
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      if (!req.body?.bookingId) return res.status(400).json({ message: "bookingId is required." });

      const booking = await Booking.findOne({ _id: req.body.bookingId, tenantId: req.tenantId });
      if (!booking) return res.status(404).json({ message: "Booking not found for this tenant." });

      lead.linkedBookingId = booking._id;
      lead.convertedToBookingAt = new Date();
      try {
        assertValidLeadTransition(lead.status as LeadStatusValue, 'converted_to_booking');
        lead.status = 'converted_to_booking';
      } catch {
        // Best-effort sync, same pattern as the quotation-accept and
        // convert-to-customer routes above — the link itself still succeeds.
      }
      lead.updatedAt = new Date();
      await lead.save();

      res.json(lead);
    } catch (error: any) {
      console.error('Link lead to booking error:', error?.message || error);
      res.status(500).json({ message: "Failed to link booking to lead" });
    }
  });

  // Customer 360: one consolidated financial ledger across every booking.
  // Payment rows remain immutable; this endpoint only assembles them for
  // the customer dashboard with their human booking number populated.
  app.get("/api/customers/:id/payments", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      const bookingIds = await Booking.find({ customerId: customer._id, tenantId: req.tenantId }).distinct('_id');
      const transactions = await PaymentTransaction.find({
        tenantId: req.tenantId,
        bookingId: { $in: bookingIds },
      })
        .populate('bookingId', 'bookingId totalAmount pickupDate')
        .sort({ receivedAt: -1, createdAt: -1 });
      res.json(transactions);
    } catch (error: any) {
      console.error('Customer payment ledger error:', error?.message || error);
      res.status(500).json({ message: "Failed to fetch customer payment ledger" });
    }
  });

  app.get("/api/customers/:id/financial-summary", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const summary = await buildCustomerFinancialSummary(req.tenantId!, req.params.id);
      if (!summary) return res.status(404).json({ message: "Customer not found" });
      res.json(summary);
    } catch (error: any) {
      console.error('Customer financial summary error:', error?.message || error);
      res.status(500).json({ message: "Failed to compute customer financial summary" });
    }
  });

  app.get("/api/customers/:id/payments/:paymentId/receipt", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.paymentId)) {
        return res.status(400).json({ message: "Invalid customer or payment ID" });
      }
      const receipt = await buildPaymentReceipt(req.tenantId!, req.params.id, req.params.paymentId);
      if (!receipt) return res.status(404).json({ message: "Payment receipt not found for this customer" });
      res.json(receipt);
    } catch (error: any) {
      console.error('Payment receipt error:', error?.message || error);
      res.status(500).json({ message: "Failed to create payment receipt" });
    }
  });

  // Invoice Settings — tenant-specific company/tax/bank/numbering config
  // used to render invoice PDFs and WhatsApp templates. GET always returns
  // a full object (merged with defaults) even if the tenant never saved
  // one; PATCH is the only thing that persists a row (upsert). Changing
  // these only affects invoices generated AFTER the change — every
  // existing finalized invoice already carries its own immutable
  // businessSnapshot (see invoiceService.ts's loadContext).
  app.get("/api/invoice-settings", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const settings = await getInvoiceSettings(req.tenantId!);
      res.json(settings);
    } catch (error: any) {
      console.error('Get invoice settings error:', error?.message || error);
      res.status(500).json({ message: "Failed to fetch invoice settings" });
    }
  });

  app.patch("/api/invoice-settings", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_INVOICE_SETTINGS), async (req: AuthRequest, res) => {
    try {
      const settings = await upsertInvoiceSettings(req.tenantId!, req.body || {}, { userId: req.userId!, role: req.user?.role || 'client' });
      res.json(settings);
    } catch (error: any) {
      console.error('Update invoice settings error:', error?.message || error);
      res.status(500).json({ message: "Failed to update invoice settings" });
    }
  });

  app.get("/api/customers/:id/billing-profiles", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const customer = await Customer.exists({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      const profiles = await CustomerBillingProfile.find({ tenantId: req.tenantId, customerId: req.params.id, isActive: true })
        .sort({ isDefault: -1, createdAt: 1 });
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch billing profiles" });
    }
  });

  const billingProfileFields = [
    'label', 'customerKind', 'billingName', 'companyName', 'gstNumber', 'panNumber', 'billingAddress',
    'billingEmail', 'accountsContact', 'purchaseOrderNumber', 'paymentTerms', 'creditPeriodDays', 'tdsInformation',
  ];

  app.post("/api/customers/:id/billing-profiles", authenticateUser, requireTenant, requirePermission(PERMISSIONS.GENERATE_INVOICE), async (req: AuthRequest, res) => {
    try {
      const customer = await Customer.exists({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      const payload: Record<string, any> = {};
      for (const field of billingProfileFields) if (req.body?.[field] !== undefined) payload[field] = req.body[field];
      if (!payload.label?.trim() || !payload.billingName?.trim()) return res.status(400).json({ message: "Profile label and billing name are required." });
      if (payload.gstNumber) payload.gstNumber = String(payload.gstNumber).trim().toUpperCase();
      if (payload.billingEmail) payload.billingEmail = String(payload.billingEmail).trim().toLowerCase();
      const isFirst = await CustomerBillingProfile.countDocuments({ tenantId: req.tenantId, customerId: req.params.id, isActive: true }) === 0;
      const isDefault = isFirst || req.body?.isDefault === true;
      if (isDefault) await CustomerBillingProfile.updateMany({ tenantId: req.tenantId, customerId: req.params.id }, { $set: { isDefault: false } });
      const profile = await CustomerBillingProfile.create({
        tenantId: req.tenantId, customerId: req.params.id, ...payload, isDefault,
        createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      res.status(201).json(profile);
    } catch (error: any) {
      console.error('Create billing profile error:', error?.message || error);
      res.status(500).json({ message: "Failed to create billing profile" });
    }
  });

  app.put("/api/customers/:id/billing-profiles/:profileId", authenticateUser, requireTenant, requirePermission(PERMISSIONS.GENERATE_INVOICE), async (req: AuthRequest, res) => {
    try {
      const profile = await CustomerBillingProfile.findOne({
        _id: req.params.profileId, tenantId: req.tenantId, customerId: req.params.id, isActive: true,
      });
      if (!profile) return res.status(404).json({ message: "Billing profile not found" });
      for (const field of billingProfileFields) if (req.body?.[field] !== undefined) (profile as any)[field] = req.body[field];
      if (!profile.label?.trim() || !profile.billingName?.trim()) return res.status(400).json({ message: "Profile label and billing name are required." });
      if (profile.gstNumber) profile.gstNumber = profile.gstNumber.trim().toUpperCase();
      if (profile.billingEmail) profile.billingEmail = profile.billingEmail.trim().toLowerCase();
      if (req.body?.isDefault === true && !profile.isDefault) {
        await CustomerBillingProfile.updateMany({ tenantId: req.tenantId, customerId: req.params.id }, { $set: { isDefault: false } });
        profile.isDefault = true;
      }
      profile.updatedBy = { userId: req.userId!, role: req.user?.role || 'client' };
      profile.updatedAt = new Date();
      await profile.save();
      res.json(profile);
    } catch (error: any) {
      console.error('Update billing profile error:', error?.message || error);
      res.status(500).json({ message: "Failed to update billing profile" });
    }
  });

  app.post("/api/customers/:id/billing-profiles/:profileId/set-default", authenticateUser, requireTenant, requirePermission(PERMISSIONS.GENERATE_INVOICE), async (req: AuthRequest, res) => {
    try {
      const profile = await CustomerBillingProfile.findOne({ _id: req.params.profileId, tenantId: req.tenantId, customerId: req.params.id, isActive: true });
      if (!profile) return res.status(404).json({ message: "Billing profile not found" });
      await CustomerBillingProfile.updateMany({ tenantId: req.tenantId, customerId: req.params.id }, { $set: { isDefault: false } });
      profile.isDefault = true;
      profile.updatedBy = { userId: req.userId!, role: req.user?.role || 'client' };
      profile.updatedAt = new Date();
      await profile.save();
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to set default billing profile" });
    }
  });

  app.get("/api/customers/:id/invoices", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const invoices = await Invoice.find({ tenantId: req.tenantId, customerId: req.params.id })
        .populate('bookingId', 'bookingId pickupDate').sort({ createdAt: -1 });
      res.json(await addCurrentInvoiceSettlements(invoices));
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post("/api/customers/:id/invoices/preview", authenticateUser, requireTenant, requirePermission(PERMISSIONS.GENERATE_INVOICE), async (req: AuthRequest, res) => {
    try {
      const preview = await previewInvoice({ tenantId: req.tenantId!, customerId: req.params.id, ...req.body });
      res.json(preview);
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.message || "Failed to preview invoice" });
    }
  });

  app.post("/api/customers/:id/invoices", authenticateUser, requireTenant, requirePermission(PERMISSIONS.GENERATE_INVOICE), async (req: AuthRequest, res) => {
    try {
      const result = await createInvoiceDraft({
        tenantId: req.tenantId!, customerId: req.params.id, ...req.body,
        actor: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      res.status(result.alreadyExists ? 200 : 201).json(result);
    } catch (error: any) {
      console.error('Create invoice error:', error?.message || error);
      res.status(error?.status || 500).json({ message: error?.message || "Failed to create invoice" });
    }
  });

  app.get("/api/invoices/:invoiceId", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const invoice = await Invoice.findOne({ _id: req.params.invoiceId, tenantId: req.tenantId });
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      res.json((await addCurrentInvoiceSettlements([invoice]))[0]);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.put("/api/invoices/:invoiceId", authenticateUser, requireTenant, requirePermission(PERMISSIONS.GENERATE_INVOICE), async (req: AuthRequest, res) => {
    try {
      const invoice = await updateInvoiceDraft(req.tenantId!, req.params.invoiceId, req.body, { userId: req.userId!, role: req.user?.role || 'client' });
      res.json(invoice);
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.message || "Failed to update invoice" });
    }
  });

  app.post("/api/invoices/:invoiceId/finalize", authenticateUser, requireTenant, requirePermission(PERMISSIONS.GENERATE_INVOICE), async (req: AuthRequest, res) => {
    try {
      const invoice = await finalizeInvoice(req.tenantId!, req.params.invoiceId, { userId: req.userId!, role: req.user?.role || 'client' });
      res.json(invoice);
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.message || "Failed to finalize invoice" });
    }
  });

  app.post("/api/invoices/:invoiceId/revise", authenticateUser, requireTenant, requirePermission(PERMISSIONS.GENERATE_INVOICE), async (req: AuthRequest, res) => {
    try {
      const invoice = await reviseInvoice(req.tenantId!, req.params.invoiceId, { userId: req.userId!, role: req.user?.role || 'client' });
      res.status(201).json(invoice);
    } catch (error: any) {
      console.error('Revise invoice error:', error?.message || error);
      res.status(error?.status || 500).json({ message: error?.message || "Failed to revise invoice" });
    }
  });

  app.post("/api/invoices/:invoiceId/adjustment-note", authenticateUser, requireTenant, requirePermission(PERMISSIONS.GENERATE_INVOICE), async (req: AuthRequest, res) => {
    try {
      const invoice = await createAdjustmentNote({
        tenantId: req.tenantId!, invoiceId: req.params.invoiceId, noteType: req.body?.noteType,
        amount: req.body?.amount, reason: req.body?.reason,
        actor: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      res.status(201).json(invoice);
    } catch (error: any) {
      console.error('Create invoice adjustment note error:', error?.message || error);
      res.status(error?.status || 500).json({ message: error?.message || "Failed to create adjustment note" });
    }
  });

  app.get("/api/customers/:id/messages", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      const phone = normalizeIndianPhone(customer.primaryMobile);
      const messages = await WhatsAppMessage.find({
        tenantId: req.tenantId,
        recipientType: 'customer',
        $or: [
          { customerId: customer._id },
          ...(phone ? [{ recipientPhone: phone }] : []),
        ],
      }).sort({ createdAt: -1 }).limit(25);
      res.json(messages);
    } catch (error: any) {
      console.error('Customer message history error:', error?.message || error);
      res.status(500).json({ message: "Failed to fetch customer message history" });
    }
  });

  async function loadCustomerMessageContext(customerId: string, tenantId: string, preferredBookingId?: string) {
    const customer = await Customer.findOne({ _id: customerId, tenantId });
    if (!customer) return null;
    const bookings = await Booking.find({ customerId: customer._id, tenantId })
      .populate('vehicleId')
      .populate('driverId')
      .sort({ pickupDate: -1, createdAt: -1 });
    const tenant = await storage.getTenant(tenantId);
    if (!tenant) return null;
    const templates = buildCustomerTemplatePreviews({ customer, bookings, tenant, preferredBookingId });
    return { customer, bookings, tenant, templates };
  }

  app.get("/api/customers/:id/whatsapp/templates", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const context = await loadCustomerMessageContext(
        req.params.id,
        req.tenantId!,
        typeof req.query.bookingId === 'string' ? req.query.bookingId : undefined,
      );
      if (!context) return res.status(404).json({ message: "Customer or tenant not found" });
      const phone = normalizeIndianPhone(context.customer.primaryMobile);
      const whatsappAllowed = context.customer.status !== 'do_not_contact'
        && context.customer.consent?.whatsapp !== false
        && !!phone;
      const templates = context.templates.map((template) => whatsappAllowed ? template : {
        ...template,
        enabled: false,
        disabledReason: !phone ? 'Customer phone number is invalid' : 'Customer has opted out of WhatsApp',
      });
      res.json({ recipientPhone: phone, templates });
    } catch (error: any) {
      console.error('Customer WhatsApp templates error:', error?.message || error);
      res.status(500).json({ message: "Failed to build customer message templates" });
    }
  });

  app.post("/api/customers/:id/whatsapp/send", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { templateKey, bookingId, requestId } = req.body || {};
      if (!CUSTOMER_TEMPLATE_KEYS.includes(templateKey as CustomerTemplateKey)) {
        return res.status(400).json({ message: "Invalid customer message template" });
      }
      if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) {
        return res.status(400).json({ message: "A valid requestId is required" });
      }
      const context = await loadCustomerMessageContext(req.params.id, req.tenantId!, bookingId);
      if (!context) return res.status(404).json({ message: "Customer or tenant not found" });
      if (context.customer.status === 'do_not_contact' || context.customer.consent?.whatsapp === false) {
        return res.status(400).json({ message: "Customer has opted out of WhatsApp messages" });
      }
      const recipientPhone = normalizeIndianPhone(context.customer.primaryMobile);
      if (!recipientPhone) return res.status(400).json({ message: "Customer phone number is invalid" });

      const template = context.templates.find((row) => row.key === templateKey);
      if (!template || !template.enabled) {
        return res.status(400).json({ message: template?.disabledReason || "This template is not available" });
      }
      const idempotencyKey = `${req.tenantId}_${req.params.id}_customer_template_${requestId}`;
      const existing = await WhatsAppMessage.findOne({ idempotencyKey, status: { $in: ['queued', 'sent'] } });
      if (existing) return res.json({ message: "Message already processed", alreadySent: true, messageDoc: existing });

      const messageDoc = await WhatsAppMessage.create({
        tenantId: req.tenantId,
        customerId: context.customer._id,
        bookingId: template.bookingId || undefined,
        recipientType: 'customer',
        recipientPhone,
        messageType: `customer_${template.key}`,
        content: template.content,
        provider: whatsappProvider.kind,
        status: 'queued',
        attemptCount: 0,
        createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
        idempotencyKey,
      });

      const result = await whatsappProvider.sendText(req.tenantId!, recipientPhone, template.content);
      messageDoc.attemptCount = 1;
      messageDoc.status = result.status === 'sent' ? 'sent' : 'failed';
      messageDoc.providerMessageId = result.providerMessageId || undefined;
      messageDoc.error = result.error || undefined;
      if (result.status === 'sent') messageDoc.sentAt = new Date();
      await messageDoc.save();
      if (result.status !== 'sent') {
        return res.status(502).json({ message: result.error || "WhatsApp message failed", messageDoc });
      }
      res.json({ message: "WhatsApp message sent", messageDoc });
    } catch (error: any) {
      if (error?.code === 11000) {
        return res.status(409).json({ message: "This message request is already being processed" });
      }
      console.error('Customer WhatsApp send error:', error?.message || error);
      res.status(500).json({ message: "Failed to send customer WhatsApp message" });
    }
  });

  app.put("/api/customers/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const editableFields = [
        'name', 'primaryMobile', 'alternateMobile', 'whatsappNumber', 'email', 'dateOfBirth', 'anniversary',
        'address', 'city', 'state', 'pinCode', 'companyName', 'customerType', 'gstNumber', 'emergencyContact',
        'preferredLanguage', 'photoUrl', 'billing', 'preferences',
      ];
      const update: Record<string, any> = {};
      for (const key of editableFields) if (req.body?.[key] !== undefined) update[key] = req.body[key];

      for (const key of ['primaryMobile', 'alternateMobile', 'whatsappNumber']) {
        if (!update[key]) continue;
        const normalized = normalizeIndianPhone(update[key]);
        if (!normalized) return res.status(400).json({ message: `Invalid phone number: "${update[key]}"` });
        update[key] = normalized;
      }
      if (update.email) update.email = String(update.email).trim().toLowerCase();
      if (update.gstNumber) update.gstNumber = String(update.gstNumber).trim().toUpperCase();

      const duplicateChecks: Record<string, any>[] = [];
      for (const key of ['primaryMobile', 'alternateMobile', 'whatsappNumber']) {
        if (!update[key]) continue;
        duplicateChecks.push(
          { primaryMobile: update[key] }, { alternateMobile: update[key] }, { whatsappNumber: update[key] }, { phoneAliases: update[key] },
        );
      }
      if (update.email) duplicateChecks.push({ email: update.email }, { emailAliases: update.email });
      if (update.gstNumber) duplicateChecks.push({ gstNumber: update.gstNumber }, { gstAliases: update.gstNumber });
      if (duplicateChecks.length && await Customer.exists({
        _id: { $ne: req.params.id }, tenantId: req.tenantId, isDeleted: { $ne: true }, $or: duplicateChecks,
      })) {
        return res.status(409).json({ message: "Another customer already uses this mobile, email, or GST number." });
      }
      update.updatedBy = { userId: req.userId!, role: req.user?.role || 'client' };
      update.updatedAt = new Date();

      const customer = await Customer.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.tenantId },
        update,
        { new: true }
      );
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      res.json(customer);
    } catch (error: any) {
      console.error('Update customer error:', error?.message || error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  // Reward ledger — balance is always the sum of these rows (see
  // rewardService.ts), never a bare editable number.
  app.get("/api/customers/:id/rewards", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      const transactions = await RewardTransaction.find({ tenantId: req.tenantId, customerId: req.params.id }).sort({ createdAt: -1 });
      const rule = await getRewardRule(req.tenantId!);
      res.json({ balance: customer.rewardPointsBalance, tier: customer.loyaltyTier, transactions, rule });
    } catch (error: any) {
      console.error('Reward ledger error:', error?.message || error);
      res.status(500).json({ message: "Failed to fetch reward ledger" });
    }
  });

  // Timeline — assembled on read from bookings/payments/rewards/tags/
  // feedback/complaints/follow-ups (see services/timelineService.ts).
  app.get("/api/customers/:id/timeline", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const events = await computeCustomerTimeline(req.tenantId!, req.params.id);
      res.json(events);
    } catch (error: any) {
      console.error('Timeline error:', error?.message || error);
      res.status(500).json({ message: "Failed to compute customer timeline" });
    }
  });

  // Campaigns/Offers — targeted WhatsApp outreach to a segment or tag.
  // Editable/deletable only while still a draft; sending is a one-way,
  // idempotency-guarded action (see services/campaignService.ts) that
  // enforces consent.promotional + do_not_contact at send time regardless
  // of what the target filter matched.
  app.get("/api/campaigns", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const campaigns = await Campaign.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
      res.json(campaigns);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const campaign = await Campaign.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      res.json(campaign);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { name, description, offerType, offerValue, targetType, targetKey, messageTemplate, validFrom, validTo } = req.body || {};
      if (!name || !name.trim()) return res.status(400).json({ message: "Campaign name is required" });
      if (!['segment', 'tag'].includes(targetType)) return res.status(400).json({ message: "targetType must be 'segment' or 'tag'" });
      if (!targetKey || !String(targetKey).trim()) return res.status(400).json({ message: "targetKey is required" });
      if (!messageTemplate || !messageTemplate.trim()) return res.status(400).json({ message: "messageTemplate is required" });
      if (targetType === 'segment') await getSegmentFilter(req.tenantId!, String(targetKey));

      const campaign = await Campaign.create({
        tenantId: req.tenantId, name: name.trim(), description,
        offerType: offerType || 'announcement', offerValue,
        targetType, targetKey, channel: 'whatsapp', messageTemplate,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validTo: validTo ? new Date(validTo) : undefined,
        status: 'draft',
        createdBy: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      res.status(201).json(campaign);
    } catch (error: any) {
      console.error('Create campaign error:', error?.message || error);
      res.status(error?.status || 500).json({ message: error?.status ? error.message : "Failed to create campaign" });
    }
  });

  app.put("/api/campaigns/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const campaign = await Campaign.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (campaign.status !== 'draft') return res.status(400).json({ message: `Cannot edit a campaign that is already ${campaign.status}.` });

      const { name, description, offerType, offerValue, targetType, targetKey, messageTemplate, validFrom, validTo } = req.body || {};
      const nextTargetType = targetType === undefined ? campaign.targetType : targetType;
      const nextTargetKey = targetKey === undefined ? campaign.targetKey : targetKey;
      if (!['segment', 'tag'].includes(nextTargetType)) return res.status(400).json({ message: "targetType must be 'segment' or 'tag'" });
      if (!nextTargetKey || !String(nextTargetKey).trim()) return res.status(400).json({ message: "targetKey is required" });
      if (nextTargetType === 'segment') await getSegmentFilter(req.tenantId!, String(nextTargetKey));
      if (name !== undefined) campaign.name = name;
      if (description !== undefined) campaign.description = description;
      if (offerType !== undefined) campaign.offerType = offerType;
      if (offerValue !== undefined) campaign.offerValue = offerValue;
      if (targetType !== undefined) campaign.targetType = targetType;
      if (targetKey !== undefined) campaign.targetKey = targetKey;
      if (messageTemplate !== undefined) campaign.messageTemplate = messageTemplate;
      if (validFrom !== undefined) campaign.validFrom = validFrom ? new Date(validFrom) : undefined;
      if (validTo !== undefined) campaign.validTo = validTo ? new Date(validTo) : undefined;
      await campaign.save();
      res.json(campaign);
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.status ? error.message : "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const campaign = await Campaign.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (campaign.status !== 'draft') return res.status(400).json({ message: `Cannot delete a campaign that is already ${campaign.status}.` });
      await Campaign.deleteOne({ _id: campaign._id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  app.get("/api/campaigns/:id/preview", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const campaign = await Campaign.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      const preview = await previewCampaign(req.tenantId!, campaign.targetType, campaign.targetKey);
      res.json(preview);
    } catch (error: any) {
      console.error('Campaign preview error:', error?.message || error);
      res.status(error?.status || 500).json({ message: error?.status ? error.message : "Failed to preview campaign" });
    }
  });

  app.post("/api/campaigns/:id/send", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_CAMPAIGNS), async (req: AuthRequest, res) => {
    try {
      const campaign = await sendCampaign(req.params.id, req.tenantId!);
      res.json(campaign);
    } catch (error: any) {
      console.error('Campaign send error:', error?.message || error);
      res.status(400).json({ message: error?.message || "Failed to send campaign" });
    }
  });

  app.get("/api/campaigns/:id/recipients", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const campaign = await Campaign.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      const recipients = await CampaignRecipient.find({ campaignId: campaign._id, tenantId: req.tenantId })
        .populate('customerId', 'name primaryMobile')
        .sort({ createdAt: -1 });
      res.json(recipients);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch campaign recipients" });
    }
  });

  // Manual credit/debit — e.g. service-recovery compensation, referral
  // bonus not tied to a booking. Scoped to admins/owners since it directly
  // creates value with no booking behind it, same reasoning as payment
  // reversal and driver-conflict override.
  app.post("/api/customers/:id/rewards/adjust", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'client')) {
        return res.status(403).json({ message: "Only admins or the account owner can manually adjust reward points." });
      }
      const { points, reason } = req.body || {};
      if (!points || typeof points !== 'number' || points === 0) {
        return res.status(400).json({ message: "A non-zero points value is required." });
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "A reason is required for a manual adjustment." });
      }
      const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const tx = await adjustRewardPoints(
        req.tenantId!, req.params.id, points, reason.trim(),
        { userId: req.userId!, role: req.user?.role || 'client' },
      );
      res.json({ transaction: tx, balance: tx.balanceAfter });
    } catch (error: any) {
      console.error('Reward adjustment error:', error?.message || error);
      res.status(500).json({ message: "Failed to adjust reward points" });
    }
  });

  // Tenant-configurable reward rules (spec: "Do not hard-code these
  // values"). GET always returns something usable (defaults if the
  // tenant hasn't customized anything yet); PUT upserts the tenant's own
  // override document.
  app.get("/api/reward-rules", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const rule = await getRewardRule(req.tenantId!);
      res.json(rule);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch reward rule" });
    }
  });

  app.put("/api/reward-rules", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'client')) {
        return res.status(403).json({ message: "Only admins or the account owner can configure reward rules." });
      }
      const update = { ...req.body };
      delete update.tenantId;
      update.updatedBy = { userId: req.userId!, role: req.user?.role || 'client' };
      update.updatedAt = new Date();

      const rule = await RewardRule.findOneAndUpdate(
        { tenantId: req.tenantId },
        { $set: update, $setOnInsert: { tenantId: req.tenantId, createdBy: { userId: req.userId!, role: req.user?.role || 'client' } } },
        { new: true, upsert: true }
      );
      res.json(rule);
    } catch (error: any) {
      console.error('Update reward rule error:', error?.message || error);
      res.status(500).json({ message: "Failed to update reward rule" });
    }
  });

  // The single sanctioned way to change a booking's status. Every status
  // mutation (cancel, complete, assign, dispatch, ...) goes through this
  // so the state machine's transition rules are always enforced.
  app.post("/api/bookings/:id/status", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const { status, reason, override } = req.body;

      if (!status || typeof status !== 'string' || !isValidStatus(status)) {
        return res.status(400).json({ message: "A valid status is required" });
      }

      if (override && (!req.user || (req.user.role !== 'admin' && req.user.role !== 'client'))) {
        return res.status(403).json({ message: "Only admins or the account owner can override an assignment check." });
      }

      const booking = await transitionBooking(
        id,
        scopeTenant(req),
        status,
        { userId: req.userId!, role: req.user?.role || 'client' },
        { reason, override: !!override }
      );

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // A status change (completed, cancelled, closed, etc.) directly
      // affects the linked customer's booking counts, spend,
      // repeat/frequent classification, reward points, and loyalty tier.
      // Awaited (not fire-and-forget) because reward crediting needs the
      // freshly-recomputed completedBookings count to detect the repeat-
      // booking-bonus threshold correctly.
      if ((booking as any).customerId) {
        const customerId = (booking as any).customerId.toString();
        const actor = { userId: req.userId!, role: req.user?.role || 'client' };
        try {
          const result = await recomputeCustomerStats(customerId);
          if (['completed', 'closed'].includes(status)) {
            await creditBookingReward(req.tenantId!, customerId, id, booking.totalAmount, actor, result?.completedBookings);
          }
          if (status === 'completed') {
            // Default after-sales task set for every completed trip — a
            // real, working starting point per spec section 15, not
            // configurable per-tenant yet (see Remaining Issues). Guarded
            // against duplicate creation in case this transition fires
            // more than once for the same booking (e.g. a retried request).
            const alreadyCreated = await CustomerFollowUp.exists({ tenantId: req.tenantId, bookingId: id });
            if (!alreadyCreated) {
              const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
              const inAWeek = new Date(); inAWeek.setDate(inAWeek.getDate() + 7);
              await CustomerFollowUp.insertMany([
                { tenantId: req.tenantId, customerId, bookingId: id, taskType: 'Confirm safe trip completion', dueDate: new Date(), priority: 'high', createdBy: actor },
                { tenantId: req.tenantId, customerId, bookingId: id, taskType: 'Ask for driver feedback', dueDate: tomorrow, priority: 'medium', createdBy: actor },
                { tenantId: req.tenantId, customerId, bookingId: id, taskType: 'Offer repeat booking benefit', dueDate: inAWeek, priority: 'low', createdBy: actor },
              ]);
            }
          }
          if (['cancelled', 'no_show'].includes(status)) {
            await reverseBookingReward(req.tenantId!, customerId, id, actor);
          }
          if (result) {
            const tier = await computeLoyaltyTier(req.tenantId!, result);
            if (result.loyaltyTier !== tier.name) {
              result.loyaltyTier = tier.name;
              await result.save();
            }
          }
        } catch (err: any) {
          console.error('Customer stats/reward recompute failed after status change:', err?.message || err);
        }
      }

      const server = (global as any).notificationServer;
      if (server && server.broadcastNotification) {
        server.broadcastNotification(req.tenantId!, {
          type: `booking_${status}`,
          message: `Booking ${booking.bookingId} status changed to ${status}`,
          data: {
            bookingId: booking.bookingId,
            customerName: booking.customerName,
            amount: booking.totalAmount,
            status,
            bookingType: booking.bookingType
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json(booking);
    } catch (error: any) {
      if (error instanceof InvalidTransitionError) {
        return res.status(409).json({ message: error.message, code: error.code });
      }
      console.error('Booking status transition error:', error?.message || error);
      res.status(500).json({ message: "Failed to change booking status" });
    }
  });

  // Dedicated Start Trip action. Sets actualStartDateTime — this is the
  // ONLY place a trip's real start gets recorded; reaching the scheduled
  // pickup time never does this by itself (see liveOperations.ts, which
  // only computes a "Start Due"/"Start Delayed" display label off time).
  app.post("/api/bookings/:id/start", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { startOdometer, override, reason } = req.body || {};
      const booking = await transitionBooking(
        req.params.id,
        scopeTenant(req),
        'trip_started',
        { userId: req.userId!, role: req.user?.role || 'client' },
        { startOdometer, override: !!override, reason }
      );
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      res.json(booking);
    } catch (error: any) {
      if (error instanceof InvalidTransitionError) {
        return res.status(409).json({ message: error.message, code: error.code });
      }
      console.error('Start trip error:', error?.message || error);
      res.status(500).json({ message: "Failed to start trip" });
    }
  });

  // Dedicated Complete Trip action. Sets actualEndDateTime.
  app.post("/api/bookings/:id/complete", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { endOdometer } = req.body || {};
      const booking = await transitionBooking(
        req.params.id,
        scopeTenant(req),
        'completed',
        { userId: req.userId!, role: req.user?.role || 'client' },
        { endOdometer }
      );
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      res.json(booking);
    } catch (error: any) {
      if (error instanceof InvalidTransitionError) {
        return res.status(409).json({ message: error.message, code: error.code });
      }
      console.error('Complete trip error:', error?.message || error);
      res.status(500).json({ message: "Failed to complete trip" });
    }
  });

  // Reschedule — updates the schedule but NEVER overwrites it silently;
  // the previous schedule is pushed onto rescheduleHistory first. Does
  // not touch `status`, so the booking continues its normal lifecycle
  // (a confirmed booking stays confirmed, just with a new pickup time).
  app.post("/api/bookings/:id/reschedule", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { newPickupDate, newPickupTime, newReturnDate, newReturnTime, reason, override } = req.body || {};
      if (!newPickupDate) {
        return res.status(400).json({ message: "newPickupDate is required" });
      }

      const booking: any = await Booking.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (['completed', 'closed', 'cancelled', 'no_show'].includes(booking.status)) {
        return res.status(400).json({ message: `Cannot reschedule a booking that is ${booking.status}.` });
      }

      const newStart = combineDateTime(newPickupDate, newPickupTime ?? booking.pickupTime);
      const effectiveReturnDate = newReturnDate ?? booking.returnDate ?? newPickupDate;
      const effectiveReturnTime = newReturnTime ?? booking.returnTime ?? newPickupTime ?? booking.pickupTime;
      const newEnd = combineDateTime(effectiveReturnDate, effectiveReturnTime);
      if (newEnd <= newStart) {
        return res.status(400).json({ message: "Return date/time must be after pickup date/time." });
      }

      const conflicts: any = {};
      if (booking.vehicleId) {
        const rows = await findVehicleConflicts(
          req.tenantId!, booking.vehicleId.toString(), newStart, newEnd, booking._id.toString()
        );
        if (rows.length) conflicts.vehicle = rows;
      }
      if (booking.driverId) {
        const availability = await checkDriverAvailability(
          req.tenantId!, booking.driverId.toString(), newStart, newEnd, booking._id.toString()
        );
        if (availability.bookingConflicts.length) conflicts.driverBookings = availability.bookingConflicts;
        if (availability.leaveConflicts.length) conflicts.driverLeave = availability.leaveConflicts;
      }
      if (Object.keys(conflicts).length) {
        if (!override) {
          return res.status(409).json({
            message: "Reschedule conflicts with an assigned driver or vehicle.",
            code: "AVAILABILITY_CONFLICT",
            conflicts,
          });
        }
        if (!req.user || !['admin', 'client'].includes(req.user.role)) {
          return res.status(403).json({ message: "Only an admin or account owner can override a scheduling conflict." });
        }
        if (!reason || !String(reason).trim()) {
          return res.status(400).json({ message: "A reason is required to override a scheduling conflict." });
        }
      }

      booking.rescheduleHistory = booking.rescheduleHistory || [];
      booking.rescheduleHistory.push({
        oldPickupDate: booking.pickupDate,
        oldPickupTime: booking.pickupTime,
        oldReturnDate: booking.returnDate,
        oldReturnTime: booking.returnTime,
        newPickupDate: new Date(newPickupDate),
        newPickupTime,
        newReturnDate: newReturnDate ? new Date(newReturnDate) : undefined,
        newReturnTime,
        reason,
        changedBy: { userId: req.userId!, role: req.user?.role || 'client' },
        changedAt: new Date(),
      });

      booking.pickupDate = new Date(newPickupDate);
      if (newPickupTime !== undefined) booking.pickupTime = newPickupTime;
      if (newReturnDate !== undefined) booking.returnDate = new Date(newReturnDate);
      if (newReturnTime !== undefined) booking.returnTime = newReturnTime;

      await booking.save();
      res.json(booking);
    } catch (error: any) {
      console.error('Reschedule error:', error?.message || error);
      res.status(500).json({ message: "Failed to reschedule booking" });
    }
  });

  // Assign fulfilment to a vendor. Scoped-down stand-in for a full vendor
  // master/ledger — stores vendor + vendor driver/vehicle directly on the
  // booking so "assign to vendor" is a real, working action now, rather
  // than a half-built vendor accounting system with nothing behind it.
  app.post("/api/bookings/:id/assign-vendor", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const { vendorName, vendorContactPhone, vendorDriverName, vendorDriverPhone, vendorVehicleDetails, vendorAgreedRate, vendorAdvancePaid } = req.body || {};
      if (!vendorName || !vendorName.trim()) {
        return res.status(400).json({ message: "vendorName is required" });
      }
      if (vendorDriverPhone && !normalizeIndianPhone(vendorDriverPhone)) {
        return res.status(400).json({ message: `Invalid vendor driver phone number: "${vendorDriverPhone}"` });
      }

      const booking: any = await Booking.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (['cancelled', 'no_show', 'completed', 'closed'].includes(booking.status)) {
        return res.status(400).json({ message: `Cannot assign a vendor to a booking that is ${booking.status}.` });
      }

      booking.fulfilmentType = 'vendor';
      booking.vendorName = vendorName.trim();
      if (vendorContactPhone !== undefined) booking.vendorContactPhone = vendorContactPhone;
      if (vendorDriverName !== undefined) booking.vendorDriverName = vendorDriverName;
      if (vendorDriverPhone !== undefined) booking.vendorDriverPhone = vendorDriverPhone;
      if (vendorVehicleDetails !== undefined) booking.vendorVehicleDetails = vendorVehicleDetails;
      if (vendorAgreedRate !== undefined) booking.vendorAgreedRate = vendorAgreedRate;
      if (vendorAdvancePaid !== undefined) booking.vendorAdvancePaid = vendorAdvancePaid;

      await booking.save();
      res.json(booking);
    } catch (error: any) {
      console.error('Assign vendor error:', error?.message || error);
      res.status(500).json({ message: "Failed to assign vendor" });
    }
  });

  // Extend Booking. Not a date edit — computes an immutable pricing
  // snapshot, revalidates driver/vehicle availability for the NEW extended
  // window, and appends to extensionHistory rather than overwriting the
  // schedule. Blocked on cancelled/no_show/closed; completed requires an
  // explicit override (a genuinely reopened booking, not the default path).
  const EXTENDABLE_STATUSES = ['confirmed', 'vehicle_assigned', 'driver_assigned', 'ready_for_dispatch',
    'trip_started', 'ongoing', 'extended', 'return_pending'];

  app.post("/api/bookings/:id/extend", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const {
        newReturnDate, newReturnTime, addedDestinations, reason, notes, override,
        charges,
      } = req.body || {};

      if (!newReturnDate) {
        return res.status(400).json({ message: "newReturnDate is required" });
      }

      const booking: any = await Booking.findOne({ _id: req.params.id, tenantId: req.tenantId })
        .populate('vehicleId')
        .populate('driverId');
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      if (!EXTENDABLE_STATUSES.includes(booking.status)) {
        return res.status(400).json({
          message: `Cannot extend a booking that is ${booking.status.replace(/_/g, ' ')}. ${booking.status === 'completed' ? 'Use an authorized reopening first.' : ''}`.trim(),
        });
      }

      // P0 FIX: these were built from bare dates, dropping pickupTime /
      // newReturnTime entirely — an extension that only changed the time
      // (not the date) couldn't be distinguished from a no-op, and the
      // downstream driver/vehicle overlap check below inherited the same
      // same-day blind spot as every other call site of this service.
      const newEnd = combineDateTime(newReturnDate, newReturnTime);
      const currentStart = combineDateTime(booking.pickupDate, booking.pickupTime);
      if (newEnd <= currentStart) {
        return res.status(400).json({ message: "New return date must be after the booking's pickup date." });
      }

      // Revalidate availability for the FULL extended window (original
      // pickup through the new end), not just the added days — the
      // vehicle/driver must remain free for the whole booking, and a
      // conflict anywhere in that span blocks the extension.
      const conflicts: any = {};
      if (booking.vehicleId) {
        const vId = (booking.vehicleId as any)._id || booking.vehicleId;
        const vc = await findVehicleConflicts(req.tenantId!, vId.toString(), currentStart, newEnd, booking._id.toString());
        if (vc.length > 0) conflicts.vehicle = vc;
      }
      if (booking.driverId) {
        const dId = (booking.driverId as any)._id || booking.driverId;
        const avail = await checkDriverAvailability(req.tenantId!, dId.toString(), currentStart, newEnd, booking._id.toString());
        if (avail.bookingConflicts.length > 0) conflicts.driverBookings = avail.bookingConflicts;
        if (avail.leaveConflicts.length > 0) conflicts.driverLeave = avail.leaveConflicts;
      }
      if (Object.keys(conflicts).length > 0 && !override) {
        return res.status(409).json({
          message: "Extension not feasible — driver or vehicle is unavailable for the extended period.",
          code: "AVAILABILITY_CONFLICT",
          conflicts,
        });
      }

      const c = charges || {};
      // additionalDays is a count (for display/reporting) — its monetary
      // value is additionalDaysCharge, a separate line item, same as the
      // spec's own worked example ("Additional 2 days: Rs.6,000").
      const extensionTotal = Math.max(0,
        (c.additionalDaysCharge || 0) +
        (c.extraKmCharge || 0) +
        (c.driverAllowance || 0) +
        (c.nightHalt || 0) +
        (c.routeCharge || 0) -
        (c.discount || 0)
      );

      const previousTotal = booking.totalAmount;
      const revisedTotal = previousTotal + extensionTotal;
      const extensionNumber = (booking.extensionHistory?.length || 0) + 1;

      booking.extensionHistory = booking.extensionHistory || [];
      booking.extensionHistory.push({
        extensionNumber,
        previousReturnDate: booking.returnDate,
        previousReturnTime: booking.returnTime,
        newReturnDate: newEnd,
        newReturnTime: newReturnTime,
        addedDestinations: Array.isArray(addedDestinations) ? addedDestinations : [],
        charges: {
          additionalDays: c.additionalDays || 0,
          additionalDaysCharge: c.additionalDaysCharge || 0,
          extraKmCharge: c.extraKmCharge || 0,
          driverAllowance: c.driverAllowance || 0,
          nightHalt: c.nightHalt || 0,
          routeCharge: c.routeCharge || 0,
          discount: c.discount || 0,
        },
        extensionTotal,
        previousTotal,
        revisedTotal,
        reason,
        notes,
        requestedBy: { userId: req.userId!, role: req.user?.role || 'client' },
        createdAt: new Date(),
      });

      booking.returnDate = newEnd;
      if (newReturnTime !== undefined) booking.returnTime = newReturnTime;
      if (Array.isArray(addedDestinations) && addedDestinations.length > 0) {
        booking.additionalStops = [...(booking.additionalStops || []), ...addedDestinations];
      }
      booking.totalAmount = revisedTotal;

      // Extending keeps the trip live but the previously-agreed end time
      // no longer holds — surface it the same way a fresh dispatch would.
      if (['return_pending'].includes(booking.status)) {
        booking.status = 'extended';
      }

      await booking.save();

      // Auto-send updated confirmation/duty details — best-effort, must
      // not fail the extension itself if WhatsApp is down.
      sendBookingMessage({
        tenantId: req.tenantId!, bookingId: booking._id.toString(), messageType: 'booking_confirmation',
        actor: { userId: req.userId!, role: req.user?.role || 'client' }, force: true,
      }).catch((err) => console.error('Auto-send extension confirmation failed:', err?.message || err));
      if (booking.driverId) {
        sendBookingMessage({
          tenantId: req.tenantId!, bookingId: booking._id.toString(), messageType: 'driver_duty',
          actor: { userId: req.userId!, role: req.user?.role || 'client' }, force: true,
        }).catch((err) => console.error('Auto-send extension duty failed:', err?.message || err));
      }

      res.json(booking);
    } catch (error: any) {
      console.error('Extend booking error:', error?.message || error);
      res.status(500).json({ message: "Failed to extend booking" });
    }
  });

  // Cancel booking endpoint — thin wrapper over the state machine so
  // cancellation gets the same transition validation as every other
  // status change (a completed/closed booking cannot be "cancelled").
  app.post("/api/bookings/:id/cancel", authenticateUser, requireTenant, requirePermission(PERMISSIONS.EDIT_BOOKING), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const { cancellationReason } = req.body;

      if (!cancellationReason || cancellationReason.trim() === '') {
        return res.status(400).json({ message: "Cancellation reason is required" });
      }

      const booking = await transitionBooking(
        id,
        scopeTenant(req),
        'cancelled',
        { userId: req.userId!, role: req.user?.role || 'client' },
        { reason: cancellationReason.trim() }
      );

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      booking.cancellationReason = cancellationReason.trim();
      await booking.save();

      const server = (global as any).notificationServer;
      if (server && server.broadcastNotification) {
        server.broadcastNotification(req.tenantId!, {
          type: 'booking_cancelled',
          message: `Booking cancelled: ${booking.bookingId}`,
          data: {
            bookingId: booking.bookingId,
            customerName: booking.customerName,
            amount: booking.totalAmount,
            cancellationReason: booking.cancellationReason,
            bookingType: booking.bookingType
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json(booking);
    } catch (error: any) {
      if (error instanceof InvalidTransitionError) {
        return res.status(409).json({ message: error.message, code: error.code });
      }
      console.error('Cancel booking error:', error);
      res.status(500).json({ message: "Failed to cancel booking" });
    }
  });

  app.delete("/api/bookings/:id", authenticateUser, requireTenant, requirePermission(PERMISSIONS.DELETE_BOOKING), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      await storage.deleteBooking(id, scopeTenant(req));
      res.json({ message: "Booking deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete booking" });
    }
  });

  // Driver Leave Management
  // Monthly Driver Performance. ?month=YYYY-MM (defaults to current month).
  // Every figure is derived live from bookings — nothing is stored
  // separately, so it can never drift out of sync with the actual data.
  app.get("/api/reports/driver-performance", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const monthParam = req.query.month as string | undefined;
      const now = new Date();
      const [year, month] = monthParam
        ? monthParam.split('-').map(Number)
        : [now.getFullYear(), now.getMonth() + 1];
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);

      const bookings = await storage.getBookingsByTenant(req.tenantId!);
      const summary = buildDriverPerformance(bookings, monthStart, monthEnd);
      res.json({ month: `${year}-${String(month).padStart(2, '0')}`, drivers: summary });
    } catch (error: any) {
      console.error('Driver performance report error:', error?.message || error);
      res.status(500).json({ message: "Failed to build driver performance report" });
    }
  });

  app.get("/api/reports/vehicle-performance", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const monthParam = req.query.month as string | undefined;
      const now = new Date();
      const [year, month] = monthParam
        ? monthParam.split('-').map(Number)
        : [now.getFullYear(), now.getMonth() + 1];
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);

      const [bookings, expenses, vehicles, feedback, complaints] = await Promise.all([
        storage.getBookingsByTenant(req.tenantId!),
        storage.getExpensesByTenant(req.tenantId!),
        storage.getVehiclesByTenant(req.tenantId!),
        CustomerFeedback.find({ tenantId: req.tenantId }).lean(),
        CustomerComplaint.find({ tenantId: req.tenantId }).lean(),
      ]);
      const summary = buildVehiclePerformance(bookings, expenses, vehicles, monthStart, monthEnd, feedback, complaints);
      res.json({ month: `${year}-${String(month).padStart(2, '0')}`, vehicles: summary });
    } catch (error: any) {
      console.error('Vehicle performance report error:', error?.message || error);
      res.status(500).json({ message: "Failed to build vehicle performance report" });
    }
  });

  // Manual attendance marking — for days a driver reports without an
  // associated trip (office duty, standby, etc). Duty-based marking from
  // markDutyBasedAttendance() upserts into the same collection, so a
  // manual mark made before a trip starts gets cleanly overwritten by the
  // duty-based one, and vice versa never double-books the same day.
  app.post("/api/drivers/:id/attendance", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
    try {
      const { date, status, notes } = req.body || {};
      if (!date || !status) {
        return res.status(400).json({ message: "date and status are required" });
      }
      const driver = await storage.getDriver(req.params.id, scopeTenant(req));
      if (!driver) return res.status(404).json({ message: "Driver not found" });

      const dayKey = new Date(date);
      dayKey.setHours(0, 0, 0, 0);

      const record = await DriverAttendance.findOneAndUpdate(
        { tenantId: req.tenantId, driverId: req.params.id, date: dayKey },
        {
          $set: {
            status, notes, source: 'manual',
            markedBy: { userId: req.userId!, role: req.user?.role || 'client' },
          },
        },
        { upsert: true, new: true }
      );
      res.json(record);
    } catch (error: any) {
      console.error('Mark attendance error:', error?.message || error);
      res.status(500).json({ message: "Failed to mark attendance" });
    }
  });

  // Daily driver operations report — combines attendance records with
  // approved leave for the day (a driver on leave never falsely shows as
  // "not scheduled" or, worse, "present" just because no attendance row
  // exists yet) and any duty currently assigned that day.
  app.get("/api/attendance/daily", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const dateParam = req.query.date as string | undefined;
      const dayKey = dateParam ? new Date(dateParam) : new Date();
      dayKey.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayKey);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [drivers, attendanceRecords, leaves, bookings] = await Promise.all([
        storage.getDriversByTenant(req.tenantId!),
        DriverAttendance.find({ tenantId: req.tenantId, date: dayKey }),
        DriverLeave.find({ tenantId: req.tenantId, status: 'approved', startDate: { $lt: dayEnd }, endDate: { $gt: dayKey } }),
        storage.getBookingsByTenant(req.tenantId!),
      ]);

      const attendanceByDriver = new Map(attendanceRecords.map((a: any) => [a.driverId.toString(), a]));
      const leaveByDriver = new Map(leaves.map((l: any) => [l.driverId.toString(), l]));

      const report = drivers.map((d: any) => {
        const driverId = d._id.toString();
        const attendance = attendanceByDriver.get(driverId);
        const leave = leaveByDriver.get(driverId);
        const todaysBooking = bookings.find((b: any) => {
          const bDriverId = b.driverId && typeof b.driverId === 'object' ? (b.driverId._id?.toString?.() || b.driverId._id) : b.driverId?.toString?.();
          return bDriverId === driverId && new Date(b.pickupDate) >= dayKey && new Date(b.pickupDate) < dayEnd
            && !['cancelled', 'no_show'].includes(b.status);
        });

        let status = attendance?.status || 'not_scheduled';
        if (leave && !attendance) {
          status = leave.leaveType === 'paid' ? 'paid_leave' : leave.leaveType === 'weekly_off' ? 'weekly_off' : 'unpaid_leave';
        }

        return {
          driverId,
          driverName: d.name,
          status,
          source: attendance?.source || (leave ? 'leave' : 'none'),
          actualCheckIn: attendance?.actualCheckIn || null,
          lateDurationMinutes: attendance?.lateDurationMinutes || null,
          onLeave: !!leave,
          leaveType: leave?.leaveType || null,
          currentBooking: todaysBooking ? { id: todaysBooking._id, bookingId: todaysBooking.bookingId, status: todaysBooking.status, customerName: todaysBooking.customerName } : null,
        };
      });

      res.json({ date: dayKey.toISOString().slice(0, 10), drivers: report });
    } catch (error: any) {
      console.error('Daily attendance report error:', error?.message || error);
      res.status(500).json({ message: "Failed to build daily attendance report" });
    }
  });

  app.get("/api/driver-leaves", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const query: any = { tenantId: req.tenantId };
      if (req.query.driverId) query.driverId = req.query.driverId;
      if (req.query.status) query.status = req.query.status;
      const leaves = await DriverLeave.find(query).populate('driverId').sort({ createdAt: -1 });
      res.json(leaves);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to load leave requests" });
    }
  });

  app.post("/api/drivers/:id/leave", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate, leaveType, reason } = req.body || {};
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        return res.status(400).json({ message: "endDate cannot be before startDate" });
      }

      const driver = await storage.getDriver(req.params.id, scopeTenant(req));
      if (!driver) return res.status(404).json({ message: "Driver not found" });

      const leave = await DriverLeave.create({
        tenantId: req.tenantId,
        driverId: req.params.id,
        startDate: start,
        endDate: end,
        leaveType: leaveType || 'unpaid',
        reason,
        status: 'pending',
        requestedBy: { userId: req.userId!, role: req.user?.role || 'client' },
      });
      res.status(201).json(leave);
    } catch (error: any) {
      console.error('Create leave error:', error?.message || error);
      res.status(500).json({ message: "Failed to create leave request" });
    }
  });

  // Approving leave checks for conflicting future bookings FIRST — per
  // spec, leave must never silently remove a driver from a confirmed
  // booking. Without override, a conflict blocks approval; with override,
  // it's approved anyway but the conflicts are stored on the leave record
  // for the manager to actually act on (replace driver, reschedule, etc).
  app.post("/api/driver-leaves/:id/approve", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
    try {
      const { override, approvalNote } = req.body || {};
      const leave: any = await DriverLeave.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!leave) return res.status(404).json({ message: "Leave request not found" });
      if (leave.status !== 'pending') {
        return res.status(400).json({ message: `This leave request is already ${leave.status}.` });
      }

      const bookingConflicts = await checkDriverAvailability(
        req.tenantId!, leave.driverId.toString(), leave.startDate, leave.endDate
      );

      if (bookingConflicts.bookingConflicts.length > 0 && !override) {
        return res.status(409).json({
          message: "This driver has confirmed bookings during the requested leave period. Assign a replacement or reschedule before approving.",
          code: "LEAVE_BOOKING_CONFLICT",
          conflicts: bookingConflicts.bookingConflicts,
        });
      }

      leave.status = 'approved';
      leave.approvedBy = { userId: req.userId!, role: req.user?.role || 'client' };
      leave.approvalNote = approvalNote;
      if (bookingConflicts.bookingConflicts.length > 0) {
        leave.conflictingBookings = bookingConflicts.bookingConflicts.map((c) => c.bookingId);
      }
      await leave.save();
      res.json(leave);
    } catch (error: any) {
      console.error('Approve leave error:', error?.message || error);
      res.status(500).json({ message: "Failed to approve leave" });
    }
  });

  app.post("/api/driver-leaves/:id/reject", authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
    try {
      const { approvalNote } = req.body || {};
      const leave: any = await DriverLeave.findOne({ _id: req.params.id, tenantId: req.tenantId });
      if (!leave) return res.status(404).json({ message: "Leave request not found" });
      if (leave.status !== 'pending') {
        return res.status(400).json({ message: `This leave request is already ${leave.status}.` });
      }
      leave.status = 'rejected';
      leave.approvedBy = { userId: req.userId!, role: req.user?.role || 'client' };
      leave.approvalNote = approvalNote;
      await leave.save();
      res.json(leave);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to reject leave" });
    }
  });

  // Expense routes
  app.get("/api/expenses", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const expenses = await storage.getExpensesByTenant(req.tenantId!);
      res.json(expenses);
    } catch (error) {
      console.error('Get expenses error:', error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      // Basic validation
      const { vehicleId, category, amount, date, description, attachmentUrl } = req.body;
      
      if (!vehicleId || !category || !amount || !date) {
        return res.status(400).json({ message: "Vehicle, category, amount, and date are required" });
      }

      const expenseData = {
        tenantId: req.tenantId!,
        vehicleId,
        category,
        amount: parseFloat(amount),
        date: new Date(date),
        description: description || '',
        attachmentUrl: attachmentUrl || '',
        createdBy: {
          userId: req.userId!,
          role: req.user?.role || 'client'
        }
      };

      const expense = await storage.createExpense(expenseData);
      res.status(201).json(expense);
    } catch (error) {
      console.error('Create expense error:', error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  app.get("/api/expenses/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const expense = await storage.getExpense(req.params.id, scopeTenant(req));
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error('Get expense error:', error);
      res.status(500).json({ message: "Failed to fetch expense" });
    }
  });

  app.put("/api/expenses/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      const updateData = { ...req.body };
      if (updateData.amount) {
        updateData.amount = parseFloat(updateData.amount);
      }
      if (updateData.date) {
        updateData.date = new Date(updateData.date);
      }

      const expense = await storage.updateExpense(req.params.id, updateData, scopeTenant(req));
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error('Update expense error:', error);
      res.status(500).json({ message: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", authenticateUser, requireTenant, async (req: AuthRequest, res) => {
    try {
      await storage.deleteExpense(req.params.id, scopeTenant(req));
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error('Delete expense error:', error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // P0 FIX: this endpoint had NO authentication at all and let anyone on
  // the internet trigger a write sweep across all tenants' bookings. It is
  // a debug/ops utility, not a product feature, so it's now admin-only and
  // additionally disabled outside development.
  app.post("/api/test-background-job", authenticateUser, requireAdmin, async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ message: "Not found" });
    }
    try {
      const completedCount = await storage.markExpiredBookingsAsCompleted();
      res.json({ message: `Marked ${completedCount} expired booking(s) as completed` });
    } catch (error) {
      res.status(500).json({ message: "Failed to run background job", error: (error as Error).message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
