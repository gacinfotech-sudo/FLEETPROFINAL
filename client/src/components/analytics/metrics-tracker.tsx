import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, CheckCircle2, Users, Zap, Target, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Metric {
  name: string;
  value: number;
  unit: string;
  previous?: number;
  change?: number;
  percentChange?: number;
  category: "revenue" | "bookings" | "efficiency" | "quality";
  icon: React.ReactNode;
}

interface MetricsTrackerProps {
  metrics?: Metric[];
  history?: Array<{ timestamp: string; [key: string]: any }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  revenue: "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200",
  bookings: "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200",
  efficiency: "bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200",
  quality: "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  revenue: <DollarSign className="h-5 w-5 text-green-600" />,
  bookings: <CheckCircle2 className="h-5 w-5 text-blue-600" />,
  efficiency: <Zap className="h-5 w-5 text-purple-600" />,
  quality: <Target className="h-5 w-5 text-orange-600" />,
};

export default function MetricsTracker({
  metrics = [],
  history = [],
}: MetricsTrackerProps) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("24h");

  // Group metrics by category
  const groupedMetrics = metrics.reduce(
    (acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category].push(metric);
      return acc;
    },
    {} as Record<string, Metric[]>
  );

  // Filter history based on period
  const filteredHistory = history.slice(
    Math.max(0, history.length - (period === "24h" ? 24 : period === "7d" ? 168 : 720))
  );

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {(["24h", "7d", "30d"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              period === p
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {p === "24h" ? "Last 24h" : p === "7d" ? "Last 7d" : "Last 30d"}
          </button>
        ))}
      </div>

      {/* Metrics by Category */}
      {Object.entries(groupedMetrics).map(([category, categoryMetrics]) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-4">
            {CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS]}
            <h3 className="text-lg font-semibold text-gray-900 capitalize">
              {category.replace("_", " ")}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryMetrics.map((metric) => (
              <Card
                key={metric.name}
                className={`border-2 cursor-pointer transition-all ${CATEGORY_COLORS[category]} ${
                  selectedMetric === metric.name ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() =>
                  setSelectedMetric(selectedMetric === metric.name ? null : metric.name)
                }
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{metric.name}</span>
                    {metric.percentChange !== undefined && (
                      <Badge
                        variant="outline"
                        className={`flex items-center gap-1 ${
                          (metric.percentChange || 0) >= 0
                            ? "bg-green-100 text-green-800 border-green-300"
                            : "bg-red-100 text-red-800 border-red-300"
                        }`}
                      >
                        {(metric.percentChange || 0) >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {Math.abs(metric.percentChange || 0).toFixed(1)}%
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    {/* Current Value */}
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Current Value</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {typeof metric.value === "number"
                          ? metric.value.toLocaleString("en-IN")
                          : metric.value}
                        <span className="text-sm text-gray-500 ml-1">{metric.unit}</span>
                      </p>
                    </div>

                    {/* Comparison */}
                    {metric.previous !== undefined && (
                      <div className="p-2 bg-white rounded border">
                        <p className="text-xs text-gray-600">Previous</p>
                        <p className="text-sm font-medium text-gray-900">
                          {metric.previous.toLocaleString("en-IN")} {metric.unit}
                        </p>
                        {metric.change !== undefined && (
                          <p
                            className={`text-xs font-medium mt-1 ${
                              (metric.change || 0) >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {(metric.change || 0) >= 0 ? "+" : ""}
                            {metric.change?.toLocaleString("en-IN")} {metric.unit}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Mini Chart Indicator */}
                    <div className="h-12 bg-white rounded border p-2">
                      {history.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={filteredHistory}>
                            <Line
                              type="monotone"
                              dataKey={metric.name.toLowerCase().replace(" ", "_")}
                              stroke={
                                category === "revenue"
                                  ? "#10b981"
                                  : category === "bookings"
                                  ? "#3b82f6"
                                  : category === "efficiency"
                                  ? "#a855f7"
                                  : "#f97316"
                              }
                              dot={false}
                              strokeWidth={2}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Detailed Chart for Selected Metric */}
      {selectedMetric && history.length > 0 && (
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              {selectedMetric} Trend
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={selectedMetric.toLowerCase().replace(" ", "_")}
                    stroke="#3b82f6"
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-600">Max</p>
                <p className="text-lg font-bold text-gray-900">
                  {Math.max(
                    ...filteredHistory.map(
                      (h) => h[selectedMetric.toLowerCase().replace(" ", "_")] || 0
                    )
                  )}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-600">Min</p>
                <p className="text-lg font-bold text-gray-900">
                  {Math.min(
                    ...filteredHistory.map(
                      (h) => h[selectedMetric.toLowerCase().replace(" ", "_")] || 0
                    )
                  )}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-600">Avg</p>
                <p className="text-lg font-bold text-gray-900">
                  {Math.round(
                    filteredHistory.reduce(
                      (sum, h) =>
                        sum + (h[selectedMetric.toLowerCase().replace(" ", "_")] || 0),
                      0
                    ) / filteredHistory.length
                  )}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-600">Trend</p>
                <p className="text-lg font-bold text-green-600">↗ Stable</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
