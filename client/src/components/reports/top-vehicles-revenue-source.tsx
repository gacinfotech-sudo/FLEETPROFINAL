"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AnalyticsDrilldownDrawer, SummaryMetric } from "./analytics-drilldown-drawer"
import {
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
} from "recharts"
import { TrendingUp, Car, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// Types
interface Vehicle {
  _id: string
  make: string
  model: string
  licensePlate: string
  registrationNumber?: string
}

interface TopVehicleData {
  vehicle: Vehicle
  revenue: number
  trips: number
  utilization: number // percentage 0-100
}

interface RevenueSource {
  source: string
  revenue: number
  percentage: number
  bookings: number
}

interface VehicleAnalyticsData {
  topVehicles: TopVehicleData[]
  revenueSources: RevenueSource[]
}

// Rank badge colors using theme CSS variables
const getRankBadgeClass = (rank: number): string => {
  switch (rank) {
    case 1:
      return "bg-yellow-100 text-yellow-900 border-yellow-300"
    case 2:
      return "bg-gray-100 text-gray-900 border-gray-300"
    case 3:
      return "bg-orange-100 text-orange-900 border-orange-300"
    default:
      return "bg-blue-50 text-blue-900 border-blue-200"
  }
}

// Get utilization color based on percentage
const getUtilizationColor = (utilization: number): string => {
  if (utilization >= 80) return "bg-green-500" // --success equivalent
  if (utilization >= 50) return "bg-yellow-500" // --warning equivalent
  return "bg-red-500" // --danger equivalent
}

// Chart colors - theme-aware with CSS variable fallback
const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
]

const formatCurrency = (amount: number): string => `₹${amount.toLocaleString()}`

// TopVehiclesRanking Component
interface TopVehiclesRankingProps {
  data?: TopVehicleData[]
  isLoading?: boolean
}

