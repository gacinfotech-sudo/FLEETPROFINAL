import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationAnalyticsDashboard from '../NotificationAnalyticsDashboard';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

const mockSummaryData = {
  success: true,
  metrics: {
    totalSent: 1000,
    totalDelivered: 950,
    totalOpened: 850,
    totalBounced: 20,
    totalFailed: 30,
    deliveryRate: 95,
    clickThroughRate: 89.47,
    bounceRate: 2,
    averageDeliveryTime: 250,
  },
};

const mockChannelData = {
  success: true,
  channels: [
    {
      channel: 'email',
      totalSent: 500,
      totalDelivered: 480,
      totalFailed: 15,
      totalBounced: 5,
      totalOpened: 450,
      deliveryRate: 96,
      bounceRate: 1,
      clickThroughRate: 93.75,
      averageDeliveryTime: 200,
    },
    {
      channel: 'sms',
      totalSent: 300,
      totalDelivered: 290,
      totalFailed: 10,
      totalBounced: 0,
      totalOpened: 270,
      deliveryRate: 96.67,
      bounceRate: 0,
      clickThroughRate: 93.1,
      averageDeliveryTime: 150,
    },
    {
      channel: 'push',
      totalSent: 200,
      totalDelivered: 180,
      totalFailed: 5,
      totalBounced: 15,
      totalOpened: 130,
      deliveryRate: 90,
      bounceRate: 7.5,
      clickThroughRate: 72.22,
      averageDeliveryTime: 350,
    },
  ],
};

const mockEventTypeData = {
  success: true,
  eventTypes: [
    {
      eventType: 'booking_confirmation',
      totalSent: 600,
      totalDelivered: 570,
      totalFailed: 25,
      totalOpened: 500,
      deliveryRate: 95,
      clickThroughRate: 87.72,
    },
    {
      eventType: 'payment_alert',
      totalSent: 300,
      totalDelivered: 285,
      totalFailed: 10,
      totalOpened: 250,
      deliveryRate: 95,
      clickThroughRate: 87.72,
    },
    {
      eventType: 'reminder',
      totalSent: 100,
      totalDelivered: 95,
      totalFailed: 5,
      totalOpened: 100,
      deliveryRate: 95,
      clickThroughRate: 100,
    },
  ],
};

const mockTrendData = {
  success: true,
  trend: [
    {
      date: '2024-01-01',
      sent: 150,
      delivered: 142,
      opened: 130,
      clicked: 120,
      bounced: 3,
      failed: 5,
    },
    {
      date: '2024-01-02',
      sent: 160,
      delivered: 152,
      opened: 140,
      clicked: 130,
      bounced: 2,
      failed: 6,
    },
    {
      date: '2024-01-03',
      sent: 170,
      delivered: 161,
      opened: 150,
      clicked: 140,
      bounced: 4,
      failed: 5,
    },
  ],
};

const mockUserEngagementData = {
  success: true,
  users: [
    {
      userId: 'user-1',
      totalReceived: 100,
      totalOpened: 95,
      totalClicked: 85,
      engagementRate: 85,
      lastEngagedAt: '2024-01-03T10:00:00Z',
    },
    {
      userId: 'user-2',
      totalReceived: 80,
      totalOpened: 70,
      totalClicked: 60,
      engagementRate: 75,
      lastEngagedAt: '2024-01-02T15:00:00Z',
    },
    {
      userId: 'user-3',
      totalReceived: 60,
      totalOpened: 45,
      totalClicked: 30,
      engagementRate: 50,
      lastEngagedAt: '2024-01-01T12:00:00Z',
    },
  ],
};

const mockPeakHoursData = {
  success: true,
  hourlyData: Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    hourLabel: `${i.toString().padStart(2, '0')}:00`,
    notifications: Math.floor(Math.random() * 100),
    clicks: Math.floor(Math.random() * 50),
    engagementRate: (Math.random() * 100).toFixed(2),
  })),
};

