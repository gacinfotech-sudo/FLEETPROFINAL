import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Calendar,
  Clock,
  Gift,
  MoreHorizontal,
  Plus,
  Settings,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const DAY_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function LeaveConfigurationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [holidayDialog, setHolidayDialog] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: "", name: "" });
  const [selectedHolidayForDelete, setSelectedHolidayForDelete] = useState<string | null>(null);

  // Queries
  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/leave-configuration"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leave-configuration");
      return res.json();
    },
  });

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/leave-configuration", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-configuration"] });
      toast({ title: "Configuration updated successfully" });
      setEditingSection(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update configuration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addHolidayMutation = useMutation({
    mutationFn: async (holiday: { date: string; name: string }) => {
      const res = await apiRequest("POST", "/api/leave-configuration/holidays", holiday);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-configuration"] });
      toast({ title: "Holiday added successfully" });
      setHolidayDialog(false);
      setNewHoliday({ date: "", name: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add holiday",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeHolidayMutation = useMutation({
    mutationFn: async (date: string) => {
      const res = await apiRequest("DELETE", `/api/leave-configuration/holidays/${date}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-configuration"] });
      toast({ title: "Holiday removed successfully" });
      setSelectedHolidayForDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove holiday",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading leave configuration...</div>
      </div>
    );
  }

  const data = config?.data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Configuration</h1>
          <p className="text-sm text-gray-500">
            Manage organizational leave policies and holidays
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <AlertCircle className="w-4 h-4 mr-2" />
            View Audit Log
          </Button>
        </div>
      </div>

      {/* Paid Leave Policy */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-blue-600" />
            <CardTitle>Paid Leave Policy</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingSection(editingSection === "paid" ? null : "paid")}
          >
            <Settings className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Annual Quota</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.paidLeavePolicy?.annualQuota || 12}
              </div>
              <div className="text-xs text-gray-400 mt-1">days/year</div>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Accrual Type</div>
              <div className="text-lg font-semibold text-gray-900 capitalize">
                {data.paidLeavePolicy?.accrualType || "monthly"}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {data.paidLeavePolicy?.accrualValue || 1} day(s) per period
              </div>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Carry Forward</div>
              <div className="text-lg font-semibold text-gray-900">
                {data.paidLeavePolicy?.carryForwardAllowed ? "Allowed" : "Not Allowed"}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Max: {data.paidLeavePolicy?.maxCarryForward || 5} days
              </div>
            </div>
          </div>

          {editingSection === "paid" && (
            <PaidLeavePolicyForm
              policy={data.paidLeavePolicy}
              onSave={(policy) => {
                updateConfigMutation.mutate({
                  paidLeavePolicy: policy,
                });
              }}
              onCancel={() => setEditingSection(null)}
              isSaving={updateConfigMutation.isPending}
            />
          )}
        </CardContent>
      </Card>

      {/* Unpaid Leave Policy */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <CardTitle>Unpaid Leave Policy</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingSection(editingSection === "unpaid" ? null : "unpaid")}
          >
            <Settings className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className="text-lg font-semibold text-gray-900">
                {data.unpaidLeavePolicy?.allowUnpaid ? "Allowed" : "Not Allowed"}
              </div>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Max Consecutive Days</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.unpaidLeavePolicy?.maxConsecutiveDays || 30}
              </div>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Salary Deduction</div>
              <div className="text-lg font-semibold text-gray-900 capitalize">
                {data.unpaidLeavePolicy?.deductionType || "full"}
              </div>
            </div>
          </div>

          {editingSection === "unpaid" && (
            <UnpaidLeavePolicyForm
              policy={data.unpaidLeavePolicy}
              onSave={(policy) => {
                updateConfigMutation.mutate({
                  unpaidLeavePolicy: policy,
                });
              }}
              onCancel={() => setEditingSection(null)}
              isSaving={updateConfigMutation.isPending}
            />
          )}
        </CardContent>
      </Card>

      {/* Weekly Off Policy */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            <CardTitle>Weekly Off Policy</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingSection(editingSection === "weekly" ? null : "weekly")}
          >
            <Settings className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Weekly Off Day</div>
              <div className="text-lg font-semibold text-gray-900">
                {DAY_OF_WEEK[data.weeklyOffPolicy?.dayOfWeek || 0]}
              </div>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Alternate Weekly Off</div>
              <div className="text-lg font-semibold text-gray-900">
                {data.weeklyOffPolicy?.alternateWeeklyOff ? "Yes" : "No"}
              </div>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Comp Off Allowed</div>
              <div className="text-lg font-semibold text-gray-900">
                {data.weeklyOffPolicy?.compensatoryOffAllowed ? "Yes" : "No"}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Expires in {data.weeklyOffPolicy?.compOffExpiryDays || 30} days
              </div>
            </div>
          </div>

          {editingSection === "weekly" && (
            <WeeklyOffPolicyForm
              policy={data.weeklyOffPolicy}
              onSave={(policy) => {
                updateConfigMutation.mutate({
                  weeklyOffPolicy: policy,
                });
              }}
              onCancel={() => setEditingSection(null)}
              isSaving={updateConfigMutation.isPending}
            />
          )}
        </CardContent>
      </Card>

      {/* Medical Leave Policy */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <CardTitle>Medical Leave Policy</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Annual Quota</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.medicalLeavePolicy?.annualQuota || 6}
              </div>
              <div className="text-xs text-gray-400 mt-1">days/year</div>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Certificate Required After</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.medicalLeavePolicy?.certificateAfterDays || 3}
              </div>
              <div className="text-xs text-gray-400 mt-1">days</div>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className="text-lg font-semibold text-gray-900">
                {data.medicalLeavePolicy?.requiresCertificate ? "Certificate Required" : "No Certificate Needed"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Holiday Calendar */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            <CardTitle>Holiday Calendar</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHolidayDialog(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Holiday
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.holidayPolicy?.holidays && data.holidayPolicy.holidays.length > 0 ? (
            <div className="space-y-2">
              {data.holidayPolicy.holidays.map((holiday: any) => (
                <div
                  key={holiday.date}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{holiday.name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(holiday.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setSelectedHolidayForDelete(holiday.date)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No holidays configured yet</p>
          )}
        </CardContent>
      </Card>

      {/* Add Holiday Dialog */}
      <Dialog open={holidayDialog} onOpenChange={setHolidayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Holiday Name</Label>
              <Input
                placeholder="e.g., Independence Day"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newHoliday.date && newHoliday.name) {
                  addHolidayMutation.mutate(newHoliday);
                }
              }}
              disabled={!newHoliday.date || !newHoliday.name || addHolidayMutation.isPending}
            >
              Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Holiday Confirmation */}
      <Dialog open={!!selectedHolidayForDelete} onOpenChange={(v) => { if (!v) setSelectedHolidayForDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to remove this holiday? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedHolidayForDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedHolidayForDelete) {
                  removeHolidayMutation.mutate(selectedHolidayForDelete);
                }
              }}
              disabled={removeHolidayMutation.isPending}
            >
              Delete Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-components for policy forms
function PaidLeavePolicyForm({ policy, onSave, onCancel, isSaving }: any) {
  const [formData, setFormData] = useState(policy);

  return (
    <div className="border-t pt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Annual Quota (days)</Label>
          <Input
            type="number"
            min="0"
            max="365"
            value={formData.annualQuota}
            onChange={(e) => setFormData({ ...formData, annualQuota: parseInt(e.target.value) })}
          />
        </div>
        <div>
          <Label>Accrual Type</Label>
          <Select value={formData.accrualType} onValueChange={(v) => setFormData({ ...formData, accrualType: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Accrual Value</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={formData.accrualValue}
            onChange={(e) => setFormData({ ...formData, accrualValue: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <Label>Max Carry Forward (days)</Label>
          <Input
            type="number"
            min="0"
            value={formData.maxCarryForward}
            onChange={(e) => setFormData({ ...formData, maxCarryForward: parseInt(e.target.value) })}
          />
        </div>
        <div>
          <Label>Expiry Period (months)</Label>
          <Input
            type="number"
            min="0"
            value={formData.expiryMonths}
            onChange={(e) => setFormData({ ...formData, expiryMonths: parseInt(e.target.value) })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="carryForward"
          checked={formData.carryForwardAllowed}
          onCheckedChange={(v) => setFormData({ ...formData, carryForwardAllowed: !!v })}
        />
        <Label htmlFor="carryForward" className="text-sm">Allow carry forward of unused leaves</Label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(formData)} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Policy"}
        </Button>
      </div>
    </div>
  );
}

function UnpaidLeavePolicyForm({ policy, onSave, onCancel, isSaving }: any) {
  const [formData, setFormData] = useState(policy);

  return (
    <div className="border-t pt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Max Consecutive Days</Label>
          <Input
            type="number"
            min="0"
            value={formData.maxConsecutiveDays}
            onChange={(e) => setFormData({ ...formData, maxConsecutiveDays: parseInt(e.target.value) })}
          />
        </div>
        <div>
          <Label>Salary Deduction</Label>
          <Select value={formData.deductionType} onValueChange={(v) => setFormData({ ...formData, deductionType: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full Deduction</SelectItem>
              <SelectItem value="half">Half Deduction</SelectItem>
              <SelectItem value="none">No Deduction</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="allowUnpaid"
            checked={formData.allowUnpaid}
            onCheckedChange={(v) => setFormData({ ...formData, allowUnpaid: !!v })}
          />
          <Label htmlFor="allowUnpaid" className="text-sm">Allow unpaid leave</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="requireApproval"
            checked={formData.requireApproval}
            onCheckedChange={(v) => setFormData({ ...formData, requireApproval: !!v })}
          />
          <Label htmlFor="requireApproval" className="text-sm">Require approval</Label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(formData)} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Policy"}
        </Button>
      </div>
    </div>
  );
}

function WeeklyOffPolicyForm({ policy, onSave, onCancel, isSaving }: any) {
  const [formData, setFormData] = useState(policy);

  return (
    <div className="border-t pt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Weekly Off Day</Label>
          <Select value={String(formData.dayOfWeek)} onValueChange={(v) => setFormData({ ...formData, dayOfWeek: parseInt(v) })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_OF_WEEK.map((day, index) => (
                <SelectItem key={index} value={String(index)}>{day}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Comp Off Expiry (days)</Label>
          <Input
            type="number"
            min="0"
            value={formData.compOffExpiryDays}
            onChange={(e) => setFormData({ ...formData, compOffExpiryDays: parseInt(e.target.value) })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="alternateWeekly"
            checked={formData.alternateWeeklyOff}
            onCheckedChange={(v) => setFormData({ ...formData, alternateWeeklyOff: !!v })}
          />
          <Label htmlFor="alternateWeekly" className="text-sm">Enable alternate weekly off</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="compOff"
            checked={formData.compensatoryOffAllowed}
            onCheckedChange={(v) => setFormData({ ...formData, compensatoryOffAllowed: !!v })}
          />
          <Label htmlFor="compOff" className="text-sm">Allow compensatory off</Label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(formData)} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Policy"}
        </Button>
      </div>
    </div>
  );
}
