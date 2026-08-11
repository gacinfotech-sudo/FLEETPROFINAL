import { CorsOptions } from 'cors';

/**
 * CORS Configuration
 * Restricts cross-origin requests to approved origins only
 */

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

// Define approved origins
const approvedOrigins = new Set<string>();

// Development origins
if (isDev) {
  approvedOrigins.add('http://localhost:5050');
  approvedOrigins.add('https://localhost:5050');
  approvedOrigins.add('http://127.0.0.1:5050');
  approvedOrigins.add('https://127.0.0.1:5050');
  approvedOrigins.add('http://localhost:5051'); // Vite dev server
  approvedOrigins.add('http://127.0.0.1:5051');
}

// Production origins (configured via environment variable)
if (isProd && process.env.ALLOWED_ORIGINS) {
  const origins = process.env.ALLOWED_ORIGINS.split(',');
  origins.forEach(origin => approvedOrigins.add(origin.trim()));
}

// Add configured additional origins
if (process.env.ADDITIONAL_ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ADDITIONAL_ALLOWED_ORIGINS.split(',');
  additionalOrigins.forEach(origin => approvedOrigins.add(origin.trim()));
}

export const corsConfig: CorsOptions = {
  // Origin validation
  origin: (origin, callback) => {
    // Allow requests without origin (same-origin requests, mobile apps, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in approved list
    if (approvedOrigins.has(origin)) {
      return callback(null, true);
    }

    // Reject origin not in approved list
    console.warn(`[CORS] Rejected request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS policy'));
  },

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Allowed methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],

  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'X-API-Key',
  ],

  // Headers that browser can access from response
  exposedHeaders: [
    'Content-Length',
    'X-CSRF-Token',
    'X-Request-Id',
  ],

  // Max age for preflight cache (1 hour)
  maxAge: 3600,

  // Successful preflight request status
  optionsSuccessStatus: 200,
};

/**
 * Validate CORS configuration
 */
export const validateCorsConfig = () => {
  if (isProd && approvedOrigins.size === 0) {
    console.warn('[CORS] WARNING: No origins configured for production. Set ALLOWED_ORIGINS environment variable.');
  }

  console.log('[CORS] Approved origins:', Array.from(approvedOrigins));
};

/**
 * Get CORS origins as array (for debugging)
 */
export const getCorsOrigins = (): string[] => {
  return Array.from(approvedOrigins);
};

/**
 * Check if origin is allowed
 */
export const isOriginAllowed = (origin: string): boolean => {
  return !origin || approvedOrigins.has(origin);
};
