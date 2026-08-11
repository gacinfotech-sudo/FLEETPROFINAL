import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAssignGpsDevice, useGpsConnections, useGpsDevices } from './api';
import type { FleetVehicle } from './types';

export function AssignDeviceDialog({ vehicle, open, onOpenChange }: { vehicle: FleetVehicle; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const { data: connections } = useGpsConnections();
  const [connectionId, setConnectionId] = useState<string>('');
  const { data: devices, isLoading: devicesLoading } = useGpsDevices({ connectionId: connectionId || undefined });
  const [deviceId, setDeviceId] = useState<string>('');
  const assignMutation = useAssignGpsDevice();

  // Only unassigned devices (plus, defensively, any device the query
  // returns without a terminal 'removed' status) are offered — assigning
  // a device already bound to another vehicle is rejected server-side
  // anyway (GpsAssignmentConflictError), but filtering here keeps the
  // picker itself honest about what's actually available.
  const assignableDevices = (devices ?? []).filter((d) => d.status !== 'removed');

  const handleAssign = () => {
    if (!deviceId) return;
    assignMutation.mutate(
      { vehicleId: vehicle._id, gpsDeviceId: deviceId },
      {
        onSuccess: () => {
          toast({ title: 'GPS device mapped', description: `${vehicle.licensePlate || vehicle.make} is now tracked.` });
          onOpenChange(false);
        },
        onError: (error: any) => {
          toast({ title: 'Could not map device', description: error?.message || 'Please try again.', variant: 'destructive' });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Map GPS device</DialogTitle>
          <DialogDescription>{vehicle.licensePlate || `${vehicle.make} ${vehicle.vehicleModel ?? ''}`}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Provider connection</Label>
            <Select value={connectionId} onValueChange={(v) => { setConnectionId(v); setDeviceId(''); }}>
              <SelectTrigger data-testid="gps-assign-connection-select"><SelectValue placeholder="Select a connection" /></SelectTrigger>
              <SelectContent>
                {(connections ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.connectionName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Device</Label>
            <Select value={deviceId} onValueChange={setDeviceId} disabled={!connectionId}>
              <SelectTrigger data-testid="gps-assign-device-select">
                <SelectValue placeholder={connectionId ? (devicesLoading ? 'Loading devices…' : 'Select a device') : 'Choose a connection first'} />
              </SelectTrigger>
              <SelectContent>
                {assignableDevices.length === 0 && !devicesLoading && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No devices synced yet — sync devices from Connections.</div>
                )}
                {assignableDevices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.deviceName || d.internalDeviceCode} ({d.status})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!deviceId || assignMutation.isPending} data-testid="gps-assign-confirm">
            {assignMutation.isPending ? 'Mapping…' : 'Map device'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
