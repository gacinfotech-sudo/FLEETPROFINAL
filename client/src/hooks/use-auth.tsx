import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { apiRequest, setSessionExpiryHandler } from "../lib/api";
import { setQuerySessionExpiryHandler } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number | string;
  userId: string;
  role: string;
  accountType?: 'PLATFORM' | 'TENANT';
  platformRole?: string;
  tenantId?: string | number | null;
  mustResetPassword?: boolean;
  hasCompletedOnboarding?: boolean;
  lastLogin?: Date;
  lastLoginIP?: string;
  lastLoginUserAgent?: string;
  loginAttempts?: number;
  failedLoginAttempts?: number;
  accountLocked?: boolean;
  lockoutTime?: Date;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  login: (userId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (newPassword: string, confirmPassword: string) => Promise<void>;
  loading: boolean;
  handleSessionExpiry: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProviderInner({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath === '/login' || currentPath === '/driver-login';

    if (isLoginPage) {
      console.log("On login page - skipping all auth checks");
      setLoading(false);
      // Don't register session expiry handlers on login page
      return;
    }

    // Only do auth checks on protected pages
    checkAuthStatus().catch(error => {
      console.error("Initial auth check failed:", error);
    });

    // Register global session expiry handlers (protected pages only)
    setSessionExpiryHandler(handleSessionExpiry);
    setQuerySessionExpiryHandler(handleSessionExpiry);
  }, []); // Only run once on mount

  const handleSessionExpiry = () => {
    const currentPath = window.location.pathname;
    console.log("handleSessionExpiry called from path:", currentPath);

    // NEVER show toast on login pages
    if (currentPath === '/login' || currentPath === '/driver-login') {
      console.log("✅ On login page - blocking session expiry completely");
      return;
    }

    console.log("Session expired from protected page:", currentPath);
    setUser(null);
    localStorage.removeItem('fleetpro_token');
    localStorage.removeItem('fleetpro_user');

    // DISABLED TEMPORARILY: Don't show toast to debug
    // toast({
    //   variant: "destructive",
    //   title: "Session Expired",
    //   description: "Your session has expired. Please login again.",
    // });

    setTimeout(() => {
      setLocation("/login");
    }, 1500);
  };

  const checkAuthStatus = async () => {
    try {
      // P0 FIX: Session-based authentication only
      // Backend uses httpOnly cookies, NOT bearer tokens
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);

        // Store user data locally for PWA persistence
        localStorage.setItem('fleetpro_user', JSON.stringify({
          ...data.user,
          lastValidated: Date.now()
        }));
      } else if (response.status === 401) {
        // Clear local storage on session expiry
        localStorage.removeItem('fleetpro_user');
        localStorage.removeItem('fleetpro_token');

        // Only trigger session expiry if user was previously authenticated
        if (user) {
          console.log("Session expired for authenticated user");
          handleSessionExpiry();
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);

      // For PWA: Try to restore user from localStorage during network errors
      if (!user && !navigator.onLine) {
        const storedUser = localStorage.getItem('fleetpro_user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

            if (parsedUser.lastValidated && parsedUser.lastValidated > oneWeekAgo) {
              setUser(parsedUser);
              console.log("Restored user from localStorage for offline use");
            } else {
              localStorage.removeItem('fleetpro_user');
            }
          } catch (e) {
            localStorage.removeItem('fleetpro_user');
          }
        }
      }

      if (user && navigator.onLine) {
        handleSessionExpiry();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (userId: string, password: string) => {
    try {
      // P0 FIX: Use canonical auth endpoint only
      // Backend returns authoritative accountType and redirectUrl
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userId, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.message || "Login failed");
        (error as any).status = response.status;
        (error as any).code = errorData.code;
        throw error;
      }

      const data = await response.json();

      // Set user data immediately
      setUser(data.user);
      setLoading(false);

      // P0 FIX: Backend uses session cookies, not bearer tokens
      // Do NOT store token in localStorage (it doesn't exist)
      localStorage.setItem('fleetpro_user', JSON.stringify({
        ...data.user,
        lastValidated: Date.now()
      }));

      // P0 FIX: TRUST BACKEND COMPLETELY for redirect decision
      // Backend has determined the authoritative accountType
      // and calculated the correct redirect URL
      const redirectUrl = data.redirectUrl || (
        data.user.accountType === 'PLATFORM'
          ? "/superadmin/dashboard"
          : "/dashboard"
      );

      console.log(`✅ P0 LOGIN: accountType=${data.user.accountType}, redirecting to ${redirectUrl}`);
      setLocation(redirectUrl);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      setUser(null);

      // Clear all auth-related storage to prevent stale auth state
      localStorage.removeItem('fleetpro_user');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_state');
      sessionStorage.removeItem('fleetpro_user');
      sessionStorage.removeItem('auth_state');
      sessionStorage.removeItem('auth_token');

      // Use direct URL redirect to ensure it happens before reload
      // (setLocation is async and reload would fire first)
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
      // Even if logout API fails, clear local state and redirect
      setUser(null);

      // Clear all auth-related storage to prevent stale auth state
      localStorage.removeItem('fleetpro_user');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_state');
      sessionStorage.removeItem('fleetpro_user');
      sessionStorage.removeItem('auth_state');
      sessionStorage.removeItem('auth_token');

      // Use direct URL redirect to ensure it happens before reload
      window.location.href = "/login";
    }
  };

  const resetPassword = async (newPassword: string, confirmPassword: string) => {
    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        newPassword,
        confirmPassword
      });
      // Clear user state to force re-login
      setUser(null);
      // Add a small delay to ensure state is cleared, then redirect
      setTimeout(() => {
        setLocation("/login");
        // Force a page refresh to clear any cached state
        window.location.reload();
      }, 1000);
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, resetPassword, loading, handleSessionExpiry }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthProviderInner>{children}</AuthProviderInner>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
