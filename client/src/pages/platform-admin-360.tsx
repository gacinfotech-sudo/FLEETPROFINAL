import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from "recharts";
import { AlertCircle, TrendingUp, Activity, Shield, Zap, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";

export default function PlatformAdmin360() {
  const [activeTab, setActiveTab] = useState("health");
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: platformData, isLoading } = useQuery({
    queryKey: ["/api/root/platform-health"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/root/platform-health`);
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: tenantDetails } = useQuery({
    queryKey: ["/api/root/tenant", selectedTenant],
    queryFn: async () => {
      if (!selectedTenant) return null;
      const response = await apiRequest("GET", `/api/root/tenant/${selectedTenant}/health`);
      return response.json();
    },
    enabled: !!selectedTenant,
  });

  const triggerRemediationMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiRequest("POST", `/api/root/remediation/trigger`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/root/platform-health"] });
      toast({ title: "Remediation triggered successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const platformStats = platformData?.stats || {};
  const tenants = platformData?.tenants || [];
  const healthMetrics = platformData?.healthMetrics || [];
  const incidents = platformData?.incidents || [];
  const anomalies = platformData?.anomalies || [];

  const getHealthColor = (score: number) => {
    if (score >= 90) return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700";
    if (score >= 70) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700";
    return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700";
  };

  const getSeverityColor = (severity: string) => {
    if (severity === "critical") return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
    if (severity === "high") return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300";
    if (severity === "medium") return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
    return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 dark:from-slate-900 dark:via-purple-900 dark:to-blue-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-blue-400">
            🛡️ Platform Admin 360
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Real-time tenant health monitoring, anomaly detection & remediation
          </p>
        </div>

        {/* Summary Stats */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Tenants</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{platformStats.totalTenants || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active & monitored</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 border-green-200 dark:border-green-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Healthy Tenants</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">{platformStats.healthyCount || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{platformStats.healthPercentage || 0}% uptime</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20 border-orange-200 dark:border-orange-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">At Risk</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-2">{platformStats.atRiskCount || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Below threshold</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 border-red-200 dark:border-red-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Critical</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">{platformStats.criticalCount || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Require immediate action</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Anomalies</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">{platformStats.anomalyCount || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Detected this hour</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="health">🏥 Health Monitor</TabsTrigger>
            <TabsTrigger value="anomalies">🔍 Anomalies</TabsTrigger>
            <TabsTrigger value="incidents">🚨 Incidents</TabsTrigger>
            <TabsTrigger value="remediation">⚙️ Remediation</TabsTrigger>
          </TabsList>

          {/* Health Monitor Tab */}
          <TabsContent value="health" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🎯 Platform Health Score</CardTitle>
                </CardHeader>
                <CardContent>
                  {healthMetrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={healthMetrics}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} />
                        <Radar name="Score" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-8 text-gray-500">No health data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📊 Health Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "API Latency", score: 95 },
                      { label: "Database Health", score: 88 },
                      { label: "Cache Hit Rate", score: 92 },
                      { label: "Error Rate", score: 99 },
                      { label: "CPU Usage", score: 75 },
                    ].map((metric, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{metric.label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${metric.score >= 90 ? "bg-green-500" : metric.score >= 75 ? "bg-yellow-500" : "bg-red-500"}`}
                              style={{ width: `${metric.score}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold w-8 text-right">{metric.score}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">👥 Tenant Health Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell>Tenant</TableCell>
                        <TableCell>Health Score</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Users</TableCell>
                        <TableCell>Uptime</TableCell>
                        <TableCell>Errors (24h)</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants.map((tenant: any) => (
                        <TableRow key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <TableCell>
                            <button
                              onClick={() => setSelectedTenant(tenant.id)}
                              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {tenant.name}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${tenant.healthScore >= 90 ? "bg-green-500" : tenant.healthScore >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                                  style={{ width: `${tenant.healthScore}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-bold">{tenant.healthScore}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getHealthColor(tenant.healthScore)}`}>
                              {tenant.healthScore >= 90 ? "✅ Healthy" : tenant.healthScore >= 70 ? "⚠️ Warning" : "🔴 Critical"}
                            </Badge>
                          </TableCell>
                          <TableCell>{tenant.activeUsers?.toLocaleString() || 0}</TableCell>
                          <TableCell>{tenant.uptime}%</TableCell>
                          <TableCell className="text-red-600 dark:text-red-400 font-semibold">{tenant.errorCount24h}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedTenant(tenant.id)}
                              className="text-xs"
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Anomalies Tab */}
          <TabsContent value="anomalies">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔍 Detected Anomalies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {anomalies.length > 0 ? (
                    anomalies.map((anomaly: any) => (
                      <div key={anomaly.id} className={`p-4 rounded-lg border-l-4 ${getSeverityColor(anomaly.severity)}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold">{anomaly.type}</h3>
                            <p className="text-sm mt-1">{anomaly.description}</p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">Tenant: {anomaly.tenantName}</Badge>
                              <Badge variant="secondary" className="text-xs">Confidence: {anomaly.confidence}%</Badge>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              Detected: {new Date(anomaly.detectedAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() =>
                              triggerRemediationMutation.mutate({
                                anomalyId: anomaly.id,
                                tenantId: anomaly.tenantId,
                                type: "auto_remediate",
                              })
                            }
                            disabled={triggerRemediationMutation.isPending}
                            className="ml-4"
                          >
                            Fix
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-gray-500">✅ No anomalies detected</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Incidents Tab */}
          <TabsContent value="incidents">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🚨 Active Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incidents.length > 0 ? (
                    incidents.map((incident: any) => (
                      <div key={incident.id} className={`p-4 rounded-lg border-l-4 ${getSeverityColor(incident.severity)}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{incident.title}</h3>
                              <Badge className={`text-xs ${getSeverityColor(incident.severity)}`}>
                                {incident.severity.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm mt-1">{incident.description}</p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">Tenant: {incident.tenantName}</Badge>
                              <Badge variant="secondary" className="text-xs">Duration: {incident.duration}</Badge>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              Started: {new Date(incident.startTime).toLocaleString()}
                            </p>
                            <p className="text-sm font-medium mt-2 text-gray-700 dark:text-gray-300">
                              Impact: {incident.impact}
                            </p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button size="sm" variant="outline" className="text-xs">
                              Investigate
                            </Button>
                            <Button size="sm" className="text-xs bg-red-500 hover:bg-red-600">
                              Escalate
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-gray-500">✅ No active incidents</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Remediation Tab */}
          <TabsContent value="remediation">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">⚙️ Automated Remediation Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    {
                      name: "Cache Clear",
                      description: "Clear stale cache entries",
                      success: 98,
                      icon: "⚡",
                    },
                    {
                      name: "Database Reindex",
                      description: "Optimize query performance",
                      success: 95,
                      icon: "📊",
                    },
                    {
                      name: "Load Balancer Reset",
                      description: "Rebalance traffic distribution",
                      success: 99,
                      icon: "🔄",
                    },
                    {
                      name: "Connection Pool Drain",
                      description: "Recycle stale connections",
                      success: 96,
                      icon: "🌊",
                    },
                  ].map((action, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{action.icon}</span>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">{action.name}</h3>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{action.description}</p>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500" style={{ width: `${action.success}%` }}></div>
                            </div>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{action.success}% success</span>
                          </div>
                        </div>
                        <Button size="sm" className="text-xs">
                          Run
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📈 Remediation Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  {platformData?.remediationTrend ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={platformData.remediationTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="successRate" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="autoResolved" stroke="#3b82f6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-8 text-gray-500">No trend data</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Tenant Details Modal-like View */}
        {selectedTenant && tenantDetails && (
          <Card className="mt-8 border-2 border-purple-200 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">📊 Tenant: {tenantDetails.name}</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setSelectedTenant(null)}>
                  ✕ Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Health Score</p>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{tenantDetails.healthScore}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Active Users</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{tenantDetails.activeUsers?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Uptime</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">{tenantDetails.uptime}%</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Error Rate</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">{tenantDetails.errorRate}%</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Service Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { name: "API", status: "healthy" },
                    { name: "Database", status: "healthy" },
                    { name: "Cache", status: "degraded" },
                  ].map((service, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          service.status === "healthy" ? "bg-green-500" : "bg-yellow-500"
                        }`}
                      ></div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{service.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
