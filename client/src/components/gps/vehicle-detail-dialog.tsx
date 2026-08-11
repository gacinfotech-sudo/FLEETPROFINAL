import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VehicleStatusCard } from './vehicle-status-card';
import { RouteReplayPanel } from './route-replay-panel';
import type { GpsProviderCapabilities, VehicleLiveStateRow } from './types';

export function VehicleDetailDialog({
  row,
  capabilities,
  open,
  onOpenChange,
}: {
  row: VehicleLiveStateRow;
  capabilities: GpsProviderCapabilities;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{row.licensePlate || `${row.make} ${row.vehicleModel ?? ''}`.trim()}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="current">
          <TabsList>
            <TabsTrigger value="current" data-testid="gps-vehicle-detail-tab-current">Current status</TabsTrigger>
            <TabsTrigger value="replay" data-testid="gps-vehicle-detail-tab-replay">Route replay</TabsTrigger>
          </TabsList>
          <TabsContent value="current" className="pt-2">
            <VehicleStatusCard row={row} capabilities={capabilities} />
          </TabsContent>
          <TabsContent value="replay" className="pt-2">
            <RouteReplayPanel gpsDeviceId={row.gpsDeviceId} capabilities={capabilities} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
