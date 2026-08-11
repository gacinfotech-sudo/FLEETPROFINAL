// Channel Toggle Component - Select notification channels
import React from 'react';

interface ChannelOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

interface ChannelToggleProps {
  channels: ChannelOption[];
  selectedChannels: string[];
  onChannelChange: (channel: string) => void;
  disabled?: boolean;
  columns?: number;
}

export const ChannelToggle: React.FC<ChannelToggleProps> = ({
  channels,
  selectedChannels,
  onChannelChange,
  disabled = false,
  columns = 2
}) => {
  return (
    <div className={`grid grid-cols-1 gap-3 ${columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-4'}`}>
      {channels.map(channel => (
        <label
          key={channel.id}
          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-muted/50'
          }`}
        >
          <input
            type="checkbox"
            checked={selectedChannels.includes(channel.id)}
            onChange={() => onChannelChange(channel.id)}
            disabled={disabled}
            className="w-4 h-4 rounded cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">{channel.icon}</span>
              {channel.label}
            </p>
            {channel.description && (
              <p className="text-xs text-muted-foreground">{channel.description}</p>
            )}
          </div>
        </label>
      ))}
    </div>
  );
};

export default ChannelToggle;
