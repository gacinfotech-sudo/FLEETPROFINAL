import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get CSS variable value from document
 */
function getCSSVariableValue(variableName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    variableName
  );
  return value.trim();
}

/**
 * Convert HSL string to usable color format
 */
function hslToRgb(hsl: string): string {
  // For Recharts, we can use the HSL string directly if it's properly formatted
  // Return as-is for CSS variable reference
  return `hsl(${hsl})`;
}

/**
 * Format currency value with Indian rupee symbol
 */
export function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

/**
 * Get chart colors from theme CSS variables
 */
function getChartColors(): {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  success: string;
  danger: string;
} {
  // Use hardcoded HSL values that match the CSS variables
  // This ensures consistent rendering across browser contexts
  return {
    chart1: "#FF7F50", // Chart 1 - Orange (hsl(12, 76%, 61%))
    chart2: "#22997C", // Chart 2 - Teal (hsl(173, 58%, 39%))
    chart3: "#2D5A6F", // Chart 3 - Dark blue (hsl(197, 37%, 24%))
    chart4: "#D4B842", // Chart 4 - Gold (hsl(43, 74%, 66%))
    chart5: "#E8885F", // Chart 5 - Salmon (hsl(27, 87%, 67%))
    success: "#22C55E", // Green for revenue
    danger: "#EF4444", // Red for expenses
  };
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface VehicleTypeData {
  type: string;
  revenue: number;
}

export interface BookingTypeData {
  type: string;
  revenue: number;
}

export interface ExpenseCategoryData {
  category: string;
  amount: number;
}

// ============================================================================
// Custom Tooltip Components
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; fill?: string }>;
  label?: string;
}

const RevenueTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-sm font-semibold text-card-foreground">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color || entry.fill }} className="text-sm">
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const BarTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-sm font-semibold text-card-foreground">{label}</p>
        <p style={{ color: payload[0].color || payload[0].fill }} className="text-sm">
          {payload[0].name}: {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

const PieTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; percent?: number; color?: string; fill?: string }>;
}> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const percent = data.percent ? (data.percent * 100).toFixed(1) : "0";
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-sm font-semibold text-card-foreground">
          {data.name}
        </p>
        <p style={{ color: data.color || data.fill }} className="text-sm">
          {formatCurrency(data.value)}
        </p>
        <p className="text-xs text-muted-foreground">{percent}%</p>
      </div>
    );
  }
  return null;
};

// ============================================================================
// RevenueOverviewChart Component
// ============================================================================

export interface RevenueOverviewChartProps {
  data: RevenueDataPoint[];
  period: "daily" | "weekly" | "monthly";
  onPeriodChange: (period: "daily" | "weekly" | "monthly") => void;
  visibleLines: {
    revenue: boolean;
    expenses: boolean;
    profit: boolean;
  };
  onLineToggle: (line: "revenue" | "expenses" | "profit") => void;
  onPointClick?: (date: string) => void;
  isLoading?: boolean;
}

