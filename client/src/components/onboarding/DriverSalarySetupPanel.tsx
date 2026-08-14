import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Briefcase,
  Landmark,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Minus,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DriverSalarySetupPanelProps {
  driverId: string;
  driverName: string;
  onSalarySetupComplete?: () => void;
  onCancel?: () => void;
  isReadOnly?: boolean;
}

const EMPLOYMENT_TYPES = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
  { value: "probation", label: "Probation" },
  { value: "temporary", label: "Temporary" },
  { value: "casual", label: "Casual" },
];

const SALARY_TYPES = [
  { value: "fixed_monthly", label: "Fixed Monthly" },
  { value: "daily", label: "Daily Rate" },
  { value: "per_trip", label: "Per Trip" },
  { value: "fixed_incentive", label: "Fixed + Incentive" },
  { value: "custom", label: "Custom Structure" },
];

const WEEKLY_OFF_DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface Deduction {
  id?: string;
  type: "advance" | "recharge" | "penalty" | "other";
  amount: number;
  date: string;
  reason?: string;
}

interface SalaryFormData {
  joiningDate: string;
  joiningBaseSalary: number;
  currentBaseSalary: number;
  employmentType: string;
  salaryType: string;
  baseSalary: number;
  perDaySalary?: number;
  perTripSalary?: number;
  kmIncentivePerKm?: number;
  nightAllowancePerNight?: number;
  outstationAllowancePerDay?: number;
  foodAllowance?: number;
  perBookingFoodCharge?: number;
  overtimeRatePerHour?: number;
  extraDutyRate?: number;
  weeklyOffDays: number[];
  weeklyOffLeaveType: "paid" | "unpaid" | "compensatory";
  salaryStartDate: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  deductions?: Deduction[];
}

