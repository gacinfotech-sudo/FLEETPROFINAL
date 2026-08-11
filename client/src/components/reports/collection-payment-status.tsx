"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AnalyticsDrilldownDrawer, SummaryMetric } from "./analytics-drilldown-drawer"
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts"
import { DollarSign, AlertCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Payment status types for the donut chart and categorization
 */
export type PaymentStatus = "paid" | "partial" | "pending" | "overdue"

/**
 * Collection status for collection cards
 */
export type CollectionStatusType = "total" | "collected" | "pending" | "overdue"

/**
 * Booking data structure passed from parent
 */
export interface Booking {
  id: string
  bookingReference: string
  bookingValue: number
  collectedAmount: number
  pendingAmount: number
  paymentStatus: PaymentStatus
  customerName?: string
  bookingDate?: string
  startDate?: string
  endDate?: string
}

/**
 * Props for CollectionStatus component
 */
export interface CollectionStatusProps {
  bookings: Booking[]
  isLoading?: boolean
  onCollectionCardClick?: (type: CollectionStatusType) => void
}

/**
 * Props for PaymentStatusChart component
 */
export interface PaymentStatusChartProps {
  bookings: Booking[]
  isLoading?: boolean
  onPaymentStatusClick?: (status: PaymentStatus) => void
}

/**
 * Combined collection and payment status props
 */
export interface CollectionPaymentStatusProps {
  bookings: Booking[]
  isLoading?: boolean
}

/**
 * Calculate collection metrics from bookings
 */
const calculateMetrics = (bookings: Booking[]) => {
  const total = bookings.reduce((sum, b) => sum + b.bookingValue, 0)
  const collected = bookings.reduce((sum, b) => sum + b.collectedAmount, 0)
  const pending = bookings.reduce((sum, b) => sum + b.pendingAmount, 0)
  const overdue = bookings
    .filter((b) => b.paymentStatus === "overdue")
    .reduce((sum, b) => sum + b.pendingAmount, 0)

  return { total, collected, pending, overdue }
}

/**
 * Prepare data for payment status donut chart
 */
const preparePaymentChartData = (bookings: Booking[]) => {
  const statusCounts: Record<PaymentStatus, number> = {
    paid: 0,
    partial: 0,
    pending: 0,
    overdue: 0,
  }

  let paidAmount = 0
  let partialAmount = 0
  let pendingAmount = 0
  let overdueAmount = 0

  bookings.forEach((booking) => {
    statusCounts[booking.paymentStatus]++

    if (booking.paymentStatus === "paid") {
      paidAmount += booking.bookingValue
    } else if (booking.paymentStatus === "partial") {
      partialAmount += booking.collectedAmount
    } else if (booking.paymentStatus === "pending") {
      pendingAmount += booking.pendingAmount
    } else if (booking.paymentStatus === "overdue") {
      overdueAmount += booking.pendingAmount
    }
  })

  return [
    {
      name: "Paid",
      value: paidAmount,
      count: statusCounts.paid,
      status: "paid" as PaymentStatus,
    },
    {
      name: "Partial",
      value: partialAmount,
      count: statusCounts.partial,
      status: "partial" as PaymentStatus,
    },
    {
      name: "Pending",
      value: pendingAmount,
      count: statusCounts.pending,
      status: "pending" as PaymentStatus,
    },
    {
      name: "Overdue",
      value: overdueAmount,
      count: statusCounts.overdue,
      status: "overdue" as PaymentStatus,
    },
  ].filter((item) => item.value > 0)
}

/**
 * Format currency value
 */
const formatCurrency = (amount: number): string => {
  return `Rs ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

/**
 * CollectionStatus component - displays KPI cards for collection metrics
 *
 * Features:
 * - 4 KPI-style cards: Total Booking Value, Collected, Pending, Overdue
 * - Progress bar showing collection percentage
 * - Each card clickable to drill down into filtered bookings
 * - Uses AnalyticsDrilldownDrawer for detail view
 * - Responsive layout
 * - Loading and empty states
 */
export const CollectionStatus: React.FC<CollectionStatusProps> = ({
  bookings,
  isLoading = false,
  onCollectionCardClick,
}) => {
  const [openDrawer, setOpenDrawer] = useState<CollectionStatusType | null>(null)
  const [selectedBookings, setSelectedBookings] = useState<Booking[]>([])

  const metrics = calculateMetrics(bookings)
  const collectionPercentage =
    metrics.total > 0 ? (metrics.collected / metrics.total) * 100 : 0

  const handleCardClick = (type: CollectionStatusType) => {
    let filtered: Booking[] = []

    switch (type) {
      case "total":
        filtered = bookings
        break
      case "collected":
        filtered = bookings.filter((b) => b.collectedAmount > 0)
        break
      case "pending":
        filtered = bookings.filter((b) => b.pendingAmount > 0 && b.paymentStatus !== "overdue")
        break
      case "overdue":
        filtered = bookings.filter((b) => b.paymentStatus === "overdue")
        break
    }

    setSelectedBookings(filtered)
    setOpenDrawer(type)
    onCollectionCardClick?.(type)
  }

  const getDrawerTitle = (type: CollectionStatusType): string => {
    switch (type) {
      case "total":
        return "All Bookings"
      case "collected":
        return "Collected Bookings"
      case "pending":
        return "Pending Payments"
      case "overdue":
        return "Overdue Payments"
    }
  }

  const getDrawerSummary = (type: CollectionStatusType): SummaryMetric[] => {
    const filtered = selectedBookings

    return [
      {
        label: "Count",
        value: filtered.length,
      },
      {
        label: "Amount",
        value: formatCurrency(
          filtered.reduce((sum, b) => {
            if (type === "total") return sum + b.bookingValue
            if (type === "collected") return sum + b.collectedAmount
            if (type === "pending" || type === "overdue") return sum + b.pendingAmount
            return sum
          }, 0)
        ),
      },
    ]
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-24 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No bookings for this period</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Booking Value Card */}
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
            onClick={() => handleCardClick("total")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Booking Value</p>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    {formatCurrency(metrics.total)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">{bookings.length} bookings</p>
                </div>
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-950">
                    <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Collected Card */}
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:border-green-500/50"
            onClick={() => handleCardClick("collected")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Collected</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                    {formatCurrency(metrics.collected)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {collectionPercentage.toFixed(1)}% collected
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-green-100 dark:bg-green-950">
                    <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Card */}
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:border-yellow-500/50"
            onClick={() => handleCardClick("pending")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                    {formatCurrency(metrics.pending - metrics.overdue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Awaiting payment</p>
                </div>
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-yellow-100 dark:bg-yellow-950">
                    <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overdue Card */}
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:border-red-500/50"
            onClick={() => handleCardClick("overdue")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
                    {formatCurrency(metrics.overdue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Past due date</p>
                </div>
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-red-100 dark:bg-red-950">
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar Section */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Collection Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Amount Collected</span>
                <span className="text-sm font-semibold text-foreground">
                  {collectionPercentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={collectionPercentage} className="h-3" />
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{formatCurrency(metrics.collected)}</span>
                <span>{formatCurrency(metrics.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drilldown Drawer */}
      <AnalyticsDrilldownDrawer
        isOpen={openDrawer !== null}
        onClose={() => setOpenDrawer(null)}
        title={getDrawerTitle(openDrawer || "total")}
        summary={getDrawerSummary(openDrawer || "total")}
      >
        <div className="space-y-4">
          {selectedBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No bookings found</p>
            </div>
          ) : (
            selectedBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {booking.bookingReference}
                    </p>
                    {booking.customerName && (
                      <p className="text-xs text-muted-foreground mt-1">{booking.customerName}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "inline-block px-2 py-1 text-xs font-semibold rounded",
                      booking.paymentStatus === "paid" &&
                        "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
                      booking.paymentStatus === "partial" &&
                        "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
                      booking.paymentStatus === "pending" &&
                        "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
                      booking.paymentStatus === "overdue" &&
                        "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                    )}
                  >
                    {booking.paymentStatus.charAt(0).toUpperCase() +
                      booking.paymentStatus.slice(1)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Booking Value</p>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(booking.bookingValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Collected</p>
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(booking.collectedAmount)}
                    </p>
                  </div>
                  {booking.pendingAmount > 0 && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Pending</p>
                        <p className="font-semibold text-yellow-600 dark:text-yellow-400">
                          {formatCurrency(booking.pendingAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Balance %</p>
                        <p className="font-semibold text-foreground">
                          {(
                            ((booking.pendingAmount / booking.bookingValue) * 100) ||
                            0
                          ).toFixed(0)}
                          %
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {booking.bookingDate && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Booked on {new Date(booking.bookingDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </AnalyticsDrilldownDrawer>
    </>
  )
}

/**
 * PaymentStatusChart component - displays payment breakdown as donut chart
 *
 * Features:
 * - Donut/pie chart using Recharts
 * - 4 segments: Paid, Partial, Pending, Overdue
 * - Color-coded by payment status
 * - Clickable segments trigger drill-down callback
 * - Shows booking count and amount per status
 * - Theme-aware styling
 * - Responsive
 * - Loading and empty states
 */
export const PaymentStatusChart: React.FC<PaymentStatusChartProps> = ({
  bookings,
  isLoading = false,
  onPaymentStatusClick,
}) => {
  const [openDrawer, setOpenDrawer] = useState<PaymentStatus | null>(null)
  const [selectedBookings, setSelectedBookings] = useState<Booking[]>([])

  const chartData = preparePaymentChartData(bookings)

  // Color mapping for payment statuses
  const getStatusColor = (status: PaymentStatus): string => {
    switch (status) {
      case "paid":
        return "hsl(var(--success))"
      case "partial":
        return "hsl(var(--warning))"
      case "pending":
        return "hsl(var(--warning))"
      case "overdue":
        return "hsl(var(--danger))"
      default:
        return "hsl(var(--muted))"
    }
  }

  const handleSegmentClick = (status: PaymentStatus) => {
    const filtered = bookings.filter((b) => b.paymentStatus === status)
    setSelectedBookings(filtered)
    setOpenDrawer(status)
    onPaymentStatusClick?.(status)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Status</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No payment data available</p>
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Status</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No payment status data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Donut Chart */}
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                    onClick={(entry) => handleSegmentClick(entry.payload.status)}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      padding: "8px",
                    }}
                    formatter={(value) => formatCurrency(value as number)}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => {
                      const item = entry.payload
                      return `${value} (${item.count})`
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Status Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {chartData.map((item) => (
                <div
                  key={item.status}
                  onClick={() => handleSegmentClick(item.status)}
                  className={cn(
                    "p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md",
                    item.status === "paid" &&
                      "border-green-200 bg-green-50 dark:border-green-950 dark:bg-green-950/20 hover:border-green-400",
                    item.status === "partial" &&
                      "border-blue-200 bg-blue-50 dark:border-blue-950 dark:bg-blue-950/20 hover:border-blue-400",
                    item.status === "pending" &&
                      "border-yellow-200 bg-yellow-50 dark:border-yellow-950 dark:bg-yellow-950/20 hover:border-yellow-400",
                    item.status === "overdue" &&
                      "border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20 hover:border-red-400"
                  )}
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    {item.name}
                  </p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {item.count}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drilldown Drawer */}
      <AnalyticsDrilldownDrawer
        isOpen={openDrawer !== null}
        onClose={() => setOpenDrawer(null)}
        title={`${openDrawer?.charAt(0).toUpperCase() || ""}${openDrawer?.slice(1) || ""} Bookings`}
        summary={[
          {
            label: "Count",
            value: selectedBookings.length,
          },
          {
            label: "Total",
            value: formatCurrency(
              selectedBookings.reduce((sum, b) => {
                if (openDrawer === "paid") return sum + b.bookingValue
                if (openDrawer === "partial") return sum + b.collectedAmount
                return sum + b.pendingAmount
              }, 0)
            ),
          },
        ]}
      >
        <div className="space-y-4">
          {selectedBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No bookings found</p>
            </div>
          ) : (
            selectedBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {booking.bookingReference}
                    </p>
                    {booking.customerName && (
                      <p className="text-xs text-muted-foreground mt-1">{booking.customerName}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "inline-block px-2 py-1 text-xs font-semibold rounded",
                      booking.paymentStatus === "paid" &&
                        "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
                      booking.paymentStatus === "partial" &&
                        "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
                      booking.paymentStatus === "pending" &&
                        "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
                      booking.paymentStatus === "overdue" &&
                        "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                    )}
                  >
                    {booking.paymentStatus.charAt(0).toUpperCase() +
                      booking.paymentStatus.slice(1)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Booking Value</p>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(booking.bookingValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Collected</p>
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(booking.collectedAmount)}
                    </p>
                  </div>
                  {booking.pendingAmount > 0 && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Pending</p>
                        <p className="font-semibold text-yellow-600 dark:text-yellow-400">
                          {formatCurrency(booking.pendingAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Balance %</p>
                        <p className="font-semibold text-foreground">
                          {(
                            ((booking.pendingAmount / booking.bookingValue) * 100) ||
                            0
                          ).toFixed(0)}
                          %
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {booking.bookingDate && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Booked on {new Date(booking.bookingDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </AnalyticsDrilldownDrawer>
    </>
  )
}

/**
 * Combined collection and payment status component
 *
 * Displays both collection KPI cards with progress bar and payment status donut chart
 * Integrates drill-down capabilities for both sections
 */
export const CollectionPaymentStatus: React.FC<CollectionPaymentStatusProps> = ({
  bookings,
  isLoading = false,
}) => {
  return (
    <div className="space-y-8">
      <CollectionStatus bookings={bookings} isLoading={isLoading} />
      <PaymentStatusChart bookings={bookings} isLoading={isLoading} />
    </div>
  )
}

export default CollectionPaymentStatus
