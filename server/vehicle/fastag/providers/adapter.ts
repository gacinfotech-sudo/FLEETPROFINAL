import type { FastagBalance, FastagConnectionTestResult, FastagTransaction } from '../types';

/**
 * Mirrors server/gps/providers/adapter.ts's exact pattern: a provider-
 * agnostic interface, no assumption about which FASTag intermediary
 * (Setu, ZuelPay, a bank developer portal) a tenant connects. `rechargeTag`
 * and `linkVehicleTag` are optional — VEHICLE-REAL-WORLD-RESEARCH.md §2
 * flags real-time low-balance webhooks and exact recharge semantics as
 * "not confirmed... treat as provider-specific until a real provider is
 * chosen", so no adapter is forced to implement them.
 */
export interface FastagProviderAdapter {
  readonly providerKey: string;

  testConnection(): Promise<FastagConnectionTestResult>;
  getBalance(tagId: string): Promise<FastagBalance>;
  getTransactionHistory(tagId: string, startDate: Date, endDate: Date): Promise<FastagTransaction[]>;
  rechargeTag?(tagId: string, amount: number): Promise<{ success: boolean; providerTransactionId?: string }>;
}