export const RevenueOverviewChart: React.FC<RevenueOverviewChartProps> = ({
  data,
  period,
  onPeriodChange,
  visibleLines,
  onLineToggle,
  onPointClick,
  isLoading = false,
}) => {
  const colors = getChartColors();

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No data for this period
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">
            Revenue Overview
          </h3>
          <p className="text-sm text-muted-foreground">
            Revenue, Expenses & Profit Trends
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["daily", "weekly", "monthly"] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => onPeriodChange(p)}
              className="capitalize"
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {[
          { key: "revenue", label: "Revenue", color: colors.success },
          { key: "expenses", label: "Expenses", color: colors.danger },
          { key: "profit", label: "Net Profit", color: colors.chart2 },
        ].map(({ key, label, color }) => (
          <Button
            key={key}
            variant={visibleLines[key as keyof typeof visibleLines] ? "default" : "outline"}
            size="sm"
            onClick={() => onLineToggle(key as "revenue" | "expenses" | "profit")}
            style={
              visibleLines[key as keyof typeof visibleLines]
                ? { backgroundColor: color, borderColor: color }
                : {}
            }
          >
            <div
              className="mr-2 h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            {label}
          </Button>
        ))}
      </div>

      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} onClick={(state) => {
            if (state && state.activeLabel && onPointClick) {
              onPointClick(state.activeLabel);
            }
          }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="var(--muted-foreground)"
              style={{ fontSize: "12px" }}
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              style={{ fontSize: "12px" }}
              tick={{ fill: "var(--muted-foreground)" }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip content={<RevenueTooltip />} />
            <Legend
              wrapperStyle={{ color: "var(--foreground)" }}
              contentStyleType="object"
            />
            {visibleLines.revenue && (
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={colors.success}
                fill={colors.success}
                fillOpacity={0.1}
                name="Revenue"
                isAnimationActive={true}
              />
            )}
            {visibleLines.expenses && (
              <Area
                type="monotone"
                dataKey="expenses"
                stroke={colors.danger}
                fill={colors.danger}
                fillOpacity={0.1}
                name="Expenses"
                isAnimationActive={true}
              />
            )}
            {visibleLines.profit && (
              <Line
                type="monotone"
                dataKey="profit"
                stroke={colors.chart2}
                strokeWidth={2}
                dot={false}
                name="Net Profit"
                isAnimationActive={true}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: Click on period buttons to filter by day, week, or month. Toggle lines to show/hide data series.
      </p>
    </div>
  );
};

// ============================================================================
// RevenueByVehicleChart Component
// ============================================================================

export interface RevenueByVehicleChartProps {
  data: VehicleTypeData[];
  onVehicleTypeClick?: (vehicleType: string) => void;
  isLoading?: boolean;
}

export const RevenueByVehicleChart: React.FC<RevenueByVehicleChartProps> = ({
  data,
  onVehicleTypeClick,
  isLoading = false,
}) => {
  const colors = getChartColors();

  if (isLoading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No data for this period
          </p>
        </div>
      </div>
    );
  }

  // Sort by revenue descending
  const sortedData = [...data].sort((a, b) => b.revenue - a.revenue);

  // Use gradient colors for bars
  const chartColors = [
    colors.chart1,
    colors.chart2,
    colors.chart3,
    colors.chart4,
    colors.chart5,
    colors.success,
  ];

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h3 className="text-lg font-semibold text-card-foreground">
          Revenue by Vehicle Type
        </h3>
        <p className="text-sm text-muted-foreground">
          Sorted by revenue (highest to lowest)
        </p>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
            onClick={(state) => {
              if (state && state.activeTooltipIndex !== undefined && onVehicleTypeClick) {
                onVehicleTypeClick(sortedData[state.activeTooltipIndex].type);
              }
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              horizontal={true}
              vertical={false}
            />
            <XAxis
              type="number"
              stroke="var(--muted-foreground)"
              style={{ fontSize: "12px" }}
              tick={{ fill: "var(--muted-foreground)" }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            />
            <YAxis
              type="category"
              dataKey="type"
              stroke="var(--muted-foreground)"
              style={{ fontSize: "12px" }}
              tick={{ fill: "var(--muted-foreground)" }}
              width={140}
            />
            <Tooltip content={<BarTooltip />} />
            <Bar
              dataKey="revenue"
              fill={colors.success}
              radius={[0, 8, 8, 0]}
              isAnimationActive={true}
            >
              {sortedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={chartColors[index % chartColors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: Click on a bar to drill down and view details for that vehicle type.
      </p>
    </div>
  );
};

// ============================================================================
// RevenueByBookingTypeChart Component
// ============================================================================

export interface RevenueByBookingTypeChartProps {
  data: BookingTypeData[];
  onBookingTypeClick?: (type: string) => void;
  isLoading?: boolean;
}

export const RevenueByBookingTypeChart: React.FC<
  RevenueByBookingTypeChartProps
> = ({ data, onBookingTypeClick, isLoading = false }) => {
  const colors = getChartColors();

  if (isLoading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No data for this period
          </p>
        </div>
      </div>
    );
  }

  const chartColors = [
    colors.chart1,
    colors.chart2,
    colors.chart3,
    colors.chart4,
    colors.chart5,
    colors.success,
  ];

  const handleClick = (entry: any) => {
    if (onBookingTypeClick) {
      onBookingTypeClick(entry.type);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h3 className="text-lg font-semibold text-card-foreground">
          Revenue by Booking Type
        </h3>
        <p className="text-sm text-muted-foreground">
          Donut chart showing revenue distribution
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ type, percent }) =>
                    `${type} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  innerRadius={40}
                  fill="#8884d8"
                  dataKey="revenue"
                  onClick={handleClick}
                  animationDuration={400}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 lg:min-w-max">
          {data.map((entry, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted transition-colors cursor-pointer"
              onClick={() => handleClick(entry)}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor: chartColors[index % chartColors.length],
                }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-card-foreground">
                  {entry.type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(entry.revenue)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: Click on a segment to filter data by booking type.
      </p>
    </div>
  );
};

// ============================================================================
// ExpenseBreakdownChart Component
// ============================================================================

export interface ExpenseBreakdownChartProps {
  data: ExpenseCategoryData[];
  onExpenseCategoryClick?: (category: string) => void;
  isLoading?: boolean;
}

export const ExpenseBreakdownChart: React.FC<ExpenseBreakdownChartProps> = ({
  data,
  onExpenseCategoryClick,
  isLoading = false,
}) => {
  const colors = getChartColors();

  if (isLoading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No data for this period
          </p>
        </div>
      </div>
    );
  }

  const chartColors = [
    colors.chart1,
    colors.chart2,
    colors.chart3,
    colors.chart4,
    colors.chart5,
    colors.danger,
  ];

  const handleClick = (entry: any) => {
    if (onExpenseCategoryClick) {
      onExpenseCategoryClick(entry.category);
    }
  };

  // Calculate total for percentage
  const total = data.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h3 className="text-lg font-semibold text-card-foreground">
          Expense Breakdown
        </h3>
        <p className="text-sm text-muted-foreground">
          Distribution across expense categories
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percent }) =>
                    `${category} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  innerRadius={40}
                  fill="#8884d8"
                  dataKey="amount"
                  onClick={handleClick}
                  animationDuration={400}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 lg:min-w-max">
          {data.map((entry, index) => {
            const percentage = ((entry.amount / total) * 100).toFixed(1);
            return (
              <div
                key={index}
                className="flex flex-col gap-1 rounded-lg p-3 hover:bg-muted transition-colors cursor-pointer"
                onClick={() => handleClick(entry)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: chartColors[index % chartColors.length],
                    }}
                  />
                  <p className="text-sm font-medium text-card-foreground">
                    {entry.category}
                  </p>
                </div>
                <div className="ml-5 flex items-end gap-2">
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(entry.amount)}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {percentage}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg bg-muted p-3">
        <p className="text-sm font-semibold text-card-foreground">
          Total Expenses
        </p>
        <p className="text-lg font-bold text-destructive">
          {formatCurrency(total)}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: Click on a category to drill down and view expense details.
      </p>
    </div>
  );
};
