import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Trash2, Users, Key, Eye, EyeOff, Mail, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Form schema for creating new sub-users
const createSubUserSchema = z.object({
  userId: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

type CreateSubUserForm = z.infer<typeof createSubUserSchema>;

// Always granted to a new manager, matching this form's pre-existing
// default (server/routes.ts POST /api/users/sub-users falls back to the
// same list when no permissions are supplied).
const DEFAULT_MANAGER_PERMISSIONS = ["create_booking", "view_bookings", "edit_booking", "generate_invoice"];

// Vehicle 360 batch permissions (Final Vehicle 360 Integrator, "Open
// follow-ups" #3) — the only additional permissions this UI exposes for
// now. Must match server/routes.ts's MANAGER_ASSIGNABLE_PERMISSIONS.
const VEHICLE_PERMISSIONS: Array<{ value: string; label: string }> = [
  { value: "vehicle.compliance.view", label: "Vehicle Compliance — View" },
  { value: "vehicle.compliance.manage", label: "Vehicle Compliance — Manage" },
  { value: "vehicle.maintenance.view", label: "Vehicle Maintenance — View" },
  { value: "vehicle.maintenance.manage", label: "Vehicle Maintenance — Manage" },
  { value: "vehicle.expense.view", label: "Vehicle Fuel/Expenses — View" },
  { value: "vehicle.expense.manage", label: "Vehicle Fuel/Expenses — Manage" },
  { value: "vehicle.fastag.view", label: "Vehicle FASTag/Toll — View" },
  { value: "vehicle.fastag.manage", label: "Vehicle FASTag/Toll — Manage" },
  { value: "vehicle.incidents.view", label: "Vehicle Incidents — View" },
  { value: "vehicle.incidents.manage", label: "Vehicle Incidents — Manage" },
];

export default function UserManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedVehiclePermissions, setSelectedVehiclePermissions] = useState<string[]>([]);
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<any | null>(null);
  const [editVehiclePermissions, setEditVehiclePermissions] = useState<string[]>([]);
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
      console.log("Creating manager with data:", data);
      const requestBody = {
        userId: data.userId,
        password: data.password,
        name: data.name,
        role: "manager",
        permissions: [...DEFAULT_MANAGER_PERMISSIONS, ...selectedVehiclePermissions],
      };
      console.log("Request body:", requestBody);
      
      const response = await apiRequest("POST", "/api/users/sub-users", requestBody);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/sub-users"] });
      setIsCreateDialogOpen(false);
      setSelectedVehiclePermissions([]);
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

  // Update an existing manager's vehicle.* permissions
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: string[] }) => {
      const response = await apiRequest("PATCH", `/api/users/sub-users/${userId}/permissions`, { permissions });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/sub-users"] });
      setEditingPermissionsUser(null);
      toast({
        variant: "success",
        title: "Permissions Updated",
        description: "Manager permissions have been updated successfully.",
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

  const openEditPermissions = (targetUser: any) => {
    const current: string[] = Array.isArray(targetUser.permissions) ? targetUser.permissions : [];
    setEditVehiclePermissions(current.filter((p) => VEHICLE_PERMISSIONS.some((vp) => vp.value === p)));
    setEditingPermissionsUser(targetUser);
  };

  const handleSavePermissions = () => {
    if (!editingPermissionsUser) return;
    const existingNonVehicle: string[] = (Array.isArray(editingPermissionsUser.permissions) ? editingPermissionsUser.permissions : [])
      .filter((p: string) => DEFAULT_MANAGER_PERMISSIONS.includes(p));
    updatePermissionsMutation.mutate({
      userId: editingPermissionsUser.userId,
      permissions: [...existingNonVehicle, ...editVehiclePermissions],
    });
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
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Manager</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

                <div className="space-y-2">
                  <Label>Vehicle 360 Permissions (optional)</Label>
                  <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2">
                    {VEHICLE_PERMISSIONS.map((perm) => (
                      <div key={perm.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`create-${perm.value}`}
                          checked={selectedVehiclePermissions.includes(perm.value)}
                          onCheckedChange={(checked) => {
                            setSelectedVehiclePermissions((prev) =>
                              checked ? [...prev, perm.value] : prev.filter((p) => p !== perm.value),
                            );
                          }}
                        />
                        <label htmlFor={`create-${perm.value}`} className="text-sm">{perm.label}</label>
                      </div>
                    ))}
                  </div>
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
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => openEditPermissions(user)}
                      >
                        <Key className="w-4 h-4 mr-2" />
                        Edit Permissions
                      </Button>
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
                    </div>
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

      <Dialog open={!!editingPermissionsUser} onOpenChange={(open) => !open && setEditingPermissionsUser(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Permissions — {editingPermissionsUser?.name || editingPermissionsUser?.userId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Vehicle 360 Permissions</Label>
            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
              {VEHICLE_PERMISSIONS.map((perm) => (
                <div key={perm.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`edit-${perm.value}`}
                    checked={editVehiclePermissions.includes(perm.value)}
                    onCheckedChange={(checked) => {
                      setEditVehiclePermissions((prev) =>
                        checked ? [...prev, perm.value] : prev.filter((p) => p !== perm.value),
                      );
                    }}
                  />
                  <label htmlFor={`edit-${perm.value}`} className="text-sm">{perm.label}</label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              className="flex-1"
              onClick={handleSavePermissions}
              disabled={updatePermissionsMutation.isPending}
            >
              {updatePermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
            </Button>
            <Button variant="outline" onClick={() => setEditingPermissionsUser(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}