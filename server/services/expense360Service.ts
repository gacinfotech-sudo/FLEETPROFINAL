import { Booking, Expense } from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 6: EXPENSE 360 SERVICE (Simplified)
 */

export async function getExpense360(
  tenantId: string | mongoose.Types.ObjectId,
  startDate?: Date,
  endDate?: Date
): Promise<any> {
  const start = startDate || new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate || new Date();

  const [bookings, expenses] = await Promise.all([
    Booking.find({ tenantId, createdAt: { $gte: start, $lte: end }, status: 'completed' }),
    Expense.find({ tenantId, createdAt: { $gte: start, $lte: end } })
  ]);

  const totalRevenue = bookings.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const profit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  return {
    period: { startDate: start, endDate: end, days: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) },
    revenue: { totalBookings: bookings.length, completedBookings: bookings.length, totalAmount: totalRevenue },
    expenses: [{ category: 'General', amount: totalExpenses, percentage: 100, count: expenses.length }],
    profitability: { totalRevenue, totalExpenses, grossProfit: profit, profitMargin: Math.round(profitMargin * 100) / 100 },
    alerts: profitMargin < 10 ? [{ type: 'profitability', message: 'Low profit margin', severity: 'high' }] : []
  };
}
