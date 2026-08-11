// FASTag per-vehicle support (TASK-VEHICLE-FUEL-EXPENSE-04, Section 14).
// Per VEHICLE-REAL-WORLD-RESEARCH.md §2: NPCI does not expose an
// unrestricted generic public API — access goes through NPCI-authorized
// intermediaries/bank partners (Setu, ZuelPay, bank developer portals).
// This module is therefore provider-swappable by construction, mirroring
// server/gps/providers/adapter.ts's exact pattern, never a hard-coded NPCI
// client.

export interface FastagConnectionTestResult {
  success: boolean;
  status: 'connected' | 'authentication_failed' | 'provider_unavailable';
  checkedAt: Date;
  latencyMs?: number;
}

export interface FastagBalance {
  tagId: string;
  balance: number;
  currency: 'INR';
  asOf: Date;
}

export interface FastagTransaction {
  tagId: string;
  providerTransactionId: string;
  tollPlazaName?: string;
  amount: number;
  timestamp: Date;
}

export interface FastagConnectionConfig {
  id: string;
  tenantId: string;
  connectionName: string;
  providerKey: string;
  enabled: boolean;
  secrets: Record<string, unknown>;
}
