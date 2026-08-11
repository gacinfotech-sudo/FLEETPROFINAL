// Admin Notifications Dashboard
import React, { useState, useEffect } from 'react';
import { createLogger } from '../../server/utils/logger';

const log = createLogger('NotificationsDashboard');

export interface MetricsData {
  totalSent: number;
  totalDelivered: number;
  totalClicked: number;
  totalDismissed: number;
  totalFailed: number;
  deliveryRate: number;
  clickThroughRate: number;
  dismissalRate: number;
  averageDeliveryTime: number;
  retrySuccessRate: number;
}

export interface SummaryData {
  last7Days: MetricsData;
  last30Days: MetricsData;
  improvement: {
    deliveryRate: 'up' | 'down';
    clickThroughRate: 'up' | 'down';
  };
}

export const NotificationsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [activeTab, setActiveTab] = useState<'7days' | '30days'>('7days');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/notification-analytics/summary', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSummary(data.summary);
      log.info('Summary loaded successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      log.error('Failed to load summary', { error: message });
    } finally {
      setLoading(false);
    }
  };

  const metrics = activeTab === '7days' ? summary?.last7Days : summary?.last30Days;

  if (loading) {
    return (
      <div className="notifications-dashboard loading">
        <div className="spinner">Loading notification analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notifications-dashboard error">
        <div className="error-message">
          <h3>Failed to load analytics</h3>
          <p>{error}</p>
          <button onClick={fetchSummary}>Retry</button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="notifications-dashboard">
        <div className="empty-state">
          <p>No notification data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-dashboard">
      <div className="dashboard-header">
        <h2>Notification Analytics</h2>
        <button className="btn-refresh" onClick={fetchSummary}>
          ↻ Refresh
        </button>
      </div>

      {/* Time Period Tabs */}
      <div className="time-period-tabs">
        <button
          className={`tab ${activeTab === '7days' ? 'active' : ''}`}
          onClick={() => setActiveTab('7days')}
        >
          Last 7 Days
        </button>
        <button
          className={`tab ${activeTab === '30days' ? 'active' : ''}`}
          onClick={() => setActiveTab('30days')}
        >
          Last 30 Days
        </button>
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Sent"
          value={metrics.totalSent}
          icon="📤"
          color="#3b82f6"
        />
        <MetricCard
          title="Delivered"
          value={metrics.totalDelivered}
          icon="✓"
          color="#10b981"
          subtitle={`${metrics.deliveryRate.toFixed(1)}% delivery rate`}
        />
        <MetricCard
          title="Clicked"
          value={metrics.totalClicked}
          icon="👆"
          color="#f59e0b"
          subtitle={`${metrics.clickThroughRate.toFixed(1)}% CTR`}
        />
        <MetricCard
          title="Dismissed"
          value={metrics.totalDismissed}
          icon="✕"
          color="#ef4444"
          subtitle={`${metrics.dismissalRate.toFixed(1)}% dismissal rate`}
        />
        <MetricCard
          title="Failed"
          value={metrics.totalFailed}
          icon="⚠️"
          color="#a78bfa"
        />
        <MetricCard
          title="Avg Delivery Time"
          value={`${(metrics.averageDeliveryTime / 1000).toFixed(1)}s`}
          icon="⏱️"
          color="#06b6d4"
        />
      </div>

      {/* Performance Trends */}
      <div className="performance-section">
        <h3>Performance Trends</h3>
        <div className="trends-grid">
          <TrendCard
            label="Delivery Rate"
            current={metrics.deliveryRate}
            trend={summary?.improvement.deliveryRate}
            unit="%"
          />
          <TrendCard
            label="Click-Through Rate"
            current={metrics.clickThroughRate}
            trend={summary?.improvement.clickThroughRate}
            unit="%"
          />
          <TrendCard
            label="Retry Success Rate"
            current={metrics.retrySuccessRate}
            unit="%"
          />
        </div>
      </div>

      {/* Recommendations */}
      <div className="recommendations-section">
        <h3>Recommendations</h3>
        <ul className="recommendations-list">
          {metrics.deliveryRate < 90 && (
            <li className="warning">
              Delivery rate is below 90%. Check push notification configuration and VAPID keys.
            </li>
          )}
          {metrics.clickThroughRate < 20 && metrics.totalClicked > 0 && (
            <li className="info">
              Click-through rate is low. Consider improving notification copy and targeting.
            </li>
          )}
          {metrics.dismissalRate > 30 && (
            <li className="warning">
              High dismissal rate. Review notification frequency and relevance.
            </li>
          )}
          {metrics.totalFailed > 0 && (
            <li className="warning">
              {metrics.totalFailed} notifications failed. Check logs for subscription errors.
            </li>
          )}
          {metrics.retrySuccessRate < 50 && metrics.retrySuccessRate > 0 && (
            <li className="info">
              Retry success rate is low. Consider increasing max retries or improving network handling.
            </li>
          )}
          {metrics.deliveryRate >= 95 && metrics.clickThroughRate >= 20 && (
            <li className="success">All metrics looking great! Keep up the good work.</li>
          )}
        </ul>
      </div>

      {/* Styles */}
      <style>{`
        .notifications-dashboard {
          padding: 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          color: white;
          min-height: 600px;
        }

        .notifications-dashboard.loading,
        .notifications-dashboard.error {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          font-size: 18px;
          opacity: 0.8;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.8;
          }
          50% {
            opacity: 1;
          }
        }

        .error-message {
          text-align: center;
          padding: 20px;
        }

        .error-message h3 {
          margin: 0 0 10px 0;
          font-size: 20px;
        }

        .error-message p {
          margin: 10px 0;
          opacity: 0.9;
        }

        .error-message button {
          padding: 8px 16px;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          margin-top: 10px;
        }

        .error-message button:hover {
          opacity: 0.9;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          border-bottom: 2px solid rgba(255, 255, 255, 0.2);
          padding-bottom: 16px;
        }

        .dashboard-header h2 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }

        .btn-refresh {
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-refresh:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .time-period-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }

        .time-period-tabs .tab {
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 2px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .time-period-tabs .tab:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .time-period-tabs .tab.active {
          background: rgba(255, 255, 255, 0.25);
          border-color: white;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .performance-section,
        .recommendations-section {
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 20px;
          backdrop-filter: blur(10px);
        }

        .performance-section h3,
        .recommendations-section h3 {
          margin-top: 0;
          margin-bottom: 16px;
          font-size: 18px;
          font-weight: 600;
        }

        .trends-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .recommendations-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .recommendations-list li {
          padding: 12px;
          margin-bottom: 8px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-left: 4px solid #f59e0b;
          line-height: 1.5;
        }

        .recommendations-list li.success {
          border-left-color: #10b981;
          background: rgba(16, 185, 129, 0.15);
        }

        .recommendations-list li.warning {
          border-left-color: #ef4444;
          background: rgba(239, 68, 68, 0.15);
        }

        .recommendations-list li.info {
          border-left-color: #3b82f6;
          background: rgba(59, 130, 246, 0.15);
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          opacity: 0.7;
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .metrics-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }

          .trends-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color, subtitle }) => (
  <div className="metric-card" style={{ borderLeftColor: color }}>
    <div className="metric-icon">{icon}</div>
    <div className="metric-content">
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
    </div>
    <style>{`
      .metric-card {
        background: rgba(255, 255, 255, 0.1);
        padding: 16px;
        border-radius: 10px;
        border-left: 4px solid;
        display: flex;
        align-items: center;
        gap: 12px;
        backdrop-filter: blur(10px);
      }

      .metric-icon {
        font-size: 24px;
      }

      .metric-content {
        flex: 1;
      }

      .metric-title {
        font-size: 12px;
        opacity: 0.8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }

      .metric-value {
        font-size: 24px;
        font-weight: 700;
      }

      .metric-subtitle {
        font-size: 11px;
        opacity: 0.7;
        margin-top: 2px;
      }
    `}</style>
  </div>
);

interface TrendCardProps {
  label: string;
  current: number;
  trend?: 'up' | 'down';
  unit: string;
}

const TrendCard: React.FC<TrendCardProps> = ({ label, current, trend, unit }) => (
  <div className="trend-card">
    <div className="trend-label">{label}</div>
    <div className="trend-value">{current.toFixed(1)}{unit}</div>
    {trend && (
      <div className={`trend-indicator ${trend}`}>
        {trend === 'up' ? '↑' : '↓'} {trend === 'up' ? 'Improving' : 'Declining'}
      </div>
    )}
    <style>{`
      .trend-card {
        background: rgba(255, 255, 255, 0.15);
        padding: 16px;
        border-radius: 8px;
      }

      .trend-label {
        font-size: 12px;
        opacity: 0.8;
        margin-bottom: 8px;
      }

      .trend-value {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 8px;
      }

      .trend-indicator {
        font-size: 12px;
        font-weight: 600;
      }

      .trend-indicator.up {
        color: #10b981;
      }

      .trend-indicator.down {
        color: #ef4444;
      }
    `}</style>
  </div>
);

export default NotificationsDashboard;
