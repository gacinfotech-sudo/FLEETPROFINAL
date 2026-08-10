// TASK-ROOT-SALES-CONFIG-04 — Product Configuration + Plan catalog page.
//
// Not wired into client/src/App.tsx or the sidebar nav (both Integrator-only
// shared files) — see this task's report for the proposed route path
// ("/root/product-config") and nav entry. Talks to the routes proposed in
// server/root/routes/config.ts (also not yet mounted — see report).

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface ProductConfig {
  _id: string;
  productName: string;
  supportEmail?: string;
  supportPhone?: string;
  branding: { logoUrl?: string; primaryColor?: string; companyLegalName?: string };
}

interface Plan {
  _id: string;
  code: "STARTER" | "PROFESSIONAL" | "ENTERPRISE" | "CUSTOM";
  name: string;
  isActive: boolean;
  legacySubscriptionPlan?: string;
  limits: {
    maxVehicles: number;
    maxDrivers: number;
    maxManagers: number;
    maxCustomers: number;
    maxStorageGB: number;
    maxApiCallsPerDay: number;
  };
  features: Record<string, boolean>;
}

export default function ProductConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config } = useQuery<ProductConfig>({ queryKey: ["/api/root/config"] });
  const { data: plans = [] } = useQuery<Plan[]>({ queryKey: ["/api/root/plans"] });

  const [form, setForm] = useState<Partial<ProductConfig> | null>(null);
  const active = form ?? config;

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ProductConfig>) => {
      const res = await apiRequest("PATCH", "/api/root/config", data);
      if (!res.ok) throw new Error((await res.json()).message || "Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/root/config"] });
      toast({ title: "Product configuration saved" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* Beautiful Gradient Header */}
      <div className="gradient-header bg-gradient-to-r from-teal-600 to-green-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">⚙️ Product Configuration</h1>
        <p className="text-teal-100 mt-1">Global branding, support contacts, and plan catalog</p>
      </div>

      <div className="p-6">

      <Card>
        <CardHeader><CardTitle>Branding &amp; Support</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Product name</Label>
              <Input
                value={active?.productName ?? ""}
                onChange={(e) => setForm({ ...active, productName: e.target.value })}
                data-testid="input-product-name"
              />
            </div>
            <div>
              <Label>Support email</Label>
              <Input
                value={active?.supportEmail ?? ""}
                onChange={(e) => setForm({ ...active, supportEmail: e.target.value })}
                data-testid="input-support-email"
              />
            </div>
            <div>
              <Label>Support phone</Label>
              <Input
                value={active?.supportPhone ?? ""}
                onChange={(e) => setForm({ ...active, supportPhone: e.target.value })}
              />
            </div>
            <div>
              <Label>Company legal name</Label>
              <Input
                value={active?.branding?.companyLegalName ?? ""}
                onChange={(e) => setForm({ ...active, branding: { ...active?.branding, companyLegalName: e.target.value } })}
              />
            </div>
          </div>
          <Button onClick={() => active && saveMutation.mutate(active)} disabled={saveMutation.isPending} data-testid="button-save-config">
            <Save className="w-4 h-4 mr-2" />Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Plan Catalog</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <div key={plan._id} className="rounded border p-3 space-y-2" data-testid={`plan-${plan.code}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{plan.name}</span>
                  {plan.legacySubscriptionPlan && <Badge variant="outline">maps to: {plan.legacySubscriptionPlan}</Badge>}
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>Vehicles: {plan.limits.maxVehicles}</li>
                  <li>Drivers: {plan.limits.maxDrivers}</li>
                  <li>Managers: {plan.limits.maxManagers}</li>
                  <li>Customers: {plan.limits.maxCustomers}</li>
                  <li>Storage: {plan.limits.maxStorageGB} GB</li>
                  <li>API calls/day: {plan.limits.maxApiCallsPerDay}</li>
                </ul>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(plan.features).filter(([, v]) => v).map(([f]) => (
                    <Badge key={f} variant="secondary" className="text-xs">{f.replace(/_/g, " ")}</Badge>
                  ))}
                </div>
              </div>
            ))}
            {plans.length === 0 && <p className="text-muted-foreground text-sm">No plans yet — the catalog seeds itself on first load.</p>}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
