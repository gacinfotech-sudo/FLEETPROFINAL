import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

// Revenue Trend Data
const revenueData = [
  { date: "Jul 14", revenue: 2400, collections: 1800 },
  { date: "Jul 17", revenue: 3200, collections: 2400 },
  { date: "Jul 20", revenue: 2800, collections: 2100 },
  { date: "Jul 23", revenue: 4100, collections: 3200 },
  { date: "Jul 26", revenue: 5200, collections: 4100 },
  { date: "Jul 29", revenue: 4800, collections: 3900 },
  { date: "Aug 1", revenue: 6200, collections: 5100 },
  { date: "Aug 4", revenue: 7100, collections: 6200 },
  { date: "Aug 7", revenue: 6500, collections: 5800 },
  { date: "Aug 11", revenue: 7800, collections: 6900 },
];

// Booking Activity Data
const bookingData = [
  { stage: "Pipeline", count: 53, fill: "#3b82f6" },
  { stage: "Confirmed", count: 42, fill: "#10b981" },
  { stage: "Running", count: 18, fill: "#f59e0b" },
  { stage: "Completed", count: 127, fill: "#8b5cf6" },
];

// Fleet Status Data
const fleetStatusData = [
  { name: "Available", value: 26, fill: "#10b981" },
  { name: "On Trip", value: 12, fill: "#3b82f6" },
  { name: "Maintenance", value: 7, fill: "#ef4444" },
];

// Driver Status Data
const driverStatusData = [
  { name: "Available", value: 38, fill: "#10b981" },
  { name: "On Duty", value: 20, fill: "#3b82f6" },
  { name: "Inactive", value: 24, fill: "#9ca3af" },
];

// Performance Data
const performanceData = [
  { week: "Week 1", efficiency: 78, satisfaction: 85 },
  { week: "Week 2", efficiency: 82, satisfaction: 88 },
  { week: "Week 3", efficiency: 85, satisfaction: 90 },
  { week: "Week 4", efficiency: 88, satisfaction: 92 },
  { week: "Week 5", efficiency: 92, satisfaction: 95 },
];

export function RevenueChart() {
  return (
    <div className="w-full h-80 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
      <h3 className="text-lg font-bold text-gray-900 mb-4">📈 Revenue Trend</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCollections" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: "12px" }} />
          <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "2px solid #3b82f6",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#3b82f6"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
          <Area
            type="monotone"
            dataKey="collections"
            stroke="#10b981"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorCollections)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BookingActivityChart() {
  return (
    <div className="w-full h-80 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
      <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Booking Activity</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bookingData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="stage" stroke="#6b7280" style={{ fontSize: "12px" }} />
          <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "2px solid #9333ea",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          />
          <Bar dataKey="count" fill="#8b5cf6" radius={[12, 12, 0, 0]} animationDuration={800}>
            {bookingData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FleetStatusChart() {
  return (
    <div className="w-full h-80 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100 flex flex-col items-center justify-center">
      <h3 className="text-lg font-bold text-gray-900 mb-6 w-full">🚗 Fleet Status</h3>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie
            data={fleetStatusData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            animationDuration={800}
          >
            {fleetStatusData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "2px solid #10b981",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DriverStatusChart() {
  return (
    <div className="w-full h-80 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 border border-orange-100 flex flex-col items-center justify-center">
      <h3 className="text-lg font-bold text-gray-900 mb-6 w-full">👨 Driver Status</h3>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie
            data={driverStatusData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            animationDuration={800}
          >
            {driverStatusData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "2px solid #f59e0b",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PerformanceChart() {
  return (
    <div className="w-full h-80 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-4 border border-cyan-100">
      <h3 className="text-lg font-bold text-gray-900 mb-4">📈 Performance Metrics</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={performanceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="week" stroke="#6b7280" style={{ fontSize: "12px" }} />
          <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "2px solid #06b6d4",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="efficiency"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: "#3b82f6", r: 6 }}
            activeDot={{ r: 8 }}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="satisfaction"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ fill: "#10b981", r: 6 }}
            activeDot={{ r: 8 }}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
