/**
 * SESSION CONTEXT
 * Client-side session management with persistent refresh token
 * Auto-refresh on access token expiry, logout revocation
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionUser {
  id: string;
  userId: string;
  role: string;
  tenantId: string;
  name?: string;
  phone?: string;
}

interface SessionContextType {
  tokens: SessionTokens | null;
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (tokens: SessionTokens, user: SessionUser) => void;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const REFRESH_TOKEN_KEY = 'fleetpro_refresh_token';
const ACCESS_TOKEN_KEY = 'fleetpro_access_token';
const USER_KEY = 'fleetpro_user';
const TENANT_KEY = 'fleetpro_tenant_id';
const SESSION_TIMESTAMP_KEY = 'fleetpro_session_timestamp';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tokens, setTokens] = useState<SessionTokens | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  let refreshTimeout: NodeJS.Timeout | null = null;

  // Restore session from localStorage on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);
        const storedTenant = localStorage.getItem(TENANT_KEY);
        const sessionTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);

        console.log('[SESSION] Restore attempt - hasRefreshToken:', !!storedRefreshToken, 'hasUser:', !!storedUser, 'tenantId:', storedTenant, 'timestamp:', sessionTimestamp);

        if (storedRefreshToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          console.log('[SESSION] User restored from storage:', parsedUser.userId);
          setUser(parsedUser);

          // Try to refresh access token
          console.log('[SESSION] Attempting to refresh access token...');
          const success = await refreshAccessToken(storedRefreshToken);
          if (success) {
            console.log('[SESSION] ✅ Access token refreshed successfully');
          } else {
            console.log('[SESSION] ❌ Access token refresh failed - clearing storage');
            clearStorage();
          }
        } else {
          console.log('[SESSION] No stored session found');
        }
      } catch (error) {
        console.error('[SESSION] Error restoring session:', error);
        clearStorage();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Schedule token refresh before expiry
  useEffect(() => {
    if (tokens && tokens.expiresIn > 0) {
      // Refresh 1 minute before expiry
      const refreshTime = Math.max(tokens.expiresIn - 60000, 5000);

      refreshTimeout = setTimeout(() => {
        refreshAccessToken(localStorage.getItem(REFRESH_TOKEN_KEY) || '');
      }, refreshTime);

      return () => {
        if (refreshTimeout) clearTimeout(refreshTimeout);
      };
    }
  }, [tokens]);

  const clearStorage = () => {
    console.log('[SESSION] Clearing session storage');
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(SESSION_TIMESTAMP_KEY);
  };

  const refreshAccessToken = async (refreshToken: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearStorage();
        setTokens(null);
        setUser(null);
        return false;
      }

      const newTokens: SessionTokens = await response.json();
      setTokens(newTokens);
      localStorage.setItem(ACCESS_TOKEN_KEY, newTokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, newTokens.refreshToken);

      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      clearStorage();
      setTokens(null);
      setUser(null);
      return false;
    }
  };

  const login = useCallback((newTokens: SessionTokens, newUser: SessionUser) => {
    setTokens(newTokens);
    setUser(newUser);
    // Persist all tokens and user data to localStorage
    localStorage.setItem(ACCESS_TOKEN_KEY, newTokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, newTokens.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    localStorage.setItem(TENANT_KEY, newUser.tenantId);
    localStorage.setItem(SESSION_TIMESTAMP_KEY, new Date().toISOString());
    console.log('[SESSION] Login successful - session persisted to localStorage');
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      clearStorage();
      setTokens(null);
      setUser(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await fetch('/api/auth/logout-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.error('Error during logout all:', error);
    } finally {
      clearStorage();
      setTokens(null);
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;
    return refreshAccessToken(refreshToken);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        tokens,
        user,
        isLoading,
        isAuthenticated: !!tokens && !!user,
        login,
        logout,
        logoutAll,
        refresh,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};

export default SessionContext;
