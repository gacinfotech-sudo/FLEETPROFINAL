import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUnassignGpsDevice } from './api';
import type { FleetVehicle } from './types';

const MIN_REASON_LENGTH = 3;

export function UnassignDeviceDialog({ vehicle, open, onOpenChange }: { vehicle: FleetVehicle; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const unassignMutation = useUnassignGpsDevice();

  const handleUnassign = () => {
    if (reason.trim().length < MIN_REASON_LENGTH) return;
    unassignMutation.mutate(
      { vehicleId: vehicle._id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast({ title: 'GPS device unmapped', description: `${vehicle.licensePlate || vehicle.make} is no longer tracked.` });
          onOpenChange(false);
        },
        onError: (error: any) => {
          toast({ title: 'Could not unmap device', description: error?.message || 'Please try again.', variant: 'destructive' });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unmap GPS device</DialogTitle>
          <DialogDescription>
            {vehicle.licensePlate || `${vehicle.make} ${vehicle.vehicleModel ?? ''}`} will stop appearing on the Live Map until a new device is mapped.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="gps-unassign-reason">Reason (required)</Label>
          <Textarea
            id="gps-unassign-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. device removed from vehicle for service"
            data-testid="gps-unassign-reason"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleUnassign}
            disabled={reason.trim().length < MIN_REASON_LENGTH || unassignMutation.isPending}
            data-testid="gps-unassign-confirm"
          >
            {unassignMutation.isPending ? 'Unmapping…' : 'Unmap device'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
