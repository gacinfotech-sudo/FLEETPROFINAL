import { useState } from "react";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Zap,
  Truck,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface MatchingResult {
  route: string;
  timestamp: Date;
  supply: {
    route: string;
    totalVehicles: number;
    availableVehicles: number;
    activeBookings: number;
    utilizationRate: number;
    expectedDowntime: number;
    avgResponseTime: number;
  };
  demand: {
    route: string;
    currentDemand: number;
    predictedDemand: number;
    peakDemand: number;
    peakTime: Date;
    demandTrend: "increasing" | "stable" | "decreasing";
  };
  matchRatio: number;
  status: "surplus" | "balanced" | "shortage" | "critical";
  shortfall: number;
  recommendations: string[];
  alerts: Array<{
    id: string;
    severity: "critical" | "warning" | "info";
    title: string;
    message: string;
  }>;
  actionItems: Array<{
    id: string;
    priority: "critical" | "high" | "medium" | "low";
    action: string;
    reason: string;
    estimatedImpact: string;
    estimatedTime: number;
  }>;
}

interface DemandSupplyDashboardProps {
  matchingResults?: MatchingResult[];
  systemMetrics?: {
    totalRoutes: number;
    balancedRoutes: number;
    shortageRoutes: number;
    criticalRoutes: number;
    avgMatchRatio: number;
    totalVehicles: number;
    totalAvailableVehicles: number;
    overallUtilization: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  surplus: "bg-green-50 border-green-200",
  balanced: "bg-blue-50 border-blue-200",
  shortage: "bg-orange-50 border-orange-200",
  critical: "bg-red-50 border-red-200",
};

const STATUS_BADGES: Record<string, string> = {
  surplus: "bg-green-100 text-green-800 border-green-300",
  balanced: "bg-blue-100 text-blue-800 border-blue-300",
  shortage: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  surplus: <TrendingDown className="h-5 w-5 text-green-600" />,
  balanced: <Activity className="h-5 w-5 text-blue-600" />,
  shortage: <AlertCircle className="h-5 w-5 text-orange-600" />,
  critical: <AlertTriangle className="h-5 w-5 text-red-600" />,
};

export default function DemandSupplyDashboard({
  matchingResults = [],
  systemMetrics = {
    totalRoutes: 0,
    balancedRoutes: 0,
    shortageRoutes: 0,
    criticalRoutes: 0,
    avgMatchRatio: 1.0,
    totalVehicles: 0,
    totalAvailableVehicles: 0,
    overallUtilization: 0,
  },
}: DemandSupplyDashboardProps) {
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const filteredResults = selectedStatus
    ? matchingResults.filter((r) => r.status === selectedStatus)
    : matchingResults;

  const metrics = systemMetrics;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">🚗 Total Vehicles</p>
              <p className="text-3xl font-bold text-blue-600">{metrics.totalVehicles}</p>
              <p className="text-xs text-gray-500 mt-1">{metrics.totalAvailableVehicles} available</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">📊 Utilization</p>
              <p className="text-3xl font-bold text-purple-600">{metrics.overallUtilization}%</p>
              <p className="text-xs text-gray-500 mt-1">fleet in use</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">✅ Balanced</p>
              <p className="text-3xl font-bold text-green-600">{metrics.balancedRoutes}</p>
              <p className="text-xs text-gray-500 mt-1">of {metrics.totalRoutes} routes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">🚨 Critical</p>
              <p className="text-3xl font-bold text-red-600">{metrics.criticalRoutes}</p>
              <p className="text-xs text-gray-500 mt-1">need immediate action</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            System Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Average Match Ratio</span>
                <Badge className="bg-blue-100 text-blue-800">{metrics.avgMatchRatio.toFixed(2)}x</Badge>
              </div>
              <Progress
                value={Math.min(100, metrics.avgMatchRatio * 50)}
                className="h-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                {metrics.avgMatchRatio >= 1
                  ? "✅ Healthy - Supply exceeds demand"
                  : "⚠️ Watch - Demand approaching supply limits"}
              </p>
            </div>

            <div className="grid grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{metrics.balancedRoutes}</p>
                <p className="text-xs text-gray-600">Balanced</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{metrics.shortageRoutes}</p>
                <p className="text-xs text-gray-600">Shortage</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{metrics.shortageRoutes}</p>
                <p className="text-xs text-gray-600">Watch</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{metrics.criticalRoutes}</p>
                <p className="text-xs text-gray-600">Critical</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={!selectedStatus ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedStatus(null)}
        >
          All Routes ({matchingResults.length})
        </Button>
        <Button
          variant={selectedStatus === "balanced" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedStatus("balanced")}
        >
          ✅ Balanced ({matchingResults.filter((r) => r.status === "balanced").length})
        </Button>
        <Button
          variant={selectedStatus === "shortage" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedStatus("shortage")}
        >
          ⚠️ Shortage ({matchingResults.filter((r) => r.status === "shortage").length})
        </Button>
        <Button
          variant={selectedStatus === "critical" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedStatus("critical")}
        >
          🚨 Critical ({matchingResults.filter((r) => r.status === "critical").length})
        </Button>
        <Button
          variant={selectedStatus === "surplus" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedStatus("surplus")}
        >
          📈 Surplus ({matchingResults.filter((r) => r.status === "surplus").length})
        </Button>
      </div>

