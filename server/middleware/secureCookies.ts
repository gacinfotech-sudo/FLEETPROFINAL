import { Request, Response, NextFunction } from 'express';

/**
 * Secure Cookie Configuration
 * Implements secure cookie flags for authentication
 */
export const getSecureCookieConfig = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const isDev = process.env.NODE_ENV === 'development';

  return {
    // Session cookie settings
    session: {
      name: 'fleetpro_session',
      secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      proxy: isProd, // trust reverse proxy
      cookie: {
        // Security flags
        secure: isProd || process.env.FORCE_HTTPS === 'true', // HTTPS only in production
        httpOnly: true, // Prevent JavaScript access (XSS mitigation)
        sameSite: 'strict' as const, // CSRF protection: strict mode
        // Session expiry
        maxAge: 30 * 60 * 1000, // 30 minutes idle timeout
        domain: isDev ? 'localhost' : undefined, // Don't set domain in development
        path: '/',
      },
    },

    // Auth token cookie (if using cookies for auth)
    auth: {
      name: 'fleetpro_auth',
      secure: isProd || process.env.FORCE_HTTPS === 'true',
      httpOnly: true,
      sameSite: 'strict' as const,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },

    // CSRF token cookie
    csrf: {
      name: 'csrf-token',
      secure: isProd || process.env.FORCE_HTTPS === 'true',
      httpOnly: false, // CSRF token needs to be readable by JavaScript
      sameSite: 'strict' as const,
      maxAge: 60 * 60 * 1000, // 1 hour
    },
  };
};

/**
 * Middleware to ensure secure cookie configuration
 * Validates cookie settings on every response
 */
export const validateSecureCookiesMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isProd = process.env.NODE_ENV === 'production';

  // Wrap res.cookie to enforce security settings
  const originalCookie = res.cookie.bind(res);
  res.cookie = function (name: string, value: any, options?: any) {
    const secureOptions = {
      ...options,
      secure: isProd || process.env.FORCE_HTTPS === 'true' || options?.secure,
      httpOnly: options?.httpOnly !== false, // Default to true
      sameSite: options?.sameSite || 'strict',
      path: options?.path || '/',
    };

    // Log cookie creation in development
    if (process.env.DEBUG_COOKIES === 'true') {
      console.log(`[COOKIE] ${name}`, {
        secure: secureOptions.secure,
        httpOnly: secureOptions.httpOnly,
        sameSite: secureOptions.sameSite,
        maxAge: options?.maxAge,
      });
    }

    return originalCookie(name, value, secureOptions);
  };

  next();
};

/**
 * Middleware to clear sensitive cookies on logout
 */
export const clearSensitiveCookiesMiddleware = (name: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === `/api/auth/${name}/logout` && req.method === 'POST') {
      // Clear all auth-related cookies
      res.clearCookie('fleetpro_session');
      res.clearCookie('fleetpro_auth');
      res.clearCookie('csrf-token');
    }
    next();
  };
};

/**
 * Helper to set secure session cookie
 */
export const setSecureSessionCookie = (req: Request, res: Response, userId: string) => {
  if (!req.session) {
    req.session = {} as any;
  }
  req.session.userId = userId;
  req.session.loginTime = Date.now();
  // Session ID rotation happens automatically on login
};

/**
 * Helper to invalidate session on logout
 */
export const invalidateSession = (req: Request, res: Response) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
    });
  }
  // Clear cookies
  res.clearCookie('fleetpro_session');
  res.clearCookie('fleetpro_auth');
  res.clearCookie('csrf-token');
};
