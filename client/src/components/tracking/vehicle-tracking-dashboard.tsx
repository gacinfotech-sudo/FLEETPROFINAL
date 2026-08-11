import React, { useState } from "react";
import {
  useGetLocation,
  useGetVehicleStats,
  useGetTrackingAnalytics,
  useGetGeofenceEvents,
  useStartTrip,
  useEndTrip,
} from "../../hooks/useVehicleTracking";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const VehicleTrackingDashboard: React.FC = () => {
  const [vehicleId, setVehicleId] = useState("vehicle_001");
  const [activeTab, setActiveTab] = useState<"live" | "analytics" | "events" | "trip">("live");
  const [showTripDialog, setShowTripDialog] = useState(false);

  const { data: location, isLoading: locationLoading } = useGetLocation(vehicleId);
  const { data: stats } = useGetVehicleStats(vehicleId);
  const { data: analytics } = useGetTrackingAnalytics();
  const { data: geofenceEvents = [] } = useGetGeofenceEvents(vehicleId, 24);
  const startTrip = useStartTrip();
  const endTrip = useEndTrip();

  if (locationLoading) {
    return <LoadingSpinner />;
  }

  const handleStartTrip = () => {
    if (location) {
      startTrip.mutate({
        vehicleId,
        driverId: "driver_001",
        startLocation: {
          latitude: location.coordinate.latitude,
          longitude: location.coordinate.longitude,
        },
      });
      setShowTripDialog(false);
    }
  };

  return (
    <div className="space-y-4 bg-gradient-to-b from-blue-50 via-cyan-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 min-h-screen p-4 md:p-6 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            🚗 Vehicle Tracking
          </h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time GPS & Route Optimization
          </p>
        </div>
        <button
          onClick={() => setShowTripDialog(true)}
          className="px-4 md:px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-sm md:text-base"
        >
          🚦 Start Trip
        </button>
      </div>

      {/* Live Location */}
      {location && (
        <div className="bg-gradient-to-br from-blue-100 to-cyan-50 dark:from-blue-900/40 dark:to-cyan-900/40 rounded-2xl shadow-sm p-4 md:p-6 border border-blue-200 dark:border-blue-700">
          <h2 className="text-base md:text-lg font-bold text-blue-900 dark:text-blue-100 mb-4">
            📍 Live Location
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-700">
              <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">Latitude</span>
              <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                {location.coordinate.latitude.toFixed(4)}
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-700">
              <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">Longitude</span>
              <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                {location.coordinate.longitude.toFixed(4)}
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-700">
              <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">Speed</span>
              <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400 mt-1">
                {location.speed.toFixed(1)} km/h
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-700">
              <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">Status</span>
              <div className="text-lg font-bold mt-1">
                {location.isMoving ? (
                  <span className="text-green-600 dark:text-green-400">🟢 Moving</span>
                ) : (
                  <span className="text-yellow-600 dark:text-yellow-400">🟡 Idle</span>
                )}
              </div>
            </div>
          </div>
          {location.address && (
            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-700">
              <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">📮 Address</span>
              <p className="text-gray-900 dark:text-white mt-1">{location.address}</p>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 md:space-x-4 overflow-x-auto pb-2">
        {["live", "analytics", "events", "trip"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-3 md:px-4 py-2 font-medium text-xs md:text-sm rounded-lg transition-all duration-200 whitespace-nowrap ${
              activeTab === tab
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {tab === "live" && "📍 Live"}
            {tab === "analytics" && "📊 Analytics"}
            {tab === "events" && "🚪 Events"}
            {tab === "trip" && "🛣️ Trip"}
          </button>
        ))}
      </div>

      {/* Analytics Tab */}
      {activeTab === "analytics" && analytics && (
        <div className="space-y-3 md:space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <div className="p-3 md:p-4 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
              <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">🚗 Tracked</span>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-300 mt-1">
                {analytics.totalVehiclesTracked}
              </div>
            </div>
            <div className="p-3 md:p-4 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-900/20 rounded-xl border border-green-200 dark:border-green-700">
              <span className="text-xs text-green-700 dark:text-green-300 font-bold">🟢 Active</span>
              <div className="text-2xl font-bold text-green-600 dark:text-green-300 mt-1">
                {analytics.activeVehicles}
              </div>
            </div>
            <div className="p-3 md:p-4 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
              <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">📏 Distance</span>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-300 mt-1">
                {(analytics.totalDistance / 1000).toFixed(0)}k km
              </div>
            </div>
            <div className="p-3 md:p-4 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/40 dark:to-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-700">
              <span className="text-xs text-orange-700 dark:text-orange-300 font-bold">⚡ Avg Speed</span>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-300 mt-1">
                {analytics.avgSpeed.toFixed(0)} km/h
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div className="p-4 bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/40 dark:to-red-900/20 rounded-xl border border-red-200 dark:border-red-700">
              <span className="text-xs text-red-700 dark:text-red-300 font-bold">🔥 Top Speed</span>
              <div className="text-2xl font-bold text-red-600 dark:text-red-300 mt-2">
                {analytics.topSpeed.toFixed(0)} km/h
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/40 dark:to-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-700">
              <span className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">⛽ Fuel Eff.</span>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-300 mt-2">
                {analytics.averageFuelEfficiency.toFixed(1)} km/l
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === "events" && (
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 md:p-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <h2 className="font-bold text-lg">🚪 Geofence Events ({geofenceEvents.length})</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {geofenceEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No geofence events
              </div>
            ) : (
              geofenceEvents.map((event: any) => (
                <div key={event.eventId} className="p-4 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 dark:hover:from-amber-900/20 dark:hover:to-orange-900/20">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">
                        {event.eventType === "entry" ? "📍 Entered" : "🚪 Exited"}
                      </h3>
                      <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {new Date(event.timestamp).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                      event.eventType === "entry"
                        ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200"
                        : "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200"
                    }`}>
                      {event.eventType.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Trip Tab */}
      {activeTab === "trip" && stats && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-sm p-4 md:p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-base md:text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-4">
              🛣️ Trip Statistics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20 rounded-lg">
                <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">Total Trips</span>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-300 mt-1">
                  {stats.tripCount}
                </div>
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20 rounded-lg">
                <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">Distance</span>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-300 mt-1">
                  {stats.totalDistance.toFixed(1)} km
                </div>
              </div>
              <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-900/20 rounded-lg">
                <span className="text-xs text-green-700 dark:text-green-300 font-bold">Avg Speed</span>
                <div className="text-2xl font-bold text-green-600 dark:text-green-300 mt-1">
                  {stats.avgSpeed.toFixed(0)} km/h
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trip Dialog */}
      {showTripDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-6">
              🚦 Start Trip
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-700">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Ready to start tracking a new trip?
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleStartTrip}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all"
                >
                  ✓ Start
                </button>
                <button
                  onClick={() => setShowTripDialog(false)}
                  className="flex-1 px-4 py-3 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-xl hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