      {/* Routes List */}
      <div className="space-y-3">
        {filteredResults.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No routes in this category</p>
            </CardContent>
          </Card>
        ) : (
          filteredResults.map((result) => {
            const isExpanded = expandedRoute === result.route;

            return (
              <Card
                key={result.route}
                className={`border-2 transition-all ${STATUS_COLORS[result.status]}`}
              >
                <CardContent className="pt-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">{STATUS_ICONS[result.status]}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {result.route}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Last updated: {new Date(result.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_BADGES[result.status]}>
                        {result.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Supply vs Demand */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-white rounded border">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Supply</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">
                        {result.supply.availableVehicles}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        of {result.supply.totalVehicles} available
                      </p>
                      <Progress
                        value={(result.supply.availableVehicles / result.supply.totalVehicles) * 100}
                        className="h-1.5 mt-2"
                      />
                    </div>

                    <div className="p-3 bg-white rounded border">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium">Demand</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">
                        {result.demand.predictedDemand}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        bookings (predicted 1-2h)
                      </p>
                      <Progress value={75} className="h-1.5 mt-2" />
                    </div>
                  </div>

                  {/* Match Ratio */}
                  <div className="mb-4 p-3 bg-white rounded border">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Match Ratio</label>
                      <span
                        className={`font-bold ${
                          result.matchRatio >= 1 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {result.matchRatio.toFixed(2)}x
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, result.matchRatio * 50)}
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {result.shortfall > 0
                        ? `⚠️ Shortage: ${result.shortfall} vehicles needed`
                        : `✅ Surplus: ${Math.abs(result.shortfall)} vehicles available`}
                    </p>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-gray-50 rounded">
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Utilization</p>
                      <p className="text-sm font-bold text-gray-900">
                        {result.supply.utilizationRate.toFixed(0)}%
                      </p>
                    </div>
                    <div className="text-center border-l border-r">
                      <p className="text-xs text-gray-600">Response Time</p>
                      <p className="text-sm font-bold text-gray-900">
                        {result.supply.avgResponseTime}m
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Trend</p>
                      <p className="text-sm font-bold text-gray-900">
                        {result.demand.demandTrend === "increasing" ? "↗" : result.demand.demandTrend === "decreasing" ? "↘" : "→"}
                      </p>
                    </div>
                  </div>

                  {/* Alerts Section */}
                  {result.alerts.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {result.alerts.slice(0, 2).map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-2 rounded border text-sm ${
                            alert.severity === "critical"
                              ? "bg-red-50 border-red-200 text-red-700"
                              : alert.severity === "warning"
                              ? "bg-orange-50 border-orange-200 text-orange-700"
                              : "bg-blue-50 border-blue-200 text-blue-700"
                          }`}
                        >
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-xs mt-1">{alert.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Items Preview */}
                  {result.actionItems.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        💡 Recommended Actions ({result.actionItems.length})
                      </p>
                      <ul className="space-y-1">
                        {result.actionItems.slice(0, 2).map((item) => (
                          <li
                            key={item.id}
                            className="text-xs text-blue-800 flex items-start gap-2"
                          >
                            <span className="mt-1">→</span>
                            <span>{item.action} ({item.estimatedTime}min)</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Expand Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpandedRoute(isExpanded ? null : result.route)
                    }
                    className="w-full"
                  >
                    {isExpanded ? "Hide Details" : "Show Full Analysis"}
                  </Button>

                  {/* Detailed View */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* Recommendations */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Recommendations</h4>
                        <ul className="space-y-1">
                          {result.recommendations.map((rec, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-gray-700 flex items-start gap-2"
                            >
                              <span className="text-blue-600 mt-0.5">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* All Alerts */}
                      {result.alerts.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Alerts ({result.alerts.length})</h4>
                          <div className="space-y-2">
                            {result.alerts.map((alert) => (
                              <div
                                key={alert.id}
                                className={`p-2 rounded border text-sm ${
                                  alert.severity === "critical"
                                    ? "bg-red-50 border-red-200"
                                    : alert.severity === "warning"
                                    ? "bg-orange-50 border-orange-200"
                                    : "bg-blue-50 border-blue-200"
                                }`}
                              >
                                <p className="font-medium">{alert.title}</p>
                                <p className="text-xs mt-1">{alert.message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Items */}
                      {result.actionItems.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Action Items ({result.actionItems.length})</h4>
                          <div className="space-y-2">
                            {result.actionItems.map((item) => (
                              <div
                                key={item.id}
                                className="p-3 border rounded bg-white"
                              >
                                <div className="flex items-start justify-between mb-1">
                                  <p className="font-medium text-gray-900">{item.action}</p>
                                  <Badge
                                    className={
                                      item.priority === "critical"
                                        ? "bg-red-100 text-red-800"
                                        : item.priority === "high"
                                        ? "bg-orange-100 text-orange-800"
                                        : item.priority === "medium"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-gray-100 text-gray-800"
                                    }
                                  >
                                    {item.priority}
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-600 mb-1">{item.reason}</p>
                                <p className="text-xs text-gray-700">
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {item.estimatedTime} min | Impact: {item.estimatedImpact}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
