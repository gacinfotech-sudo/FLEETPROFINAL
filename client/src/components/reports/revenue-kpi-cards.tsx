"use client"

import * as React from "react"
import {
  DollarSign,
  TrendingUp,
  Car,
  BarChart3,
  Activity,
  PieChart,
  Target,
  ShoppingCart,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AnalyticsDrilldownDrawer, SummaryMetric } from "@/components/reports/analytics-drilldown-drawer"

/**
 * Summary data format for KPI card drill-down
 */
export interface KPISummaryData {
  label: string
  value: string | number
  icon?: React.ReactNode
}

/**
 * Props for the KPICard component
 */
export interface KPICardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  subtext?: string | number
  onCardClick?: () => void
  summaryData?: KPISummaryData[]
  isLoading?: boolean
  colorClass?: "primary" | "success" | "warning" | "danger" | "neutral"
  drawerId?: string
  children?: React.ReactNode
  showArrow?: boolean
}

/**
 * Reusable KPI Card component with hover effects and drill-down capability
 */
export const KPICard = React.forwardRef<HTMLDivElement, KPICardProps>(
  (
    {
      title,
      value,
      icon,
      subtext,
      onCardClick,
      summaryData,
      isLoading = false,
      colorClass = "neutral",
      drawerId,
      children,
      showArrow = true,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false)

    const handleCardClick = () => {
      setIsOpen(true)
      onCardClick?.()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleCardClick()
      }
    }

    // Color class mappings for different metric types
    const iconColorMap = {
      primary: "text-blue-500",
      success: "text-green-500",
      warning: "text-amber-500",
      danger: "text-red-500",
      neutral: "text-slate-500",
    }

    const borderColorMap = {
      primary: "hover:border-blue-400",
      success: "hover:border-green-400",
      warning: "hover:border-amber-400",
      danger: "hover:border-red-400",
      neutral: "hover:border-slate-300",
    }

    const accentColorMap = {
      primary: "group-hover:shadow-blue-500/20",
      success: "group-hover:shadow-green-500/20",
      warning: "group-hover:shadow-amber-500/20",
      danger: "group-hover:shadow-red-500/20",
      neutral: "group-hover:shadow-slate-500/20",
    }

    return (
      <>
        <div
          ref={ref}
          className={cn(
            "group relative rounded-lg border bg-card text-card-foreground shadow-sm",
            "transition-all duration-300 ease-out",
            "hover:shadow-lg hover:shadow-slate-500/10",
            borderColorMap[colorClass],
            accentColorMap[colorClass],
            summaryData || onCardClick ? "cursor-pointer hover:border-slate-300" : "",
            "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
          )}
          onClick={handleCardClick}
          onKeyDown={handleKeyDown}
          tabIndex={summaryData || onCardClick ? 0 : -1}
          role={summaryData || onCardClick ? "button" : "region"}
          aria-label={`${title} KPI Card${summaryData ? ", press Enter to view details" : ""}`}
          style={{
            transform: "translate(0, 0)",
            transition: "transform 0.3s ease-out, box-shadow 0.3s ease-out",
          }}
          onMouseEnter={(e) => {
            if (summaryData || onCardClick) {
              ;(e.currentTarget as HTMLDivElement).style.transform =
                "translateY(-2px)"
            }
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLDivElement).style.transform =
              "translate(0, 0)"
          }}
        >
          {/* Loading skeleton */}
          {isLoading && (
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          )}

          <div className="p-6">
            {/* Header: Icon and Title */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground tracking-wide">
                  {title}
                </p>
              </div>
              {icon && (
                <div
                  className={cn(
                    "p-2 rounded-lg bg-muted/30 transition-colors duration-200 flex-shrink-0",
                    iconColorMap[colorClass],
                    "group-hover:bg-muted/50"
                  )}
                >
                  {icon}
                </div>
              )}
            </div>

            {/* Value */}
            <div className="space-y-2">
              <div
                className={cn(
                  "text-3xl md:text-4xl font-bold text-foreground transition-colors",
                  isLoading && "text-muted"
                )}
              >
                {isLoading ? "—" : value}
              </div>

              {/* Subtext */}
              {subtext && (
                <p className="text-xs md:text-sm text-muted-foreground">
                  {subtext}
                </p>
              )}
            </div>

            {/* View Details Arrow on Hover */}
            {(summaryData || onCardClick) && showArrow && (
              <div className="mt-4 flex items-center text-xs font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <span>View Details</span>
                <ChevronRight className="ml-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            )}

            {/* Custom children content */}
            {children && <div className="mt-4">{children}</div>}
          </div>
        </div>

        {/* Drill-down drawer */}
        {summaryData && (
          <AnalyticsDrilldownDrawer
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title={`${title} Details`}
            summary={summaryData as SummaryMetric[]}
          />
        )}
      </>
    )
  }
)

KPICard.displayName = "KPICard"

/**
 * Pre-configured cards for common KPIs
 */

export interface CardDataProps {
  title: string
  value: string | number
  subtext?: string | number
  summaryData?: KPISummaryData[]
  isLoading?: boolean
}

export const TotalRevenueCard = React.forwardRef<HTMLDivElement, CardDataProps>(
  ({ title = "Total Revenue", value, subtext, summaryData, isLoading }, ref) => (
    <KPICard
      ref={ref}
      title={title}
      value={value}
      icon={<DollarSign className="h-5 w-5" />}
      subtext={subtext}
      colorClass="primary"
      summaryData={summaryData}
      isLoading={isLoading}
    />
  )
)

TotalRevenueCard.displayName = "TotalRevenueCard"

export const TotalExpensesCard = React.forwardRef<HTMLDivElement, CardDataProps>(
  ({ title = "Total Expenses", value, subtext, summaryData, isLoading }, ref) => (
    <KPICard
      ref={ref}
      title={title}
      value={value}
      icon={<TrendingUp className="h-5 w-5" />}
      subtext={subtext}
      colorClass="warning"
      summaryData={summaryData}
      isLoading={isLoading}
    />
  )
)

TotalExpensesCard.displayName = "TotalExpensesCard"

export const NetProfitCard = React.forwardRef<HTMLDivElement, CardDataProps>(
  ({ title = "Net Profit/Loss", value, subtext, summaryData, isLoading }, ref) => {
    // Determine color based on positive/negative value
    let valueNum = 0
    if (typeof value === "string") {
      const numMatch = value.replace(/[^\d.-]/g, "")
      valueNum = parseFloat(numMatch)
    } else {
      valueNum = value as number
    }

    const colorClass = valueNum >= 0 ? "success" : "danger"

    return (
      <KPICard
        ref={ref}
        title={title}
        value={value}
        icon={<BarChart3 className="h-5 w-5" />}
        subtext={subtext}
        colorClass={colorClass}
        summaryData={summaryData}
        isLoading={isLoading}
      />
    )
  }
)

NetProfitCard.displayName = "NetProfitCard"

export const ProfitMarginCard = React.forwardRef<HTMLDivElement, CardDataProps>(
  ({ title = "Profit Margin", value, subtext, summaryData, isLoading }, ref) => (
    <KPICard
      ref={ref}
      title={title}
      value={value}
      icon={<PieChart className="h-5 w-5" />}
      subtext={subtext}
      colorClass="primary"
      summaryData={summaryData}
      isLoading={isLoading}
    />
  )
)

ProfitMarginCard.displayName = "ProfitMarginCard"

export const AverageBookingValueCard = React.forwardRef<HTMLDivElement, CardDataProps>(
  ({ title = "Avg Booking Value", value, subtext, summaryData, isLoading }, ref) => (
    <KPICard
      ref={ref}
      title={title}
      value={value}
      icon={<Activity className="h-5 w-5" />}
      subtext={subtext}
      colorClass="neutral"
      summaryData={summaryData}
      isLoading={isLoading}
    />
  )
)

AverageBookingValueCard.displayName = "AverageBookingValueCard"

export const RevenuePerVehicleCard = React.forwardRef<HTMLDivElement, CardDataProps>(
  ({ title = "Revenue Per Vehicle", value, subtext, summaryData, isLoading }, ref) => (
    <KPICard
      ref={ref}
      title={title}
      value={value}
      icon={<Car className="h-5 w-5" />}
      subtext={subtext}
      colorClass="primary"
      summaryData={summaryData}
      isLoading={isLoading}
    />
  )
)

RevenuePerVehicleCard.displayName = "RevenuePerVehicleCard"

export const FleetUtilizationCard = React.forwardRef<HTMLDivElement, CardDataProps>(
  ({ title = "Fleet Utilization", value, subtext, summaryData, isLoading }, ref) => (
    <KPICard
      ref={ref}
      title={title}
      value={value}
      icon={<Target className="h-5 w-5" />}
      subtext={subtext}
      colorClass="success"
      summaryData={summaryData}
      isLoading={isLoading}
    />
  )
)

FleetUtilizationCard.displayName = "FleetUtilizationCard"

export const TotalBookingsCard = React.forwardRef<HTMLDivElement, CardDataProps>(
  ({ title = "Total Bookings", value, subtext, summaryData, isLoading }, ref) => (
    <KPICard
      ref={ref}
      title={title}
      value={value}
      icon={<ShoppingCart className="h-5 w-5" />}
      subtext={subtext}
      colorClass="primary"
      summaryData={summaryData}
      isLoading={isLoading}
    />
  )
)

TotalBookingsCard.displayName = "TotalBookingsCard"

/**
 * Grid layout component for all KPI cards
 */
export interface KPICardsGridProps {
  totalRevenue?: CardDataProps
  totalExpenses?: CardDataProps
  netProfit?: CardDataProps
  profitMargin?: CardDataProps
  averageBookingValue?: CardDataProps
  revenuePerVehicle?: CardDataProps
  fleetUtilization?: CardDataProps
  totalBookings?: CardDataProps
}

export const KPICardsGrid = React.forwardRef<
  HTMLDivElement,
  KPICardsGridProps
>(
  (
    {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      averageBookingValue,
      revenuePerVehicle,
      fleetUtilization,
      totalBookings,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className="w-full grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-max"
      >
        {totalRevenue && (
          <TotalRevenueCard {...totalRevenue} />
        )}
        {totalExpenses && (
          <TotalExpensesCard {...totalExpenses} />
        )}
        {netProfit && (
          <NetProfitCard {...netProfit} />
        )}
        {profitMargin && (
          <ProfitMarginCard {...profitMargin} />
        )}
        {averageBookingValue && (
          <AverageBookingValueCard {...averageBookingValue} />
        )}
        {revenuePerVehicle && (
          <RevenuePerVehicleCard {...revenuePerVehicle} />
        )}
        {fleetUtilization && (
          <FleetUtilizationCard {...fleetUtilization} />
        )}
        {totalBookings && (
          <TotalBookingsCard {...totalBookings} />
        )}
      </div>
    )
  }
)

KPICardsGrid.displayName = "KPICardsGrid"