describe('NotificationAnalyticsDashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.clearAllMocks();

    // Setup default mock responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSummaryData),
        });
      }
      if (url.includes('/by-channel')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockChannelData),
        });
      }
      if (url.includes('/by-event-type')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEventTypeData),
        });
      }
      if (url.includes('/engagement-trend')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTrendData),
        });
      }
      if (url.includes('/user-engagement')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUserEngagementData),
        });
      }
      if (url.includes('/peak-hours')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPeakHoursData),
        });
      }
      return Promise.reject(new Error(`Unmocked URL: ${url}`));
    });
  });

  it('should render the dashboard', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    expect(screen.getByText('Real-time notification delivery and engagement metrics')).toBeInTheDocument();
  });

  it('should display summary stats', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Total Sent')).toBeInTheDocument();
      expect(screen.getByText('Delivered')).toBeInTheDocument();
      expect(screen.getByText('Opened')).toBeInTheDocument();
      expect(screen.getByText('Clicked')).toBeInTheDocument();
      expect(screen.getByText('Bounced')).toBeInTheDocument();
    });
  });

  it('should render period selector', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    const selector = screen.getByRole('combobox');
    expect(selector).toBeInTheDocument();

    fireEvent.click(selector);
    await waitFor(() => {
      expect(screen.getByText('Last 24 Hours')).toBeInTheDocument();
      expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
      expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
      expect(screen.getByText('Last 90 Days')).toBeInTheDocument();
    });
  });

  it('should render chart components', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Delivery Success Rate')).toBeInTheDocument();
      expect(screen.getByText('Channel Comparison')).toBeInTheDocument();
      expect(screen.getByText('Event Type Distribution')).toBeInTheDocument();
      expect(screen.getByText('Peak Engagement Hours')).toBeInTheDocument();
    });
  });

  it('should display channel performance table', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Channel Performance Details')).toBeInTheDocument();
      expect(screen.getByText('email')).toBeInTheDocument();
      expect(screen.getByText('sms')).toBeInTheDocument();
      expect(screen.getByText('push')).toBeInTheDocument();
    });
  });

  it('should display event type performance table', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Event Type Performance')).toBeInTheDocument();
      expect(screen.getByText('booking_confirmation')).toBeInTheDocument();
      expect(screen.getByText('payment_alert')).toBeInTheDocument();
    });
  });

  it('should display top engaged users table', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Top Engaged Users')).toBeInTheDocument();
      expect(screen.getByText('user-1')).toBeInTheDocument();
      expect(screen.getByText('user-2')).toBeInTheDocument();
      expect(screen.getByText('user-3')).toBeInTheDocument();
    });
  });

  it('should have export functionality', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const csvButton = screen.getByText('CSV');
      const jsonButton = screen.getByText('JSON');

      expect(csvButton).toBeInTheDocument();
      expect(jsonButton).toBeInTheDocument();
    });
  });

  it('should have refresh button', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeInTheDocument();
  });

  it('should have auto-refresh toggle', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    const autoRefreshButton = screen.getByText(/auto-refresh/i);
    expect(autoRefreshButton).toBeInTheDocument();
  });

  it('should change period when selector changes', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    const selector = screen.getByRole('combobox');
    fireEvent.click(selector);

    await waitFor(() => {
      const thirtyDayOption = screen.getByText('Last 30 Days');
      fireEvent.click(thirtyDayOption);
    });

    await waitFor(() => {
      expect((global.fetch as any).mock.calls.some((call: any[]) =>
        call[0].includes('period=30d')
      )).toBe(true);
    });
  });

  it('should display metrics with correct values', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Check if summary metrics are displayed
      expect(screen.getByText('1000')).toBeInTheDocument(); // totalSent
      expect(screen.getByText('950')).toBeInTheDocument(); // totalDelivered
    });
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));

    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    // Component should still render without crashing
    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });
  });

  it('should have responsive layout', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('grid');
  });

  it('should calculate and display delivery rate percentage', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationAnalyticsDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // 95% delivery rate
      const deliveryRateText = screen.getByText('95%');
      expect(deliveryRateText).toBeInTheDocument();
    });
  });
});
