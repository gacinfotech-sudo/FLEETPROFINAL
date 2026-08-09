import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Trash2, Users, Key, Eye, EyeOff, Mail, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";

// Form schema for creating new sub-users
const createSubUserSchema = z.object({
  userId: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

type CreateSubUserForm = z.infer<typeof createSubUserSchema>;

// Permission groups for Vehicle 360
const PERMISSION_GROUPS = {
  bookings: {
    label: 'Bookings',
    permissions: [
      { id: 'create_booking', label: 'Create Booking' },
      { id: 'view_bookings', label: 'View Bookings' },
      { id: 'edit_booking', label: 'Edit Booking' },
      { id: 'delete_booking', label: 'Delete Booking' },
      { id: 'generate_invoice', label: 'Generate Invoice' },
    ],
  },
  vehicle360: {
    label: 'Vehicle 360',
    permissions: [
      { id: 'vehicle.view', label: 'View Vehicles', manage: false },
      { id: 'vehicle.manage', label: 'Manage Vehicles', manage: true },
      { id: 'vehicle.gps.view', label: 'View GPS Tracking', manage: false },
      { id: 'vehicle.gps.manage', label: 'Manage GPS', manage: true },
      { id: 'vehicle.performance.view', label: 'View Performance', manage: false },
      { id: 'vehicle.compliance.view', label: 'View Compliance', manage: false },
      { id: 'vehicle.compliance.manage', label: 'Manage Compliance', manage: true },
      { id: 'vehicle.documents.view', label: 'View Documents', manage: false },
      { id: 'vehicle.documents.manage', label: 'Manage Documents', manage: true },
      { id: 'vehicle.maintenance.view', label: 'View Maintenance', manage: false },
      { id: 'vehicle.maintenance.manage', label: 'Manage Maintenance', manage: true },
      { id: 'vehicle.fuel.view', label: 'View Fuel/Expenses', manage: false },
      { id: 'vehicle.fuel.manage', label: 'Manage Fuel/Expenses', manage: true },
      { id: 'vehicle.expenses.view', label: 'View Expenses', manage: false },
      { id: 'vehicle.expenses.manage', label: 'Manage Expenses', manage: true },
      { id: 'vehicle.bookings.view', label: 'View Vehicle Bookings', manage: false },
      { id: 'vehicle.driver_assignment.view', label: 'View Driver Assignment', manage: false },
      { id: 'vehicle.driver_assignment.manage', label: 'Manage Driver Assignment', manage: true },
      { id: 'vehicle.financials.view', label: 'View Vehicle Financials', manage: false },
      { id: 'vehicle.alerts.view', label: 'View Alerts', manage: false },
      { id: 'vehicle.alerts.manage', label: 'Manage Alerts', manage: true },
    ],
  },
};

export default function UserManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set(['create_booking', 'view_bookings', 'edit_booking', 'generate_invoice', 'vehicle.view']));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['bookings']));
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<CreateSubUserForm>({
    resolver: zodResolver(createSubUserSchema),
    defaultValues: {
      userId: "",
      password: "",
      name: "",
    },
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const selectAllVehicle360 = () => {
    const allVehicle360Perms = new Set(selectedPermissions);
    PERMISSION_GROUPS.vehicle360.permissions.forEach(perm => {
      allVehicle360Perms.add(perm.id);
    });
    setSelectedPermissions(allVehicle360Perms);
  };

  const clearAllVehicle360 = () => {
    const remaining = new Set(selectedPermissions);
    PERMISSION_GROUPS.vehicle360.permissions.forEach(perm => {
      remaining.delete(perm.id);
    });
    setSelectedPermissions(remaining);
  };

  // Fetch sub-users
  const { data: subUsers = [], isLoading } = useQuery({
    queryKey: ["/api/users/sub-users"],
  });

  // Fetch tenant info for manager limits
  const { data: tenantInfo } = useQuery({
    queryKey: ["/api/auth/business-profile"],
    enabled: !!user?.tenantId,
  });

  // Type-safe access to subUsers
  const typedSubUsers = Array.isArray(subUsers) ? subUsers : [];
  
  // Calculate manager limits  
  const maxManagers = (tenantInfo as any)?.maxManagers || 5;
  const currentManagerCount = typedSubUsers.filter(user => user.role === 'manager' && user.isActive).length;
  const isLimitReached = currentManagerCount >= maxManagers;
  const remainingSlots = maxManagers - currentManagerCount;

  // Create sub-user mutation
  const createSubUserMutation = useMutation({
    mutationFn: async (data: CreateSubUserForm) => {
      const requestBody = {
        userId: data.userId,
        password: data.password,
        name: data.name,
        role: "manager",
        permissions: Array.from(selectedPermissions)
      };

      const response = await apiRequest("POST", "/api/users/sub-users", requestBody);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/sub-users"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        variant: "success",
        title: "Manager Created!",
        description: "New manager account has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Deactivate sub-user mutation
  const deactivateSubUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/users/sub-users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/sub-users"] });
      toast({
        variant: "success",
        title: "Manager Deactivated",
        description: "Manager account has been deactivated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Reactivate sub-user mutation
  const reactivateSubUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("PATCH", `/api/users/sub-users/${userId}/reactivate`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/sub-users"] });
      toast({
        variant: "success",
        title: "Manager Reactivated",
        description: "Manager account has been reactivated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const onSubmit = (data: CreateSubUserForm) => {
    // Check if manager limit is reached
    if (isLimitReached) {
      toast({
        variant: "destructive",
        title: "Manager Limit Reached",
        description: `You have reached your limit of ${maxManagers} manager users. Please contact admin@mgroww.com to upgrade your plan.`,
      });
      return;
    }
    
    console.log("Form submitted with data:", data);
    createSubUserMutation.mutate(data);
  };

  const handleDeactivateUser = (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to deactivate ${userName}? They will no longer be able to access the system.`)) {
      deactivateSubUserMutation.mutate(userId);
    }
  };

  const handleReactivateUser = (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to reactivate ${userName}? They will regain access to the system.`)) {
      reactivateSubUserMutation.mutate(userId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading managers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Manage Users</h2>
          <p className="text-muted-foreground">
            Create and manage manager accounts for your team
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            form.reset();
            setSelectedPermissions(new Set(['create_booking', 'view_bookings', 'edit_booking', 'generate_invoice', 'vehicle.view']));
            setExpandedGroups(new Set(['bookings']));
          }
        }}>
          <DialogTrigger asChild>
            <Button 
              disabled={isLimitReached}
              onClick={(e) => {
                if (isLimitReached) {
                  e.preventDefault();
                  toast({
                    variant: "destructive",
                    title: "Manager Limit Reached",
                    description: `You have reached your limit of ${maxManagers} manager users. Please contact admin@mgroww.com to upgrade your plan.`,
                  });
                }
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Manager
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Manager</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="manager@company.com"
                          type="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter password"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Permissions Section */}
                <div className="space-y-3 pt-2 border-t">
                  <div>
                    <Label className="text-base font-semibold">Permissions</Label>
                    <p className="text-sm text-gray-600 mt-1">Select which features this manager can access</p>
                  </div>

                  {Object.entries(PERMISSION_GROUPS).map(([groupId, group]) => (
                    <div key={groupId} className="border rounded-lg">
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupId)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium text-sm">{group.label}</span>
                        {expandedGroups.has(groupId) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      {expandedGroups.has(groupId) && (
                        <div className="px-4 py-3 bg-gray-50 border-t space-y-2">
                          {groupId === 'vehicle360' && (
                            <div className="flex gap-2 mb-3 pb-3 border-b">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={selectAllVehicle360}
                              >
                                Select All
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={clearAllVehicle360}
                              >
                                Clear All
                              </Button>
                            </div>
                          )}

                          {group.permissions.map((perm) => (
                            <div key={perm.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={perm.id}
                                checked={selectedPermissions.has(perm.id)}
                                onCheckedChange={() => togglePermission(perm.id)}
                              />
                              <Label htmlFor={perm.id} className="text-sm cursor-pointer font-normal">
                                {perm.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="submit" 
                    disabled={createSubUserMutation.isPending}
                    className="flex-1"
                  >
                    {createSubUserMutation.isPending ? "Creating..." : "Create Manager"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Manager Limit Notice - Only show for client users */}
      {user?.role === 'client' && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>🧑‍💼 Manager Limit:</strong> You can currently create <strong>{remainingSlots > 0 ? remainingSlots : 0} more manager{remainingSlots !== 1 ? 's' : ''}</strong> for your business (using {currentManagerCount} of {maxManagers}).
                {isLimitReached && (
                  <span className="block mt-1">
                    🚀 To increase this limit, please{' '}
                    <a 
                      href="mailto:admin@mgroww.com" 
                      className="underline hover:text-blue-900 font-medium"
                    >
                      contact admin
                    </a>
                    {' '}to upgrade your plan.
                  </span>
                )}
              </div>
              {!isLimitReached && (
                <Mail className="h-4 w-4 text-blue-600 ml-2" />
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Sub-users List */}
      {typedSubUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Managers Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create manager accounts to allow team members to access the booking system
            </p>
            <Button 
              onClick={(e) => {
                if (isLimitReached) {
                  e.preventDefault();
                  toast({
                    variant: "destructive",
                    title: "Manager Limit Reached",
                    description: `You have reached your limit of ${maxManagers} manager users. Please contact admin@mgroww.com to upgrade your plan.`,
                  });
                } else {
                  setIsCreateDialogOpen(true);
                }
              }}
              disabled={isLimitReached}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add First Manager
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {typedSubUsers.map((user: any) => (
            <Card key={user._id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{user.userId}</CardTitle>
                <CardDescription>
                  <Badge variant="secondary" className="w-fit">
                    {user.role}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <strong>Status:</strong>{" "}
                    <Badge variant={user.isActive ? "default" : "destructive"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <strong>Created:</strong>{" "}
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <strong>Permissions:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.permissions?.map((permission: string) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission.replace(/_/g, " ")}
                        </Badge>
                      )) || <span className="text-xs">No permissions set</span>}
                    </div>
                  </div>

                  {user.isActive ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => handleDeactivateUser(user.userId, user.name || user.userId)}
                      disabled={deactivateSubUserMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => handleReactivateUser(user.userId, user.name || user.userId)}
                      disabled={reactivateSubUserMutation.isPending}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Reactivate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}