export function TopVehiclesRanking({
  data = [],
  isLoading = false,
}: TopVehiclesRankingProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<(TopVehicleData & { rank: number }) | null>(null)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Performing Vehicles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Performing Vehicles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No vehicle data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Top Performing Vehicles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.map((item, index) => {
              const rank = index + 1
              return (
                <button
                  key={item.vehicle._id}
                  onClick={() => setSelectedVehicle({ ...item, rank })}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border transition-all duration-200",
                    "hover:border-primary hover:shadow-md hover:bg-muted/50",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Badge className={cn("px-2.5 py-1", getRankBadgeClass(rank))}>
                        #{rank}
                      </Badge>
                      <div>
                        <p className="font-semibold text-foreground">
                          {item.vehicle.make} {item.vehicle.model}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.vehicle.licensePlate}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-green-600">
                        {formatCurrency(item.revenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.trips} trips</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className="font-medium">{item.utilization.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all", getUtilizationColor(item.utilization))}
                        style={{ width: `${Math.min(item.utilization, 100)}%` }}
                      />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Analytics Drawer */}
      {selectedVehicle && (
        <AnalyticsDrilldownDrawer
          isOpen={!!selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          title={`${selectedVehicle.vehicle.make} ${selectedVehicle.vehicle.model}`}
          summary={[
            {
              label: "Revenue",
              value: formatCurrency(selectedVehicle.revenue),
              icon: <TrendingUp className="h-4 w-4" />,
            },
            {
              label: "Trips",
              value: selectedVehicle.trips.toString(),
              icon: <Car className="h-4 w-4" />,
            },
            {
              label: "Utilization",
              value: `${selectedVehicle.utilization.toFixed(1)}%`,
            },
            {
              label: "Rank",
              value: `#${selectedVehicle.rank}`,
            },
          ]}
        >
          <div className="space-y-6">
            {/* Vehicle Details */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Vehicle Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">License Plate</p>
                  <p className="font-medium text-foreground">
                    {selectedVehicle.vehicle.licensePlate}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Make/Model</p>
                  <p className="font-medium text-foreground">
                    {selectedVehicle.vehicle.make} {selectedVehicle.vehicle.model}
                  </p>
                </div>
                {selectedVehicle.vehicle.registrationNumber && (
                  <div>
                    <p className="text-muted-foreground">Registration</p>
                    <p className="font-medium text-foreground">
                      {selectedVehicle.vehicle.registrationNumber}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Performance Metrics</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Revenue Contribution</span>
                    <span className="font-medium">{formatCurrency(selectedVehicle.revenue)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Utilization Rate</span>
                    <span className="font-medium">{selectedVehicle.utilization.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full", getUtilizationColor(selectedVehicle.utilization))}
                      style={{ width: `${Math.min(selectedVehicle.utilization, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Total Trips</span>
                    <span className="font-medium">{selectedVehicle.trips}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                This vehicle is ranked #{selectedVehicle.rank} in your fleet by revenue.
              </p>
            </div>
          </div>
        </AnalyticsDrilldownDrawer>
      )}
    </>
  )
}

// RevenueSourceChart Component
interface RevenueSourceChartProps {
  data?: RevenueSource[]
  isLoading?: boolean
  onSourceClick?: (source: string) => void
}

export function RevenueSourceChart({
  data = [],
  isLoading = false,
  onSourceClick,
}: RevenueSourceChartProps) {
  const [selectedSource, setSelectedSource] = useState<RevenueSource | null>(null)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No revenue source data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Determine chart type based on data volume
  // Use bar chart if more than 4 sources, pie chart otherwise
  const useBarChart = data.length > 4

  const handleSourceClick = (source: RevenueSource) => {
    setSelectedSource(source)
    onSourceClick?.(source.source)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Source</CardTitle>
        </CardHeader>
        <CardContent>
          {useBarChart ? (
            // Bar Chart
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="source" type="category" width={100} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar
                  dataKey="revenue"
                  onClick={(event: any) => {
                    const index = data.findIndex(d => d.source === event.source)
                    if (index >= 0) {
                      handleSourceClick(data[index])
                    }
                  }}
                  cursor="pointer"
                  fill="hsl(var(--primary))"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            // Pie Chart
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="revenue"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ source, percentage }: any) =>
                    `${source}: ${percentage?.toFixed(1)}%` || ""
                  }
                  onClick={(event: any) => {
                    const source = data.find(d => d.source === event.name)
                    if (source) {
                      handleSourceClick(source)
                    }
                  }}
                  cursor="pointer"
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* Source breakdown list */}
          <div className="mt-6 space-y-2">
            {data.map((source, index) => (
              <button
                key={source.source}
                onClick={() => handleSourceClick(source)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all duration-200",
                  "hover:border-primary hover:bg-muted/50",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                      }}
                    />
                    <div>
                      <p className="font-medium text-foreground text-sm">{source.source}</p>
                      <p className="text-xs text-muted-foreground">{source.bookings} bookings</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{formatCurrency(source.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{source.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Source Details Drawer */}
      {selectedSource && (
        <AnalyticsDrilldownDrawer
          isOpen={!!selectedSource}
          onClose={() => setSelectedSource(null)}
          title={`${selectedSource.source} Bookings`}
          summary={[
            {
              label: "Total Revenue",
              value: formatCurrency(selectedSource.revenue),
              icon: <TrendingUp className="h-4 w-4" />,
            },
            {
              label: "Bookings",
              value: selectedSource.bookings.toString(),
            },
            {
              label: "Percentage",
              value: `${selectedSource.percentage.toFixed(1)}%`,
            },
          ]}
        >
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold text-foreground mb-3">Source Performance</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue per Booking</span>
                  <span className="font-medium">
                    {formatCurrency(selectedSource.revenue / selectedSource.bookings)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Bookings</span>
                  <span className="font-medium">{selectedSource.bookings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contribution</span>
                  <span className="font-medium">{selectedSource.percentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                This source ({selectedSource.source}) represents{" "}
                {selectedSource.percentage.toFixed(1)}% of your total revenue.
              </p>
            </div>
          </div>
        </AnalyticsDrilldownDrawer>
      )}
    </>
  )
}

// Export combined component with both visualizations
interface VehicleRevenueSourceDashboardProps {
  data?: VehicleAnalyticsData
  isLoading?: boolean
  onSourceClick?: (source: string) => void
}

export function VehicleRevenueSourceDashboard({
  data,
  isLoading = false,
  onSourceClick,
}: VehicleRevenueSourceDashboardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <TopVehiclesRanking data={data?.topVehicles} isLoading={isLoading} />
      <RevenueSourceChart
        data={data?.revenueSources}
        isLoading={isLoading}
        onSourceClick={onSourceClick}
      />
    </div>
  )
}

export default VehicleRevenueSourceDashboard