export default function DriverSalarySetupPanel({
  driverId,
  driverName,
  onSalarySetupComplete,
  onCancel,
  isReadOnly = false,
}: DriverSalarySetupPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("employment");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasInteractedRef = useRef(false);

  const [form, setForm] = useState<SalaryFormData>({
    joiningDate: new Date().toISOString().split("T")[0],
    joiningBaseSalary: 0,
    currentBaseSalary: 0,
    employmentType: "contract",
    salaryType: "fixed_monthly",
    baseSalary: 0,
    weeklyOffDays: [0],
    weeklyOffLeaveType: "unpaid",
    salaryStartDate: new Date().toISOString().split("T")[0],
    deductions: [],
  });

  // Deduction form state
  const [dedType, setDedType] = useState<string>("advance");
  const [dedAmount, setDedAmount] = useState<string>("");
  const [dedDate, setDedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dedReason, setDedReason] = useState<string>("");

  // Fetch existing salary configuration if available
  const { data: existingSalary, isLoading: isLoadingExisting } = useQuery({
    queryKey: [`/api/driver-salary/master/${driverId}`],
    enabled: !isReadOnly,
  });

  useEffect(() => {
    if (existingSalary && !hasInteractedRef.current) {
      const salary = existingSalary.data;
      setForm({
        joiningDate: new Date(salary.joiningDate).toISOString().split("T")[0],
        joiningBaseSalary: salary.joiningBaseSalary || 0,
        currentBaseSalary: salary.currentBaseSalary || 0,
        employmentType: salary.employmentType || "contract",
        salaryType: salary.salaryType || "fixed_monthly",
        baseSalary: salary.baseSalary || 0,
        perDaySalary: salary.perDaySalary,
        perTripSalary: salary.perTripSalary,
        kmIncentivePerKm: salary.kmIncentivePerKm,
        nightAllowancePerNight: salary.nightAllowancePerNight,
        outstationAllowancePerDay: salary.outstationAllowancePerDay,
        foodAllowance: salary.foodAllowance,
        perBookingFoodCharge: salary.perBookingFoodCharge,
        overtimeRatePerHour: salary.overtimeRatePerHour,
        extraDutyRate: salary.extraDutyRate,
        weeklyOffDays: salary.weeklyOffDays || [0],
        weeklyOffLeaveType: salary.weeklyOffLeaveType || "unpaid",
        salaryStartDate: new Date(salary.salaryStartDate).toISOString().split("T")[0],
        bankName: salary.bankName,
        accountNumber: salary.accountNumber,
        ifscCode: salary.ifscCode,
        upiId: salary.upiId,
      });
    }
  }, [existingSalary]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        driverId,
        ...form,
        joiningDate: new Date(form.joiningDate),
        salaryStartDate: new Date(form.salaryStartDate),
      };
      return (await apiRequest("POST", "/api/driver-salary/master", payload)).json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Salary Configuration Saved",
        description: `Salary setup completed for ${driverName}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/driver-salary/master/${driverId}`] });
      onSalarySetupComplete?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error Saving Salary Configuration",
        description: error.message || "Failed to save salary setup",
        variant: "destructive",
      });
    },
  });

  const set = (key: keyof SalaryFormData, value: any) => {
    hasInteractedRef.current = true;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const toggleWeeklyOffDay = (day: number) => {
    setForm((f) => ({
      ...f,
      weeklyOffDays: f.weeklyOffDays.includes(day)
        ? f.weeklyOffDays.filter((d) => d !== day)
        : [...f.weeklyOffDays, day],
    }));
  };

  const handleAddDeduction = () => {
    if (!dedAmount || !dedDate) {
      toast({
        title: "Missing Fields",
        description: "Please provide amount and date",
        variant: "destructive",
      });
      return;
    }

    const newDeduction: Deduction = {
      type: dedType as "advance" | "recharge" | "penalty" | "other",
      amount: parseFloat(dedAmount),
      date: dedDate,
      reason: dedReason,
    };

    setForm(f => ({
      ...f,
      deductions: [...(f.deductions || []), newDeduction],
    }));

    // Reset form
    setDedAmount("");
    setDedDate(new Date().toISOString().split("T")[0]);
    setDedReason("");
    setDedType("advance");

    toast({
      title: "Deduction Added",
      description: `₹${dedAmount} deduction added successfully`,
    });
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.joiningDate || !form.salaryStartDate) {
      toast({
        title: "Missing Information",
        description: "Please provide joining date and salary start date",
        variant: "destructive",
      });
      return;
    }

    if (form.baseSalary <= 0) {
      toast({
        title: "Invalid Salary",
        description: "Base salary must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await saveMutation.mutateAsync();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateEstimatedMonthly = () => {
    let total = form.baseSalary || 0;
    if (form.salaryType === "daily" && form.perDaySalary) {
      total = form.perDaySalary * 26; // Assuming 26 working days
    }
    if (form.foodAllowance) total += form.foodAllowance;
    if (form.nightAllowancePerNight) total += form.nightAllowancePerNight * 4; // Estimated
    if (form.outstationAllowancePerDay) total += form.outstationAllowancePerDay * 4; // Estimated
    return total;
  };

  if (isLoadingExisting) {
    return (
      <Card className="border-slate-200 bg-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Loading salary configuration...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <DollarSign className="text-green-600" size={24} />
            <div>
              <CardTitle className="text-lg">Driver Salary Configuration</CardTitle>
              <CardDescription>{driverName}</CardDescription>
            </div>
          </div>
          {!isReadOnly && existingSalary && (
            <div className="flex items-center space-x-1 text-green-600">
              <CheckCircle2 size={16} />
              <span className="text-xs font-medium">Configured</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isReadOnly && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This driver's salary configuration is locked and cannot be edited.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="employment" className="text-xs sm:text-sm">
              <Briefcase className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Employment</span>
            </TabsTrigger>
            <TabsTrigger value="salary" className="text-xs sm:text-sm">
              <TrendingUp className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Salary</span>
            </TabsTrigger>
            <TabsTrigger value="allowances" className="text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Allowances</span>
            </TabsTrigger>
            <TabsTrigger value="deductions" className="text-xs sm:text-sm">
              <Minus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Deductions</span>
            </TabsTrigger>
            <TabsTrigger value="bank" className="text-xs sm:text-sm">
              <Landmark className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Bank</span>
            </TabsTrigger>
          </TabsList>

          {/* Employment Tab */}
          <TabsContent value="employment" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="joinDate" className="text-sm font-medium">
                  Joining Date *
                </Label>
                <Input
                  id="joinDate"
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => set("joiningDate", e.target.value)}
                  disabled={isReadOnly}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="salaryStartDate" className="text-sm font-medium">
                  Salary Start Date *
                </Label>
                <Input
                  id="salaryStartDate"
                  type="date"
                  value={form.salaryStartDate}
                  onChange={(e) => set("salaryStartDate", e.target.value)}
                  disabled={isReadOnly}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="empType" className="text-sm font-medium">
                  Employment Type *
                </Label>
                <Select
                  value={form.employmentType}
                  onValueChange={(value) => set("employmentType", value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger id="empType" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="joiningBaseSalary" className="text-sm font-medium">
                  Joining Base Salary (₹)
                </Label>
                <Input
                  id="joiningBaseSalary"
                  type="number"
                  min="0"
                  value={form.joiningBaseSalary}
                  onChange={(e) => set("joiningBaseSalary", Number(e.target.value))}
                  disabled={isReadOnly}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-900">Weekly Off Configuration</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {WEEKLY_OFF_DAYS.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => !isReadOnly && toggleWeeklyOffDay(day.value)}
                    className={`p-2 rounded text-xs font-medium transition-colors ${
                      form.weeklyOffDays.includes(day.value)
                        ? "bg-green-600 text-white"
                        : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                    } ${isReadOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                    disabled={isReadOnly}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <Label htmlFor="weeklyOffType" className="text-xs font-medium">
                  Weekly Off Leave Type
                </Label>
                <Select
                  value={form.weeklyOffLeaveType}
                  onValueChange={(value) =>
                    set("weeklyOffLeaveType", value as "paid" | "unpaid" | "compensatory")
                  }
                  disabled={isReadOnly}
                >
                  <SelectTrigger id="weeklyOffType" className="mt-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="compensatory">Compensatory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* Salary Tab */}
          <TabsContent value="salary" className="space-y-4">
            <div>
              <Label htmlFor="salaryType" className="text-sm font-medium">
                Salary Structure *
              </Label>
              <Select
                value={form.salaryType}
                onValueChange={(value) => set("salaryType", value)}
                disabled={isReadOnly}
              >
                <SelectTrigger id="salaryType" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALARY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="baseSalary" className="text-sm font-medium">
                  Current Base Salary (₹) *
                </Label>
                <Input
                  id="baseSalary"
                  type="number"
                  min="0"
                  value={form.baseSalary}
                  onChange={(e) => set("baseSalary", Number(e.target.value))}
                  disabled={isReadOnly}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {form.salaryType === "fixed_monthly"
                    ? "Fixed monthly salary amount"
                    : "Base amount for additional calculations"}
                </p>
              </div>

              {(form.salaryType === "daily" || form.salaryType === "fixed_incentive" || form.salaryType === "custom") && (
                <div>
                  <Label htmlFor="perDaySalary" className="text-sm font-medium">
                    Per Day Salary (₹)
                  </Label>
                  <Input
                    id="perDaySalary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.perDaySalary || ""}
                    onChange={(e) => set("perDaySalary", Number(e.target.value))}
                    disabled={isReadOnly}
                    className="mt-1"
                  />
                </div>
              )}

              {(form.salaryType === "per_trip" || form.salaryType === "fixed_incentive" || form.salaryType === "custom") && (
                <div>
                  <Label htmlFor="perTripSalary" className="text-sm font-medium">
                    Per Trip Salary (₹)
                  </Label>
                  <Input
                    id="perTripSalary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.perTripSalary || ""}
                    onChange={(e) => set("perTripSalary", Number(e.target.value))}
                    disabled={isReadOnly}
                    className="mt-1"
                  />
                </div>
              )}

              {(form.salaryType === "fixed_incentive" || form.salaryType === "custom") && (
                <div>
                  <Label htmlFor="kmIncentive" className="text-sm font-medium">
                    KM Incentive (₹ per KM)
                  </Label>
                  <Input
                    id="kmIncentive"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.kmIncentivePerKm || ""}
                    onChange={(e) => set("kmIncentivePerKm", Number(e.target.value))}
                    disabled={isReadOnly}
                    className="mt-1"
                  />
                </div>
              )}

              {(form.salaryType === "custom") && (
                <>
                  <div>
                    <Label htmlFor="overtimeRate" className="text-sm font-medium">
                      Overtime Rate (₹ per hour)
                    </Label>
                    <Input
                      id="overtimeRate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.overtimeRatePerHour || ""}
                      onChange={(e) => set("overtimeRatePerHour", Number(e.target.value))}
                      disabled={isReadOnly}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="extraDutyRate" className="text-sm font-medium">
                      Extra Duty Rate (₹)
                    </Label>
                    <Input
                      id="extraDutyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.extraDutyRate || ""}
                      onChange={(e) => set("extraDutyRate", Number(e.target.value))}
                      disabled={isReadOnly}
                      className="mt-1"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-slate-900 mb-2">Estimated Monthly Earning</p>
              <p className="text-2xl font-bold text-green-600">₹{calculateEstimatedMonthly().toLocaleString()}</p>
              <p className="text-xs text-slate-600 mt-1">
                Based on current salary structure and configuration (excluding variable components)
              </p>
            </div>
          </TabsContent>

          {/* Allowances Tab */}
          <TabsContent value="allowances" className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
              Add optional allowances and perks to the base salary. Leave blank if not applicable.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="foodAllowance" className="text-sm font-medium">
                  Food Allowance (₹/month)
                </Label>
                <Input
                  id="foodAllowance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.foodAllowance || ""}
                  onChange={(e) => set("foodAllowance", Number(e.target.value) || undefined)}
                  disabled={isReadOnly}
                  className="mt-1"
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="perBookingFood" className="text-sm font-medium">
                  Per Booking Food Charge (₹)
                </Label>
                <Input
                  id="perBookingFood"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.perBookingFoodCharge || ""}
                  onChange={(e) => set("perBookingFoodCharge", Number(e.target.value) || undefined)}
                  disabled={isReadOnly}
                  className="mt-1"
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="nightAllowance" className="text-sm font-medium">
                  Night Allowance (₹/night)
                </Label>
                <Input
                  id="nightAllowance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.nightAllowancePerNight || ""}
                  onChange={(e) => set("nightAllowancePerNight", Number(e.target.value) || undefined)}
                  disabled={isReadOnly}
                  className="mt-1"
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="outstationAllowance" className="text-sm font-medium">
                  Outstation Allowance (₹/day)
                </Label>
                <Input
                  id="outstationAllowance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.outstationAllowancePerDay || ""}
                  onChange={(e) => set("outstationAllowancePerDay", Number(e.target.value) || undefined)}
                  disabled={isReadOnly}
                  className="mt-1"
                  placeholder="0"
                />
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Allowances are added to the base salary for total monthly earning calculations. They can be adjusted in salary generation if needed.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Deductions Tab */}
          <TabsContent value="deductions" className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
              Add and manage salary deductions: advances, recharges, penalties, and other expenses that will be deducted from the final salary.
            </p>

            {/* Add New Deduction Form */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">➕ Add New Deduction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label htmlFor="dedType" className="text-xs font-medium">
                      Type *
                    </Label>
                    <Select value={dedType} onValueChange={setDedType}>
                      <SelectTrigger id="dedType" className="mt-1 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="advance">Advance</SelectItem>
                        <SelectItem value="recharge">Recharge</SelectItem>
                        <SelectItem value="penalty">Penalty</SelectItem>
                        <SelectItem value="other">Other Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="dedAmount" className="text-xs font-medium">
                      Amount (₹) *
                    </Label>
                    <Input
                      id="dedAmount"
                      type="number"
                      placeholder="0"
                      value={dedAmount}
                      onChange={(e) => setDedAmount(e.target.value)}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>

                  <div className="relative">
                    <Label htmlFor="dedDate" className="text-xs font-medium">
                      Date * (📅 Calendar)
                    </Label>
                    <div className="relative mt-1">
                      <input
                        id="dedDate"
                        type="date"
                        value={dedDate}
                        onChange={(e) => setDedDate(e.target.value)}
                        className="w-full h-9 px-3 py-1 border border-slate-300 rounded-md text-sm cursor-pointer appearance-none bg-white"
                        style={{
                          colorScheme: 'light',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'%3E%3C/rect%3E%3Cpath d='M16 2v4M8 2v4M3 10h18'%3E%3C/path%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 6px center',
                          paddingRight: '30px'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="dedReason" className="text-xs font-medium">
                      Reason
                    </Label>
                    <Input
                      id="dedReason"
                      type="text"
                      placeholder="e.g., Mobile recharge"
                      value={dedReason}
                      onChange={(e) => setDedReason(e.target.value)}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddDeduction}
                  className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-xs h-8"
                >
                  ➕ Add Deduction
                </Button>
              </CardContent>
            </Card>

            {/* Advances List */}
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Minus className="w-4 h-4 text-red-600" />
                      <span>Advances</span>
                    </CardTitle>
                    <CardDescription className="text-xs">Outstanding advances taken by driver</CardDescription>
                  </div>
                  <span className="text-lg font-bold text-red-600">
                    ₹{form.deductions?.filter(d => d.type === 'advance').reduce((sum, d) => sum + d.amount, 0).toLocaleString() || '0'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {form.deductions?.filter(d => d.type === 'advance').length ?? 0 > 0 ? (
                  <div className="space-y-2">
                    {form.deductions?.filter(d => d.type === 'advance').map((ded, idx) => (
                      <div key={ded.id || idx} className="flex justify-between items-center p-2 bg-white rounded border border-red-100">
                        <div className="text-sm">
                          <div className="font-medium">₹{ded.amount.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">{new Date(ded.date).toLocaleDateString('en-IN')}</div>
                        </div>
                        {ded.reason && <div className="text-xs text-slate-600">{ded.reason}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    No advances recorded. Add advances using the form above.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recharges List */}
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Minus className="w-4 h-4 text-orange-600" />
                      <span>Recharges</span>
                    </CardTitle>
                    <CardDescription className="text-xs">Mobile recharge & vehicle-related expenses</CardDescription>
                  </div>
                  <span className="text-lg font-bold text-orange-600">
                    ₹{form.deductions?.filter(d => d.type === 'recharge').reduce((sum, d) => sum + d.amount, 0).toLocaleString() || '0'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {form.deductions?.filter(d => d.type === 'recharge').length ?? 0 > 0 ? (
                  <div className="space-y-2">
                    {form.deductions?.filter(d => d.type === 'recharge').map((ded, idx) => (
                      <div key={ded.id || idx} className="flex justify-between items-center p-2 bg-white rounded border border-orange-100">
                        <div className="text-sm">
                          <div className="font-medium">₹{ded.amount.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">{new Date(ded.date).toLocaleDateString('en-IN')}</div>
                        </div>
                        {ded.reason && <div className="text-xs text-slate-600">{ded.reason}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    No recharges recorded. Add recharges using the form above.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Penalties List */}
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <span>Penalties</span>
                    </CardTitle>
                    <CardDescription className="text-xs">Traffic violations, damage & disciplinary charges</CardDescription>
                  </div>
                  <span className="text-lg font-bold text-yellow-600">
                    ₹{form.deductions?.filter(d => d.type === 'penalty').reduce((sum, d) => sum + d.amount, 0).toLocaleString() || '0'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {form.deductions?.filter(d => d.type === 'penalty').length ?? 0 > 0 ? (
                  <div className="space-y-2">
                    {form.deductions?.filter(d => d.type === 'penalty').map((ded, idx) => (
                      <div key={ded.id || idx} className="flex justify-between items-center p-2 bg-white rounded border border-yellow-100">
                        <div className="text-sm">
                          <div className="font-medium">₹{ded.amount.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">{new Date(ded.date).toLocaleDateString('en-IN')}</div>
                        </div>
                        {ded.reason && <div className="text-xs text-slate-600">{ded.reason}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    No penalties recorded. Add penalties using the form above.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Other Expenses List */}
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Minus className="w-4 h-4 text-purple-600" />
                      <span>Other Expenses</span>
                    </CardTitle>
                    <CardDescription className="text-xs">Miscellaneous deductions & recovery amounts</CardDescription>
                  </div>
                  <span className="text-lg font-bold text-purple-600">
                    ₹{form.deductions?.filter(d => d.type === 'other').reduce((sum, d) => sum + d.amount, 0).toLocaleString() || '0'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {form.deductions?.filter(d => d.type === 'other').length ?? 0 > 0 ? (
                  <div className="space-y-2">
                    {form.deductions?.filter(d => d.type === 'other').map((ded, idx) => (
                      <div key={ded.id || idx} className="flex justify-between items-center p-2 bg-white rounded border border-purple-100">
                        <div className="text-sm">
                          <div className="font-medium">₹{ded.amount.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">{new Date(ded.date).toLocaleDateString('en-IN')}</div>
                        </div>
                        {ded.reason && <div className="text-xs text-slate-600">{ded.reason}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    No other expenses recorded. Add expenses using the form above.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Total Deductions Summary */}
            <Card className="border-red-500 bg-red-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-red-900">💰 Total Monthly Deductions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  {(() => {
                    const totalDed = form.deductions?.reduce((sum, d) => sum + d.amount, 0) || 0;
                    const base = parseFloat(form.baseSalary?.toString() || "0") || 0;
                    const allowances = (form.foodAllowance || 0) + (form.nightAllowancePerNight || 0) + (form.outstationAllowancePerDay || 0) + (form.perBookingFoodCharge || 0) + (form.kmIncentivePerKm || 0) + (form.overtimeRatePerHour || 0) + (form.extraDutyRate || 0);
                    const netSalary = base + allowances - totalDed;
                    return (
                      <>
                        <div className="text-3xl font-bold text-red-700">₹{totalDed.toLocaleString()}</div>
                        <p className="text-xs text-red-600 mt-2">Advances + Recharges + Penalties + Other = Final Deduction</p>
                        <p className="text-xs text-red-700 mt-1 font-semibold">
                          Net Salary = ₹{base.toLocaleString()} + ₹{allowances.toLocaleString()} - ₹{totalDed.toLocaleString()} = <span className="text-green-600 font-bold">₹{Math.max(0, netSalary).toLocaleString()}</span>
                        </p>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Add all deductions above. They will be automatically calculated and deducted from the final salary amount that gets transferred to the driver's account.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Bank Details Tab */}
          <TabsContent value="bank" className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
              Add payment details for salary transfers. Provide either bank details or UPI ID.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bankName" className="text-sm font-medium">
                  Bank Name
                </Label>
                <Input
                  id="bankName"
                  type="text"
                  value={form.bankName || ""}
                  onChange={(e) => set("bankName", e.target.value || undefined)}
                  disabled={isReadOnly}
                  className="mt-1"
                  placeholder="e.g., HDFC Bank"
                />
              </div>

              <div>
                <Label htmlFor="accountNumber" className="text-sm font-medium">
                  Account Number
                </Label>
                <Input
                  id="accountNumber"
                  type="text"
                  value={form.accountNumber || ""}
                  onChange={(e) => set("accountNumber", e.target.value || undefined)}
                  disabled={isReadOnly}
                  className="mt-1"
                  placeholder="1234567890"
                />
              </div>

              <div>
                <Label htmlFor="ifscCode" className="text-sm font-medium">
                  IFSC Code
                </Label>
                <Input
                  id="ifscCode"
                  type="text"
                  value={form.ifscCode || ""}
                  onChange={(e) => set("ifscCode", (e.target.value || "").toUpperCase())}
                  disabled={isReadOnly}
                  className="mt-1"
                  placeholder="HDFC0000123"
                />
              </div>

              <div>
                <Label htmlFor="upiId" className="text-sm font-medium">
                  UPI ID (Alternative)
                </Label>
                <Input
                  id="upiId"
                  type="text"
                  value={form.upiId || ""}
                  onChange={(e) => set("upiId", e.target.value || undefined)}
                  disabled={isReadOnly}
                  className="mt-1"
                  placeholder="driver@upi"
                />
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Bank details will be used for automatic salary transfers. Ensure the account number and IFSC code are correct to avoid payment failures.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        {!isReadOnly && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 gap-3">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !form.baseSalary}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Saving..." : existingSalary ? "Update Configuration" : "Create Configuration"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
