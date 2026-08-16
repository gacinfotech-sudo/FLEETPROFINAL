import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { apiRequest, setSessionExpiryHandler } from "../lib/api";
import { setQuerySessionExpiryHandler } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  userId: string;
  role: string;
  platformRole?: string;
  tenantId?: number;
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
      const token = localStorage.getItem('fleetpro_token');
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch("/api/auth/me", {
        credentials: "include",
        headers
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
        
        // Only trigger session expiry if user was previously authenticated
        // This prevents the immediate logout issue after login
        if (user) {
          console.log("Session expired for authenticated user");
          handleSessionExpiry();
        } else {
          // No user session, just clear the user state silently
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
            
            // Only restore if stored less than a week ago
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
      
      // Only show session expiry if user was previously authenticated
      if (user && navigator.onLine) {
        handleSessionExpiry();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (userId: string, password: string) => {
    try {
      // Try platform auth first (email or userId)
      let response = await fetch("/api/platform/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userId, password }),
        credentials: "include",
      });

      // If platform auth fails, try tenant auth as fallback
      if (!response.ok) {
        response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId, password }),
          credentials: "include",
        });
      }
      
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

      // Store token AND user data locally
      if (data.token) {
        localStorage.setItem('fleetpro_token', data.token);
        localStorage.setItem('fleetpro_user', JSON.stringify({
          ...data.user,
          token: data.token,
          lastValidated: Date.now()
        }));
      } else {
        // Fallback for endpoints that use cookies
        localStorage.setItem('fleetpro_user', JSON.stringify({
          ...data.user,
          lastValidated: Date.now()
        }));
      }
      
      // Navigate to appropriate dashboard
      // Platform owners/staff go to SaaS platform control panel
      if (data.user.platformRole) {
        setLocation("/superadmin/dashboard");
      } else if (data.user.role === "admin") {
        setLocation("/dashboard");
      } else {
        setLocation("/dashboard");
      }
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
