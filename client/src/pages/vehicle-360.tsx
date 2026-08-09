import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import { VehicleSummaryHeader } from "@/components/fleet/vehicle-360/summary-header";
import { OverviewTab } from "@/components/fleet/vehicle-360/tabs/overview-tab";
import { ComplianceTab } from "@/components/fleet/vehicle-360/tabs/compliance-tab";
import { MaintenanceTab } from "@/components/fleet/vehicle-360/tabs/maintenance-tab";
import { DailyInspectionsTab } from "@/components/fleet/vehicle-360/tabs/daily-inspections-tab";
import { TyresTab } from "@/components/fleet/vehicle-360/tabs/tyres-tab";
import { BatteryTab } from "@/components/fleet/vehicle-360/tabs/battery-tab";
import { FuelTab } from "@/components/fleet/vehicle-360/tabs/fuel-tab";
import { ExpensesTab } from "@/components/fleet/vehicle-360/tabs/expenses-tab";
import { FastagTab } from "@/components/fleet/vehicle-360/tabs/fastag-tab";
import { GpsTelematicsTab } from "@/components/fleet/vehicle-360/tabs/gps-telematics-tab";
import { DriverAssignmentsTab } from "@/components/fleet/vehicle-360/tabs/driver-assignments-tab";
import { BookingsTripsTab } from "@/components/fleet/vehicle-360/tabs/bookings-trips-tab";
import { HandoverReturnTab } from "@/components/fleet/vehicle-360/tabs/handover-return-tab";
import { BreakdownsTab } from "@/components/fleet/vehicle-360/tabs/breakdowns-tab";
import { AccidentsTab } from "@/components/fleet/vehicle-360/tabs/accidents-tab";
import { ChallansTab } from "@/components/fleet/vehicle-360/tabs/challans-tab";
import { InventoryTab } from "@/components/fleet/vehicle-360/tabs/inventory-tab";
import { ProfitabilityTab } from "@/components/fleet/vehicle-360/tabs/profitability-tab";
import { TimelineTab } from "@/components/fleet/vehicle-360/tabs/timeline-tab";

/**
 * Vehicle 360 — per-vehicle detail view (TASK-VEHICLE-360-UI-06). Not yet
 * routed (client/src/App.tsx is Integrator-only) — see this task's report
 * for the exact proposed `<Route path="/vehicles/:vehicleId">` addition.
 *
 * No dedicated `GET /api/vehicles/:id` endpoint exists yet (confirmed by
 * reading server/routes.ts — only list/update/delete) — this page reuses
 * the existing `GET /api/vehicles` list query and finds the matching
 * record client-side, the same pattern `vehicle-form.tsx` already uses for
 * its own vehicle-count check, rather than propose a new core vehicle
 * endpoint outside this task's "no new APIs" scope.
 */
export default function Vehicle360Page() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const { data: vehicles, isLoading } = useQuery<any[]>({ queryKey: ["/api/vehicles"] });
  const vehicle = (vehicles ?? []).find((v) => v._id === vehicleId);

  if (isLoading) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading vehicle…</div>;
  }
  if (!vehicle) {
    return <div className="py-24 text-center text-muted-foreground">Vehicle not found.</div>;
  }

  return (
    <>
      <div className="h-screen flex bg-gray-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-auto">
          <div className="space-y-6 p-4 sm:p-6 max-w-full overflow-x-hidden">
          <div>
            <h1 className="text-xl font-semibold truncate">{vehicle.make} {vehicle.vehicleModel} — {vehicle.licensePlate ?? 'No plate'}</h1>
            <p className="text-sm text-muted-foreground">Vehicle 360</p>
          </div>

          <VehicleSummaryHeader vehicle={vehicle} />

          <Tabs defaultValue="overview" className="w-full">
            <div className="overflow-x-auto">
              <TabsList className="inline-flex w-max min-w-full sm:w-auto flex-nowrap">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="compliance">Documents & Compliance</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="inspections">Daily Inspections</TabsTrigger>
                <TabsTrigger value="tyres">Tyres</TabsTrigger>
                <TabsTrigger value="battery">Battery</TabsTrigger>
                <TabsTrigger value="fuel">Fuel/CNG/EV</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="fastag">FASTag/Toll</TabsTrigger>
                <TabsTrigger value="gps">GPS & Telematics</TabsTrigger>
                <TabsTrigger value="drivers">Driver Assignments</TabsTrigger>
                <TabsTrigger value="bookings">Bookings & Trips</TabsTrigger>
                <TabsTrigger value="handover">Handover & Return</TabsTrigger>
                <TabsTrigger value="breakdowns">Breakdowns</TabsTrigger>
                <TabsTrigger value="accidents">Accidents</TabsTrigger>
                <TabsTrigger value="challans">Challans</TabsTrigger>
                <TabsTrigger value="inventory">Accessories & Inventory</TabsTrigger>
                <TabsTrigger value="profitability">Revenue & Profitability</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview"><OverviewTab vehicle={vehicle} /></TabsContent>
            <TabsContent value="compliance"><ComplianceTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="maintenance"><MaintenanceTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="inspections"><DailyInspectionsTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="tyres"><TyresTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="battery"><BatteryTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="fuel"><FuelTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="expenses"><ExpensesTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="fastag"><FastagTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="gps"><GpsTelematicsTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="drivers"><DriverAssignmentsTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="bookings"><BookingsTripsTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="handover"><HandoverReturnTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="breakdowns"><BreakdownsTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="accidents"><AccidentsTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="challans"><ChallansTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="inventory"><InventoryTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="profitability"><ProfitabilityTab vehicleId={vehicle._id} /></TabsContent>
            <TabsContent value="timeline"><TimelineTab vehicleId={vehicle._id} /></TabsContent>
          </Tabs>
          </div>
        </div>
      </div>
    </>
  );
}
