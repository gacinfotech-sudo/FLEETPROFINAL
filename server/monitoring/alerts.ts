export interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  condition: string;
  threshold: number;
  triggered: boolean;
  lastTriggeredAt?: number;
  enabled: boolean;
}

export interface AlertConfig {
  alerts: Alert[];
}

export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private alertHistory: Array<{ alert: Alert; triggeredAt: number }> = [];

  constructor() {
    this.initializeDefaultAlerts();
  }

  private initializeDefaultAlerts() {
    const defaults: Alert[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        severity: 'critical',
        condition: 'errorRate > 5',
        threshold: 5,
        triggered: false,
        enabled: true
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        severity: 'high',
        condition: 'memoryPercentage > 85',
        threshold: 85,
        triggered: false,
        enabled: true
      },
      {
        id: 'slow-response-time',
        name: 'Slow Response Time',
        severity: 'high',
        condition: 'avgResponseTime > 1000',
        threshold: 1000,
        triggered: false,
        enabled: true
      },
      {
        id: 'database-unavailable',
        name: 'Database Unavailable',
        severity: 'critical',
        condition: 'databaseStatus === error',
        threshold: 0,
        triggered: false,
        enabled: true
      },
      {
        id: 'high-request-queue',
        name: 'High Request Queue',
        severity: 'medium',
        condition: 'queueLength > 100',
        threshold: 100,
        triggered: false,
        enabled: true
      }
    ];

    defaults.forEach(alert => {
      this.alerts.set(alert.id, alert);
    });
  }

  checkAlert(alertId: string, currentValue: number): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || !alert.enabled) return false;

    const shouldTrigger = currentValue > alert.threshold;

    if (shouldTrigger && !alert.triggered) {
      alert.triggered = true;
      alert.lastTriggeredAt = Date.now();
      this.alertHistory.push({ alert, triggeredAt: Date.now() });
      return true;
    } else if (!shouldTrigger && alert.triggered) {
      alert.triggered = false;
    }

    return alert.triggered;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => a.triggered);
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  getAlertHistory(limit: number = 100): Array<{ alert: Alert; triggeredAt: number }> {
    return this.alertHistory.slice(-limit);
  }

  disableAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.enabled = false;
    }
  }

  enableAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.enabled = true;
    }
  }

  clearAlerts() {
    this.alerts.forEach(alert => {
      alert.triggered = false;
    });
  }
}
