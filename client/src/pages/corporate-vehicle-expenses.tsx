import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertTriangle, TrendingDown, Fuel, Wrench } from "lucide-react";

export default function CorporateVehicleExpensesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split("T")[0].slice(0, 7));
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showLimitForm, setShowLimitForm] = useState(false);
  const [expenseData, setExpenseData] = useState({
    category: "fuel",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [limitData, setLimitData] = useState({
    monthlyLimit: 0,
    extraChargePerUnit: 0,
  });

  const { data: corporateClients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/corporate-clients"],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/corporate-clients`, { credentials: "include" });
        if (!res.ok) {
          console.error('Failed to fetch corporate clients:', res.status);
          return [];
        }
        const clients = await res.json();
        console.log('Corporate clients fetched:', clients);
        return clients || [];
      } catch (e) {
        console.error('Error fetching corporate clients:', e);
        return [];
      }
    },
    refetchInterval: 15000,
  });

  const { data: corporateVehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["/api/corporate-vehicle-attachments", selectedCompany],
    queryFn: async () => {
      try {
        const url = `/api/corporate-vehicle-attachments?clientId=${selectedCompany}`;
        console.log('Fetching attachments from:', url);
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          console.error('API error:', res.status);
          return [];
        }
        const attachments = await res.json();
        console.log('Attachments fetched:', attachments);

        if (!attachments || attachments.length === 0) {
          console.log('No attachments found for company:', selectedCompany);
          return [];
        }

        // Return attachments directly - Vehicle 360 will have make, vehicleModel, licensePlate
        const vehiclesWithDetails = attachments.map((attachment: any) => ({
          _id: attachment.vehicleId,
          vehicleId: attachment.vehicleId,
          attachmentId: attachment._id,
          make: attachment.make || 'Unknown',
          vehicleModel: attachment.vehicleModel || 'Model',
          licensePlate: attachment.licensePlate || 'N/A',
          modelName: attachment.modelName,
          corporateClientName: attachment.corporateClientName || 'N/A',
          status: attachment.status,
          monthlyRate: attachment.monthlyRate,
        }));

        console.log('Vehicles to display:', vehiclesWithDetails);
        return vehiclesWithDetails;
      } catch (e) {
        console.error('Failed to fetch corporate vehicles:', e);
        return [];
      }
    },
    enabled: !!selectedCompany,
    refetchInterval: 15000,
  });

  const { data: dailyExpensesData = { entries: [], byCategory: {}, totalExpenses: 0 } } = useQuery({
    queryKey: selectedVehicle ? [`/api/vehicles/${selectedVehicle.vehicleId || selectedVehicle._id}/daily-expenses/${selectedMonth}`, selectedMonth] : [],
    refetchInterval: 15000,
  });

  const { data: monthlySummary = { grossRevenue: 0, totalExpenses: 0, netProfit: 0, profitPercentage: 0, expensePercentage: 0, expensesByCategory: {} } } = useQuery({
    queryKey: selectedVehicle ? [`/api/vehicles/${selectedVehicle.vehicleId || selectedVehicle._id}/monthly-summary/${selectedMonth}`, selectedMonth] : [],
    refetchInterval: 15000,
  });

  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVehicle) throw new Error("Select vehicle first");
      return (await apiRequest("POST", `/api/vehicles/${selectedVehicle.vehicleId || selectedVehicle._id}/daily-expense`, {
        ...expenseData,
        date: new Date(expenseData.date).toISOString(),
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${selectedVehicle.vehicleId || selectedVehicle._id}/daily-expenses/${selectedMonth}`, selectedMonth] });
      queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${selectedVehicle.vehicleId || selectedVehicle._id}/monthly-summary/${selectedMonth}`, selectedMonth] });
      toast({ title: "Success", description: "Daily expense recorded" });
      setShowExpenseForm(false);
      setExpenseData({ category: "fuel", amount: 0, date: new Date().toISOString().split("T")[0], description: "" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="gradient-header bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">⚙️ Corporate Vehicle Expenses</h1>
            <p className="text-green-100 mt-1">Daily expense tracking & monthly running limits</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>🏢 Select Corporate Company</CardTitle>
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <p className="text-gray-500">Loading companies...</p>
            ) : corporateClients.length === 0 ? (
              <p className="text-gray-500">No corporate clients available. Please create one first.</p>
            ) : (
              <Select value={selectedCompany} onValueChange={(val) => { setSelectedCompany(val); setSelectedVehicle(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a company..." />
                </SelectTrigger>
                <SelectContent>
                  {corporateClients.map((client: any) => (
                    <SelectItem key={client._id} value={client._id}>
                      {client.companyName} ({client.companyCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🚗 Select Vehicle</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedCompany ? (
              <p className="text-gray-500 text-center py-6">Please select a company first</p>
            ) : vehiclesLoading ? (
              <p className="text-gray-500 text-center py-6">Loading vehicles...</p>
            ) : corporateVehicles.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No vehicles attached to this company</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {
                corporateVehicles.map((vehicle: any) => (
                  <button
                    key={vehicle._id}
                    onClick={() => setSelectedVehicle(vehicle)}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      selectedVehicle?._id === vehicle._id
                        ? "border-green-600 bg-green-50"
                        : "border-gray-200 hover:border-green-400 hover:bg-green-50"
                    }`}
                  >
                    <p className="font-medium">{vehicle.make} {vehicle.vehicleModel}</p>
                    <p className="text-xs text-gray-600">{vehicle.licensePlate} • {vehicle.corporateClientName}</p>
                    {vehicle.currentDriver && (
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>👤 {vehicle.currentDriver.name}</p>
                        {vehicle.currentDriver.avgRating && (
                          <p>⭐ Rating: {vehicle.currentDriver.avgRating.toFixed(1)}/5 | Trips: {vehicle.currentDriver.completedTrips || 0}</p>
                        )}
                        {vehicle.currentDriver.onTimePercentage && (
                          <p>🎯 On-time: {vehicle.currentDriver.onTimePercentage.toFixed(0)}% | Safety: {vehicle.currentDriver.safetyScore?.toFixed(1) || 'N/A'}</p>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-1">
                      {vehicle.tripCount > 0 && <Badge variant="outline" className="text-xs">📊 {vehicle.tripCount} trips</Badge>}
                      {vehicle.totalKm > 0 && <Badge variant="outline" className="text-xs">🛣️ {(vehicle.totalKm / 1000).toFixed(0)}k km</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedVehicle && (
          <Card>
            <CardHeader>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedVehicle.make} {selectedVehicle.vehicleModel}</CardTitle>
                    <p className="text-sm text-gray-600">{selectedVehicle.corporateClientName}</p>
                  </div>
                  <Badge variant="outline">{selectedVehicle.licensePlate}</Badge>
                </div>
                {selectedVehicle.currentDriver && (
                  <div className="bg-blue-50 p-3 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">👤 {selectedVehicle.currentDriver.name}</span>
                      {selectedVehicle.currentDriver.avgRating && (
                        <span className="text-sm">⭐ {selectedVehicle.currentDriver.avgRating.toFixed(1)}/5</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                      {selectedVehicle.currentDriver.completedTrips > 0 && (
                        <div>📊 Trips: {selectedVehicle.currentDriver.completedTrips}</div>
                      )}
                      {selectedVehicle.currentDriver.cancelledTrips > 0 && (
                        <div>❌ Cancelled: {selectedVehicle.currentDriver.cancelledTrips}</div>
                      )}
                      {selectedVehicle.currentDriver.onTimePercentage && (
                        <div>🎯 On-time: {selectedVehicle.currentDriver.onTimePercentage.toFixed(0)}%</div>
                      )}
                      {selectedVehicle.currentDriver.safetyScore && (
                        <div>🛡️ Safety: {selectedVehicle.currentDriver.safetyScore.toFixed(1)}/10</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedVehicle.tripCount > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-purple-50 rounded">
                    <p className="text-xs text-gray-600">Total Trips</p>
                    <p className="text-xl font-bold text-purple-600">{selectedVehicle.tripCount}</p>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded">
                    <p className="text-xs text-gray-600">Total KM</p>
                    <p className="text-xl font-bold text-indigo-600">{(selectedVehicle.totalKm / 1000).toFixed(0)}k</p>
                  </div>
                </div>
              )}
              <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                <p className="text-sm text-gray-600">Gross Revenue (Monthly Rate)</p>
                <p className="text-2xl font-bold text-purple-600">₹{monthlySummary.grossRevenue?.toLocaleString("en-IN") || "0"}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
                <p className="text-sm text-gray-600">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">₹{monthlySummary.totalExpenses?.toLocaleString("en-IN") || "0"}</p>
                <p className="text-xs text-gray-600 mt-1">{monthlySummary.expensePercentage}% of revenue</p>
              </div>
              <div className={`p-4 rounded-lg border-2 ${monthlySummary.netProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <p className="text-sm text-gray-600">Net Profit / Final Bill Payable</p>
                <p className={`text-2xl font-bold ${monthlySummary.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ₹{monthlySummary.netProfit?.toLocaleString("en-IN") || "0"}
                </p>
                <p className="text-xs text-gray-600 mt-1">{monthlySummary.profitPercentage}% profit margin</p>
              </div>
              {Object.keys(monthlySummary.expensesByCategory || {}).length > 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Expense Breakdown</p>
                  <div className="space-y-1">
                    {Object.entries(monthlySummary.expensesByCategory || {}).map(([category, data]: any) => (
                      <div key={category} className="flex justify-between text-xs">
                        <span className="capitalize text-gray-600">{category}</span>
                        <span className="font-medium">₹{data.amount?.toLocaleString("en-IN")} ({data.count} entries)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Dialog open={showExpenseForm} onOpenChange={setShowExpenseForm}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 mr-2" /> Add Expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Daily Expense</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Category *</Label>
                        <select
                          className="w-full border rounded px-3 py-2"
                          value={expenseData.category}
                          onChange={(e) => setExpenseData({ ...expenseData, category: e.target.value })}
                        >
                          <option value="fuel">⛽ Fuel</option>
                          <option value="cng">🚗 CNG</option>
                          <option value="petrol">🛢️ Petrol</option>
                          <option value="maintenance">🔧 Maintenance</option>
                          <option value="tolls">🚦 Tolls</option>
                          <option value="parking">🅿️ Parking</option>
                          <option value="cleaning">🧹 Cleaning</option>
                          <option value="insurance">🛡️ Insurance</option>
                          <option value="registration">📋 Registration</option>
                          <option value="other">📌 Other</option>
                        </select>
                      </div>
                      <div>
                        <Label>Amount (₹) *</Label>
                        <Input
                          type="number"
                          value={expenseData.amount}
                          onChange={(e) => setExpenseData({ ...expenseData, amount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Date *</Label>
                        <Input
                          type="date"
                          value={expenseData.date}
                          onChange={(e) => setExpenseData({ ...expenseData, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={expenseData.description}
                          onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                          placeholder="e.g. Fuel at pump XYZ"
                        />
                      </div>
                      <Button onClick={() => addExpenseMutation.mutate()} className="w-full bg-green-600 hover:bg-green-700">
                        Add Expense
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={showLimitForm} onOpenChange={setShowLimitForm}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1">Set Limit</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Set Monthly Running Limit</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Monthly Limit (₹) *</Label>
                        <Input
                          type="number"
                          value={limitData.monthlyLimit}
                          onChange={(e) => setLimitData({ ...limitData, monthlyLimit: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 50000"
                        />
                      </div>
                      <div>
                        <Label>Extra Charge Per ₹ Over Limit</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={limitData.extraChargePerUnit}
                          onChange={(e) => setLimitData({ ...limitData, extraChargePerUnit: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 0.10 (10% surcharge)"
                        />
                      </div>
                      <Button onClick={() => setLimitMutation.mutate()} className="w-full">Set Limit</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedVehicle && (
        <Card>
          <CardHeader>
            <CardTitle>📋 Daily Expenses - {selectedMonth}</CardTitle>
          </CardHeader>
          <CardContent>
            {!dailyExpensesData.entries || dailyExpensesData.entries.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No expenses recorded for this month</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Payment Method</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyExpensesData.entries.map((expense: any) => (
                      <TableRow key={expense._id}>
                        <TableCell className="font-medium">{new Date(expense.date).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-red-600">₹{expense.amount.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-xs capitalize">{expense.paymentMethod || "cash"}</TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-xs truncate">{expense.description || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={expense.status === 'verified' ? 'default' : 'secondary'} className="capitalize">
                            {expense.status || "recorded"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
