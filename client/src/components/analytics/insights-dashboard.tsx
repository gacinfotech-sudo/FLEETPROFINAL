import { useState, useEffect } from "react";
import { AlertCircle, TrendingUp, Lightbulb, Zap, BarChart3, Brain, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Insight {
  id: string;
  type: "opportunity" | "warning" | "anomaly" | "prediction" | "recommendation";
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  metric: string;
  impact: string;
  suggestedAction: string;
  confidence: number;
  timestamp: Date;
}

interface Prediction {
  timeSlot: string;
  predictedBookings: number;
  confidence: number;
  recommendedVehicles: number;
  recommendedDrivers: number;
  peakHours: string[];
}

interface InsightsDashboardProps {
  insights?: Insight[];
  predictions?: Prediction[];
  onImplement?: (insightId: string) => void;
}

const INSIGHT_ICONS: Record<string, React.ReactNode> = {
  opportunity: <Lightbulb className="h-5 w-5 text-green-600" />,
  warning: <AlertCircle className="h-5 w-5 text-orange-600" />,
  anomaly: <Zap className="h-5 w-5 text-red-600" />,
  prediction: <Brain className="h-5 w-5 text-purple-600" />,
  recommendation: <CheckCircle2 className="h-5 w-5 text-blue-600" />,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-gray-100 text-gray-800 border-gray-300",
};

const TYPE_COLORS: Record<string, string> = {
  opportunity: "bg-green-50 border-green-200",
  warning: "bg-orange-50 border-orange-200",
  anomaly: "bg-red-50 border-red-200",
  prediction: "bg-purple-50 border-purple-200",
  recommendation: "bg-blue-50 border-blue-200",
};

export default function InsightsDashboard({
  insights = [],
  predictions = [],
  onImplement,
}: InsightsDashboardProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());

  // Filter insights
  const filteredInsights = insights.filter((insight) => {
    if (dismissedInsights.has(insight.id)) return false;
    if (selectedType && insight.type !== selectedType) return false;
    if (selectedPriority && insight.priority !== selectedPriority) return false;
    return true;
  });

  // Calculate stats
  const stats = {
    total: insights.length,
    critical: insights.filter((i) => i.priority === "critical").length,
    opportunities: insights.filter((i) => i.type === "opportunity").length,
    warnings: insights.filter((i) => i.type === "warning").length,
    avgConfidence: Math.round(
      insights.reduce((sum, i) => sum + i.confidence, 0) / Math.max(insights.length, 1)
    ),
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Insights</p>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">auto-generated</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">🚨 Critical</p>
              <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
              <p className="text-xs text-gray-500 mt-1">need action</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">💡 Opportunities</p>
              <p className="text-3xl font-bold text-green-600">{stats.opportunities}</p>
              <p className="text-xs text-gray-500 mt-1">growth potential</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">⚠️ Warnings</p>
              <p className="text-3xl font-bold text-orange-600">{stats.warnings}</p>
              <p className="text-xs text-gray-500 mt-1">monitor closely</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">🧠 Confidence</p>
              <p className="text-3xl font-bold text-purple-600">{stats.avgConfidence}%</p>
              <p className="text-xs text-gray-500 mt-1">avg accuracy</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Predictions Section */}
      {predictions.length > 0 && (
        <Card className="border-2 border-purple-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <CardTitle>🔮 Demand Predictions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {predictions.map((pred) => (
                <div key={pred.timeSlot} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="font-semibold text-gray-900 mb-3">{pred.timeSlot}</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600">Predicted Bookings</p>
                      <p className="text-2xl font-bold text-purple-600">{pred.predictedBookings}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Confidence</p>
                      <Progress value={pred.confidence} className="h-1.5" />
                      <p className="text-xs text-gray-500 mt-1">{pred.confidence.toFixed(0)}%</p>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-600">Recommended</p>
                      <p className="text-sm text-gray-700">
                        🚗 {pred.recommendedVehicles} vehicles • 👨‍✈️ {pred.recommendedDrivers} drivers
                      </p>
                    </div>
                    {pred.peakHours.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs text-gray-600">Peak Hours</p>
                        <p className="text-sm font-medium text-gray-900">{pred.peakHours.join(", ")}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Controls */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1">
          <Button
            variant={!selectedType ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType(null)}
          >
            All ({insights.length})
          </Button>
          <Button
            variant={selectedType === "opportunity" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("opportunity")}
          >
            💡 Opportunities ({stats.opportunities})
          </Button>
          <Button
            variant={selectedType === "warning" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("warning")}
          >
            ⚠️ Warnings ({stats.warnings})
          </Button>
          <Button
            variant={selectedType === "anomaly" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("anomaly")}
          >
            🔍 Anomalies
          </Button>
          <Button
            variant={selectedType === "prediction" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("prediction")}
          >
            🧠 Predictions
          </Button>
        </div>

        <div className="ml-auto flex gap-1">
          <Button
            variant={!selectedPriority ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedPriority(null)}
          >
            All Priority
          </Button>
          <Button
            variant={selectedPriority === "critical" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedPriority("critical")}
          >
            🚨 Critical
          </Button>
          <Button
            variant={selectedPriority === "high" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedPriority("high")}
          >
            High
          </Button>
        </div>
      </div>

      {/* Insights List */}
      <div className="space-y-3">
        {filteredInsights.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <p className="text-gray-600">No insights match your filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredInsights.map((insight) => (
            <Card key={insight.id} className={`border-2 ${TYPE_COLORS[insight.type]}`}>
              <CardContent className="pt-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="text-2xl mt-1">{INSIGHT_ICONS[insight.type]}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">{insight.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={PRIORITY_COLORS[insight.priority]}>
                      {insight.priority.charAt(0).toUpperCase() + insight.priority.slice(1)}
                    </Badge>
                    <Badge variant="outline">{insight.type}</Badge>
                  </div>
                </div>

                {/* Confidence Meter */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Confidence</span>
                    <span className="font-medium">{insight.confidence}%</span>
                  </div>
                  <Progress value={insight.confidence} className="h-1.5" />
                </div>

                {/* Impact */}
                <div className="mb-4 p-3 bg-white rounded border">
                  <p className="text-xs text-gray-600 font-medium">📊 Impact</p>
                  <p className="text-sm text-gray-900 mt-1">{insight.impact}</p>
                </div>

                {/* Suggested Action */}
                <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs text-gray-600 font-medium">💡 Suggested Action</p>
                  <p className="text-sm text-gray-900 mt-1">{insight.suggestedAction}</p>
                </div>

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Metric: {insight.metric}</span>
                  <span>
                    <Clock className="h-3 w-3 inline mr-1" />
                    {new Date(insight.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => onImplement?.(insight.id)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    🚀 Implement
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDismissedInsights((prev) => new Set([...prev, insight.id]))
                    }
                    size="sm"
                    className="flex-1"
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {dismissedInsights.size > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissedInsights(new Set())}
          className="w-full text-gray-600"
        >
          Show {dismissedInsights.size} dismissed insights
        </Button>
      )}
    </div>
  );
}
