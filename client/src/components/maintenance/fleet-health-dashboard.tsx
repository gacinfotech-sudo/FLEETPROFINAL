import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Wrench,
  Zap,
  DollarSign,
  Calendar,
  Gauge,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface MaintenancePrediction {
  vehicleId: string;
  component: string;
  failureRisk: number;
  estimatedDaysToFailure: number;
  recommendedAction: "immediate" | "urgent" | "scheduled" | "monitor";
  priority: "critical" | "high" | "medium" | "low";
  estimatedCost: number;
  serviceType: string;
  reason: string;
  timestamp: Date;
}

interface FleetHealthReport {
  timestamp: Date;
  totalVehicles: number;
  healthyVehicles: number;
  warningVehicles: number;
  criticalVehicles: number;
  healthScore: number;
  averageMileage: number;
  averageAge: number;
  upcomingServices: MaintenancePrediction[];
  costProjection: {
    nextMonth: number;
    next3Months: number;
    next6Months: number;
  };
  recommendations: string[];
}

interface FleetHealthDashboardProps {
  healthReport?: FleetHealthReport;
  allPredictions?: MaintenancePrediction[];
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-gray-100 text-gray-800 border-gray-300",
};

const ACTION_COLORS: Record<string, string> = {
  immediate: "bg-red-50 border-red-200",
  urgent: "bg-orange-50 border-orange-200",
  scheduled: "bg-blue-50 border-blue-200",
  monitor: "bg-gray-50 border-gray-200",
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  immediate: <AlertTriangle className="h-5 w-5 text-red-600" />,
  urgent: <Zap className="h-5 w-5 text-orange-600" />,
  scheduled: <Calendar className="h-5 w-5 text-blue-600" />,
  monitor: <Info className="h-5 w-5 text-gray-600" />,
};

export default function FleetHealthDashboard({
  healthReport = {
    timestamp: new Date(),
    totalVehicles: 0,
    healthyVehicles: 0,
    warningVehicles: 0,
    criticalVehicles: 0,
    healthScore: 0,
    averageMileage: 0,
    averageAge: 0,
    upcomingServices: [],
    costProjection: { nextMonth: 0, next3Months: 0, next6Months: 0 },
    recommendations: [],
  },
  allPredictions = [],
}: FleetHealthDashboardProps) {
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);

  const filteredPredictions = selectedPriority
    ? allPredictions.filter((p) => p.priority === selectedPriority)
    : allPredictions;

  const report = healthReport;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">✅ Healthy</p>
              <p className="text-3xl font-bold text-green-600">{report.healthyVehicles}</p>
              <p className="text-xs text-gray-500 mt-1">of {report.totalVehicles} vehicles</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">⚠️ Warning</p>
              <p className="text-3xl font-bold text-orange-600">{report.warningVehicles}</p>
              <p className="text-xs text-gray-500 mt-1">need attention soon</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">🚨 Critical</p>
              <p className="text-3xl font-bold text-red-600">{report.criticalVehicles}</p>
              <p className="text-xs text-gray-500 mt-1">need immediate action</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">📊 Health Score</p>
              <p className="text-3xl font-bold text-purple-600">{report.healthScore}%</p>
              <p className="text-xs text-gray-500 mt-1">fleet condition</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Overview */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-indigo-600" />
            Fleet Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fleet Health */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Overall Health</span>
                <Badge className="bg-blue-100 text-blue-800">{report.healthScore}%</Badge>
              </div>
              <Progress value={report.healthScore} className="h-3" />
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{report.healthyVehicles}</p>
                  <p className="text-xs text-gray-600">Healthy</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{report.warningVehicles}</p>
                  <p className="text-xs text-gray-600">Warning</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{report.criticalVehicles}</p>
                  <p className="text-xs text-gray-600">Critical</p>
                </div>
              </div>
            </div>

            {/* Fleet Stats */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Fleet Statistics</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Vehicles</span>
                  <span className="font-medium">{report.totalVehicles}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-gray-600">Avg Mileage</span>
                  <span className="font-medium">{report.averageMileage.toLocaleString()} km</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-gray-600">Avg Age</span>
                  <span className="font-medium">{report.averageAge} months</span>
                </div>
              </div>
            </div>

            {/* Cost Projection */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Maintenance Costs</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Next Month</span>
                  <span className="font-medium text-orange-600">₹{report.costProjection.nextMonth.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-gray-600">Next 3 Months</span>
                  <span className="font-medium text-orange-600">₹{report.costProjection.next3Months.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-gray-600">Next 6 Months</span>
                  <span className="font-medium text-red-600">₹{report.costProjection.next6Months.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Fleet Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              {report.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-blue-600 mt-1">→</span>
                  <span className="text-gray-700">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={!selectedPriority ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedPriority(null)}
        >
          All Services ({allPredictions.length})
        </Button>
        <Button
          variant={selectedPriority === "critical" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedPriority("critical")}
        >
          🚨 Critical ({allPredictions.filter((p) => p.priority === "critical").length})
        </Button>
        <Button
          variant={selectedPriority === "high" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedPriority("high")}
        >
          ⚠️ High ({allPredictions.filter((p) => p.priority === "high").length})
        </Button>
        <Button
          variant={selectedPriority === "medium" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedPriority("medium")}
        >
          🟡 Medium ({allPredictions.filter((p) => p.priority === "medium").length})
        </Button>
      </div>

      {/* Services List */}
      <div className="space-y-3">
        {filteredPredictions.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <p className="text-gray-600">No pending maintenance services</p>
            </CardContent>
          </Card>
        ) : (
          filteredPredictions.map((pred, idx) => (
            <Card
              key={idx}
              className={`border-2 transition-all ${ACTION_COLORS[pred.recommendedAction]}`}
            >
              <CardContent className="pt-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">{ACTION_ICONS[pred.recommendedAction]}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {pred.component}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">Vehicle: {pred.vehicleId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={PRIORITY_COLORS[pred.priority]}>
                      {pred.priority.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-2 bg-white rounded border">
                    <p className="text-xs text-gray-600">Failure Risk</p>
                    <p className="text-lg font-bold text-red-600">{pred.failureRisk}%</p>
                  </div>
                  <div className="p-2 bg-white rounded border">
                    <p className="text-xs text-gray-600">Days to Failure</p>
                    <p className="text-lg font-bold text-orange-600">{pred.estimatedDaysToFailure}d</p>
                  </div>
                  <div className="p-2 bg-white rounded border">
                    <p className="text-xs text-gray-600">Est. Cost</p>
                    <p className="text-lg font-bold text-purple-600">₹{pred.estimatedCost.toLocaleString()}</p>
                  </div>
                </div>

                {/* Reason */}
                <div className="mb-4 p-3 bg-white rounded border">
                  <p className="text-xs text-gray-600 font-medium">Reason</p>
                  <p className="text-sm text-gray-900 mt-1">{pred.reason}</p>
                </div>

                {/* Action Recommendation */}
                <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs text-gray-600 font-medium">Recommended Action</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {pred.recommendedAction.toUpperCase()} - {pred.serviceType}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <Wrench className="h-4 w-4 mr-2" />
                    Schedule Service
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Info className="h-4 w-4 mr-2" />
                    Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Summary */}
      {allPredictions.length > 0 && (
        <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Predictive Maintenance Active</p>
                <p className="text-sm text-indigo-100 mt-1">
                  {allPredictions.length} service(s) predicted. Total cost impact: ₹
                  {allPredictions.reduce((sum, p) => sum + p.estimatedCost, 0).toLocaleString()} over 6 months
                </p>
              </div>
              <Gauge className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
