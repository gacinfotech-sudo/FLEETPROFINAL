// Quiet Hours Component - Configure quiet hours settings
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Info } from 'lucide-react';

interface Timezone {
  value: string;
  label: string;
}

interface QuietHoursProps {
  enabled: boolean;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  timezones: Timezone[];
  onEnabledChange: (enabled: boolean) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onTimezoneChange: (timezone: string) => void;
}

export const QuietHours: React.FC<QuietHoursProps> = ({
  enabled,
  startTime = '22:00',
  endTime = '08:00',
  timezone = 'UTC',
  timezones,
  onEnabledChange,
  onStartTimeChange,
  onEndTimeChange,
  onTimezoneChange
}) => {
  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
        <div>
          <p className="font-semibold">Enable Quiet Hours</p>
          <p className="text-sm text-muted-foreground">No notifications between start and end times</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>

      {/* Time Settings */}
      {enabled && (
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Start Time */}
            <div>
              <label className="text-sm font-semibold block mb-2">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background"
                aria-label="Quiet hours start time"
              />
              <p className="text-xs text-muted-foreground mt-1">When to start quiet hours</p>
            </div>

            {/* End Time */}
            <div>
              <label className="text-sm font-semibold block mb-2">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background"
                aria-label="Quiet hours end time"
              />
              <p className="text-xs text-muted-foreground mt-1">When to end quiet hours</p>
            </div>

            {/* Timezone */}
            <div>
              <label className="text-sm font-semibold block mb-2">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => onTimezoneChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background"
                aria-label="Timezone for quiet hours"
              >
                {timezones.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Your timezone</p>
            </div>
          </div>

          {/* Info */}
          <div className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>Urgent alerts may still be delivered during quiet hours. Change times based on your timezone.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuietHours;
