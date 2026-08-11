import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Link2, Unlink } from 'lucide-react';
import { useFleetVehicles, useVehicleGpsAssignment } from './api';
import { AssignDeviceDialog } from './assign-device-dialog';
import { UnassignDeviceDialog } from './unassign-device-dialog';
import type { FleetVehicle } from './types';

function VehicleMappingRow({ vehicle, onAssign, onUnassign }: {
  vehicle: FleetVehicle;
  onAssign: (vehicle: FleetVehicle) => void;
  onUnassign: (vehicle: FleetVehicle, assignmentId: string) => void;
}) {
  const { data, isLoading } = useVehicleGpsAssignment(vehicle._id);
  const assignment = data?.assignment ?? null;

  return (
    <TableRow data-testid={`gps-mapping-row-${vehicle._id}`}>
      <TableCell>
        <div className="font-medium">{vehicle.licensePlate || '—'}</div>
        <div className="text-xs text-muted-foreground">{vehicle.make} {vehicle.vehicleModel}</div>
      </TableCell>
      <TableCell>
        {isLoading ? (
          <span className="text-xs text-muted-foreground">Loading…</span>
        ) : assignment ? (
          <div>
            <div className="text-sm">{assignment.device?.deviceName || assignment.device?.internalDeviceCode}</div>
            <div className="text-xs text-muted-foreground">{assignment.connection?.connectionName}</div>
          </div>
        ) : (
          <Badge variant="outline">Not mapped</Badge>
        )}
      </TableCell>
      <TableCell className="text-right space-x-2 whitespace-nowrap">
        {assignment ? (
          <>
            <Button size="sm" variant="outline" onClick={() => onAssign(vehicle)} data-testid={`gps-mapping-change-${vehicle._id}`}>
              <Link2 className="h-3.5 w-3.5 mr-1" /> Change
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onUnassign(vehicle, assignment.id)} data-testid={`gps-mapping-unassign-${vehicle._id}`}>
              <Unlink className="h-3.5 w-3.5 mr-1" /> Unassign
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => onAssign(vehicle)} data-testid={`gps-mapping-assign-${vehicle._id}`}>
            <Link2 className="h-3.5 w-3.5 mr-1" /> Map device
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Vehicle <-> GPS device mapping table. Reads/writes go entirely through
 * the already-existing, already-shipped assignment routes
 * (server/gps/routes/assignments.ts) — no new backend surface needed here. */
export function VehicleMappingPanel() {
  const { data: vehicles, isLoading } = useFleetVehicles();
  const [search, setSearch] = useState('');
  const [assignTarget, setAssignTarget] = useState<FleetVehicle | null>(null);
  const [unassignTarget, setUnassignTarget] = useState<{ vehicle: FleetVehicle; assignmentId: string } | null>(null);

  const filtered = (vehicles ?? []).filter((v) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${v.licensePlate ?? ''} ${v.make} ${v.vehicleModel ?? ''}`.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search vehicles"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="gps-mapping-search"
        />
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead>GPS device</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Loading vehicles…</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No vehicles match this search.</TableCell></TableRow>
            )}
            {filtered.map((vehicle) => (
              <VehicleMappingRow
                key={vehicle._id}
                vehicle={vehicle}
                onAssign={setAssignTarget}
                onUnassign={(vehicle, assignmentId) => setUnassignTarget({ vehicle, assignmentId })}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {assignTarget && (
        <AssignDeviceDialog
          vehicle={assignTarget}
          open={Boolean(assignTarget)}
          onOpenChange={(open) => !open && setAssignTarget(null)}
        />
      )}
      {unassignTarget && (
        <UnassignDeviceDialog
          vehicle={unassignTarget.vehicle}
          open={Boolean(unassignTarget)}
          onOpenChange={(open) => !open && setUnassignTarget(null)}
        />
      )}
    </div>
  );
}
