/**
 * API CLIENT WITH AUTO-TOKEN REFRESH
 * Automatically adds access token to requests
 * Handles 401 by refreshing token and retrying
 */

const ACCESS_TOKEN_KEY = 'fleetpro_access_token';
const REFRESH_TOKEN_KEY = 'fleetpro_refresh_token';

interface RequestOptions extends RequestInit {
  body?: any;
  params?: Record<string, string | number>;
}

class ApiClient {
  private baseUrl: string = '/api';
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private subscribeToRefresh(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  private async refreshToken(): Promise<string | null> {
    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.subscribeToRefresh((token) => resolve(token));
      });
    }

    this.isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        return null;
      }

      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        window.location.href = '/login';
        return null;
      }

      const { accessToken, refreshToken: newRefreshToken } = await response.json();
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

      this.onRefreshed(accessToken);
      return accessToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      window.location.href = '/login';
      return null;
    } finally {
      this.isRefreshing = false;
    }
  }

  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    let url = `${this.baseUrl}${endpoint}`;

    // Add query parameters
    if (options.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      url = `${url}?${searchParams.toString()}`;
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add access token
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Prepare body
    const body = options.body ? JSON.stringify(options.body) : undefined;

    try {
      let response = await fetch(url, {
        ...options,
        headers,
        body,
      });

      // Handle 401 - refresh token and retry
      if (response.status === 401) {
        const newAccessToken = await this.refreshToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          response = await fetch(url, {
            ...options,
            headers,
            body,
          });
        }
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  get<T = any>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  put<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  patch<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  delete<T = any>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
