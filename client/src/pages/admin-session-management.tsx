/**
 * ADMIN SESSION MANAGEMENT DASHBOARD
 * View and manage active sessions, revoke tokens, logout devices
 */

import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import apiClient from '../utils/api-client';

interface UserSession {
  _id: string;
  userId: string;
  deviceFingerprint?: {
    userAgent: string;
    ip: string;
  };
  createdAt: string;
  lastActivityAt: string;
  isRevoked: boolean;
}

export const AdminSessionManagement: React.FC = () => {
  const { user, logoutAll } = useSession();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<UserSession[]>('/admin/sessions');
      setSessions(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutDevice = async (sessionId: string) => {
    if (!window.confirm('Logout this device?')) return;

    try {
      await apiClient.post(`/admin/sessions/${sessionId}/revoke`);
      setSessions(sessions.filter((s) => s._id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to logout device');
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Logout from ALL devices? You will need to login again.')) return;

    try {
      await logoutAll();
      window.location.href = '/login';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to logout from all devices');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-600">Loading sessions...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-gray-900">Session Management</h1>
          <p className="text-gray-600 mt-2">Manage your active sessions and devices</p>
        </div>

        {error && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="p-6">
          <div className="mb-6 pb-6 border-b">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Active Sessions ({sessions.filter((s) => !s.isRevoked).length})
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  You are logged in on {sessions.filter((s) => !s.isRevoked).length} device(s)
                </p>
              </div>
              {sessions.filter((s) => !s.isRevoked).length > 1 && (
                <button
                  onClick={handleLogoutAll}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Logout All Devices
                </button>
              )}
            </div>
          </div>

          {sessions.filter((s) => !s.isRevoked).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No active sessions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions
                .filter((s) => !s.isRevoked)
                .map((session) => (
                  <div
                    key={session._id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <h3 className="font-semibold text-gray-900">
                            {session.deviceFingerprint?.userAgent || 'Unknown Device'}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          IP: {session.deviceFingerprint?.ip || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Created: {new Date(session.createdAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          Last active: {new Date(session.lastActivityAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleLogoutDevice(session._id)}
                        className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {sessions.filter((s) => s.isRevoked).length > 0 && (
            <div className="mt-8 pt-8 border-t">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Revoked Sessions ({sessions.filter((s) => s.isRevoked).length})
              </h3>
              <div className="space-y-2">
                {sessions
                  .filter((s) => s.isRevoked)
                  .map((session) => (
                    <div
                      key={session._id}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
                    >
                      <div className="text-sm text-gray-600">
                        {session.deviceFingerprint?.userAgent || 'Unknown Device'} •{' '}
                        {new Date(session.createdAt).toLocaleString()}
                      </div>
                      <span className="text-xs text-gray-500">Revoked</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900">Security Note</h3>
        <p className="text-sm text-blue-800 mt-2">
          If you don't recognize a device or session, logout from it immediately. Your account
          security is important to us.
        </p>
      </div>
    </div>
  );
};

export default AdminSessionManagement;
