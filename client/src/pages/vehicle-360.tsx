import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import {
  Car,
  AlertCircle,
  CheckCircle,
  Zap,
  AlertTriangle,
  MapPin,
  Clock,
  DollarSign,
  Wrench,
  FileText,
  Users as UsersIcon,
  Activity,
  TrendingUp,
} from "lucide-react";

interface Vehicle360OverviewStats {
  totalVehicles: number;
  availableVehicles: number;
  runningVehicles: number;
  maintenanceVehicles: number;
  idleVehicles: number;
  gpsOfflineCount: number;
  complianceAlertsCount: number;
  maintenanceAlertCount: number;
  documentExpiryCount: number;
  totalBookingsToday: number;
  activeBookings: number;
  upcomingBookings: number;
}

interface Vehicle360Props {
  onViewChange?: (view: string, vehicleId?: string) => void;
}

export default function Vehicle360({ onViewChange }: Vehicle360Props) {
  const { canViewVehicle360, canViewVehicles } = usePermissions();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState<"overview" | "fleet" | "gps" | "performance" | "compliance" | "maintenance" | "fuel" | "alerts">("overview");

  // Fetch vehicle data
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<any[]>({
    queryKey: ["/api/vehicles"],
    enabled: canViewVehicles(),
  });

  // Calculate statistics
  const stats: Vehicle360OverviewStats = useMemo(() => {
    const vehicles_array = Array.isArray(vehicles) ? vehicles : [];
    return {
      totalVehicles: vehicles_array.length,
      availableVehicles: vehicles_array.filter((v: any) => v.status === "available").length,
      runningVehicles: vehicles_array.filter((v: any) => v.status === "on_trip").length,
      maintenanceVehicles: vehicles_array.filter((v: any) => v.status === "maintenance").length,
      idleVehicles: vehicles_array.filter((v: any) => v.status === "available" && !v.currentBooking).length,
      gpsOfflineCount: 0, // Will be populated from GPS API
      complianceAlertsCount: 0, // Will be populated from compliance API
      maintenanceAlertCount: 0, // Will be populated from maintenance API
      documentExpiryCount: 0, // Will be populated from documents API
      totalBookingsToday: 0,
      activeBookings: vehicles_array.filter((v: any) => v.status === "on_trip").length,
      upcomingBookings: 0,
    };
  }, [vehicles]);

  if (!user) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Owner/Super Admin: Always show Vehicle 360
  // Manager: Only show if has appropriate permissions
  const isOwner = user.role === "admin" || user.role === "client";
  const hasVehicle360Access = isOwner || canViewVehicle360();

  if (!hasVehicle360Access) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to access Vehicle 360. Contact your administrator to enable access.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Car className="text-blue-600 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Vehicle 360</h1>
            <p className="text-gray-600">Complete fleet management and monitoring</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 overflow-x-auto pb-2 border-b">
        {[
          { id: "overview", label: "Overview", icon: Activity },
          { id: "fleet", label: "Fleet", icon: Car },
          { id: "gps", label: "Live GPS", icon: MapPin },
          { id: "performance", label: "Performance", icon: TrendingUp },
          { id: "compliance", label: "Compliance", icon: FileText },
          { id: "maintenance", label: "Maintenance", icon: Wrench },
          { id: "fuel", label: "Fuel & Expenses", icon: DollarSign },
          { id: "alerts", label: "Alerts", icon: AlertTriangle },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSelectedTab(id as any)}
            className={`flex items-center space-x-2 px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              selectedTab === id
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <Car className="w-4 h-4 mr-2" /> Total Vehicles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalVehicles}</div>
                <p className="text-xs text-gray-500 mt-2">{stats.availableVehicles} available</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <Zap className="w-4 h-4 mr-2" /> Running Now
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.runningVehicles}</div>
                <p className="text-xs text-gray-500 mt-2">Active bookings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <Wrench className="w-4 h-4 mr-2" /> Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{stats.maintenanceVehicles}</div>
                <p className="text-xs text-gray-500 mt-2">In service</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" /> Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {stats.complianceAlertsCount + stats.maintenanceAlertCount}
                </div>
                <p className="text-xs text-gray-500 mt-2">Needs attention</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedTab("fleet")}
                  className="justify-start"
                >
                  <Car className="w-4 h-4 mr-2" />
                  View Fleet
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedTab("gps")}
                  className="justify-start"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Live Tracking
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedTab("alerts")}
                  className="justify-start"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  View Alerts
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status Legend */}
          <Card>
            <CardHeader>
              <CardTitle>Fleet Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Available</span>
                </div>
                <Badge variant="default">{stats.availableVehicles}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <span>On Trip</span>
                </div>
                <Badge variant="secondary">{stats.runningVehicles}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wrench className="w-5 h-5 text-orange-600" />
                  <span>Maintenance</span>
                </div>
                <Badge variant="outline">{stats.maintenanceVehicles}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fleet Tab */}
      {selectedTab === "fleet" && (
        <Card>
          <CardHeader>
            <CardTitle>Fleet / Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            {vehiclesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <Car className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No vehicles found. Create your first vehicle to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehicles.map((vehicle: any) => (
                  <Card key={vehicle._id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{vehicle.make}</CardTitle>
                      <p className="text-sm text-gray-600">{vehicle.licensePlate || "No plate"}</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        <Badge
                          variant={
                            vehicle.status === "available"
                              ? "default"
                              : vehicle.status === "on_trip"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {vehicle.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        Type: <span className="font-medium">{vehicle.type}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Capacity: <span className="font-medium">{vehicle.capacity} seats</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* GPS Tab */}
      {selectedTab === "gps" && (
        <Card>
          <CardHeader>
            <CardTitle>Live GPS Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                GPS tracking data will be displayed here. Vehicles with active GPS devices will show their real-time location.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Performance Tab */}
      {selectedTab === "performance" && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Performance metrics including utilization, revenue, and efficiency will be displayed here.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Compliance Tab */}
      {selectedTab === "compliance" && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance & Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                RC, Insurance, Permit, Fitness, PUC, and other compliance documents will be tracked here.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Tab */}
      {selectedTab === "maintenance" && (
        <Card>
          <CardHeader>
            <CardTitle>Maintenance History</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Service history, maintenance alerts, and repair records will be displayed here.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Fuel & Expenses Tab */}
      {selectedTab === "fuel" && (
        <Card>
          <CardHeader>
            <CardTitle>Fuel & Vehicle Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Fuel entries, toll charges, parking, and other vehicle expenses will be tracked here.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Alerts Tab */}
      {selectedTab === "alerts" && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Service due, document expiry, GPS offline, and other critical alerts will be displayed here.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
