import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, Building2, TrendingUp, AlertCircle, Activity, RefreshCw, Bug, MessageSquare } from "lucide-react";

interface AdminStats {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  totalAdmins: number;
  totalManagers: number;
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
  systemHealth: {
    dbConnection: boolean;
    serverStatus: string;
    lastUpdated: string;
  };
  recentTenants: Array<{
    _id: string;
    name: string;
    businessName: string;
    isActive: boolean;
    subscriptionPlan: string;
    createdAt: string;
    userCount: number;
    bookingCount: number;
  }>;
  tenantsByPlan: Array<{
    plan: string;
    count: number;
  }>;
  recentActivities: Array<{
    _id: string;
    timestamp: string;
    action: string;
    tenantName: string;
    details: string;
  }>;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

export default function AdminPage360() {
  const { data, isLoading, error, refetch } = useQuery<AdminStats>({
    queryKey: ["/api/admin/dashboard"],
  });

  const { data: bugReports = [] } = useQuery({
    queryKey: ["/api/admin/bug-reports"],
  });

  const { data: supportTickets = [] } = useQuery({
    queryKey: ["/api/admin/support-tickets"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Failed to load admin dashboard</span>
          </div>
          <p className="text-sm mb-3">{(error as Error)?.message || "Unknown error"}</p>
          <Button size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="gradient-header bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">🛡️ Super Admin 360</h1>
            <p className="text-blue-100 mt-1">Platform overview & system health monitoring</p>
          </div>
          <Button
            onClick={() => refetch()}
            className="bg-white text-blue-600 hover:bg-blue-50 font-semibold"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card card-hover bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">🏢 TENANTS</p>
                <p className="text-2xl font-bold text-blue-600 mt-2">{data.totalTenants}</p>
                <p className="text-xs text-gray-500 mt-1">{data.activeTenants} active</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-300 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card card-hover bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">👥 TOTAL USERS</p>
                <p className="text-2xl font-bold text-green-600 mt-2">{data.totalUsers}</p>
                <p className="text-xs text-gray-500 mt-1">{data.totalAdmins} admins, {data.totalManagers} managers</p>
              </div>
              <Users className="w-8 h-8 text-green-300 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card card-hover bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">📊 TOTAL BOOKINGS</p>
                <p className="text-2xl font-bold text-purple-600 mt-2">{data.totalBookings.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">All-time platform volume</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-300 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card card-hover bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">💰 TOTAL REVENUE</p>
                <p className="text-2xl font-bold text-amber-600 mt-2">₹{(data.totalRevenue / 100000).toFixed(1)}L</p>
                <p className="text-xs text-gray-500 mt-1">Gross platform revenue</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-300 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">System Health</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Database Connection</span>
            <Badge variant={data.systemHealth.dbConnection ? "default" : "destructive"}>
              {data.systemHealth.dbConnection ? "✅ Connected" : "❌ Disconnected"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Server Status</span>
            <Badge variant="default">{data.systemHealth.serverStatus}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Last Updated</span>
            <span>{new Date(data.systemHealth.lastUpdated).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenants by Plan Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tenants by Subscription Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.tenantsByPlan}
                  dataKey="count"
                  nameKey="plan"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {data.tenantsByPlan.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subscription Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.tenantsByPlan}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="plan" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tenants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTenants.map((tenant) => (
                  <TableRow key={tenant._id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{tenant.subscriptionPlan}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tenant.isActive ? "default" : "destructive"}>
                        {tenant.isActive ? "✅ Active" : "❌ Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{tenant.userCount}</TableCell>
                    <TableCell className="text-right">{tenant.bookingCount}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {data.recentTenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-6">
                      No tenants found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Platform Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recentActivities.map((activity) => (
              <div key={activity._id} className="flex gap-3 pb-3 border-b last:border-b-0">
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    <Badge variant="outline" className="mr-2">{activity.tenantName}</Badge>
                    {activity.details}
                  </p>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(activity.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
            {data.recentActivities.length === 0 && (
              <div className="text-center text-gray-500 py-6">No recent activities</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tenant Support & Issue Management */}
      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Bug Reports ({bugReports.length})
          </TabsTrigger>
          <TabsTrigger value="tickets" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Support Tickets ({supportTickets.length})
          </TabsTrigger>
        </TabsList>

        {/* Bug Reports Tab */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tenant Bug Reports</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Issues reported by tenants across the platform</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bugReports.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No bug reports</div>
                ) : (
                  bugReports.slice(0, 10).map((report: any) => (
                    <div key={report._id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-sm">{report.title}</h4>
                            <Badge variant={
                              report.severity === 'critical' ? 'destructive' :
                              report.severity === 'high' ? 'default' :
                              'secondary'
                            }>
                              {report.severity}
                            </Badge>
                            <Badge variant="outline">{report.status}</Badge>
                          </div>
                          <p className="text-xs text-gray-600 mb-2">{report.description}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>👤 {report.tenantName}</span>
                            <span>📍 {report.module}</span>
                            <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">View Details</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Tickets Tab */}
        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tenant Support Tickets</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Support requests and queries from tenants</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {supportTickets.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No support tickets</div>
                ) : (
                  supportTickets.slice(0, 10).map((ticket: any) => (
                    <div key={ticket._id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-sm">{ticket.subject}</h4>
                            <Badge variant={
                              ticket.priority === 'urgent' ? 'destructive' :
                              ticket.priority === 'high' ? 'default' :
                              'secondary'
                            }>
                              {ticket.priority}
                            </Badge>
                            <Badge variant="outline">{ticket.status}</Badge>
                          </div>
                          <p className="text-xs text-gray-600 mb-2 line-clamp-2">{ticket.message}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>👤 {ticket.tenantName}</span>
                            <span>🏷️ {ticket.category}</span>
                            <span>💬 {ticket.messages?.length || 0} messages</span>
                            <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">Reply</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
