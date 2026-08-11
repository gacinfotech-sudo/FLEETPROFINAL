// Frequency Caps Component - Control notification frequency limits
import React from 'react';
import { Info } from 'lucide-react';

interface FrequencyCapsProps {
  dailyCap?: number;
  hourlyCap?: number;
  onDailyCapChange: (cap: number) => void;
  onHourlyCapChange: (cap: number) => void;
  disabled?: boolean;
}

export const FrequencyCaps: React.FC<FrequencyCapsProps> = ({
  dailyCap = -1,
  hourlyCap = -1,
  onDailyCapChange,
  onHourlyCapChange,
  disabled = false
}) => {
  const formatCapValue = (cap: number): string => {
    return cap === -1 ? 'unlimited' : `${cap} notifications`;
  };

  return (
    <div className="space-y-4">
      {/* Daily Cap */}
      <div>
        <label className="text-sm font-semibold block mb-2">
          Daily Notification Limit
        </label>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <input
              type="number"
              min="-1"
              value={dailyCap}
              onChange={(e) => onDailyCapChange(parseInt(e.target.value))}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-lg"
              aria-label="Daily notification limit"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {dailyCap === -1
                ? 'No daily limit - you\'ll receive all notifications'
                : `Maximum ${dailyCap} notifications per day`}
            </p>
          </div>
          <button
            onClick={() => onDailyCapChange(-1)}
            className="px-3 py-2 text-xs bg-muted rounded-lg hover:bg-muted/80 transition-colors"
            disabled={disabled}
          >
            Unlimited
          </button>
        </div>
      </div>

      {/* Hourly Cap */}
      <div>
        <label className="text-sm font-semibold block mb-2">
          Hourly Notification Limit
        </label>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <input
              type="number"
              min="-1"
              value={hourlyCap}
              onChange={(e) => onHourlyCapChange(parseInt(e.target.value))}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-lg"
              aria-label="Hourly notification limit"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {hourlyCap === -1
                ? 'No hourly limit - you\'ll receive all notifications'
                : `Maximum ${hourlyCap} notifications per hour`}
            </p>
          </div>
          <button
            onClick={() => onHourlyCapChange(-1)}
            className="px-3 py-2 text-xs bg-muted rounded-lg hover:bg-muted/80 transition-colors"
            disabled={disabled}
          >
            Unlimited
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-lg text-sm">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-xs mb-1">Tips for frequency limits:</p>
          <ul className="text-xs space-y-0.5">
            <li>• Use -1 for unlimited notifications</li>
            <li>• Set limits to prevent notification fatigue</li>
            <li>• Excess notifications are queued and delivered later</li>
            <li>• Urgent alerts may bypass these limits</li>
          </ul>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="pt-2 border-t">
        <p className="text-sm font-semibold mb-2">Quick Presets:</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              onDailyCapChange(50);
              onHourlyCapChange(10);
            }}
            className="px-3 py-2 text-xs border rounded-lg hover:bg-muted transition-colors"
            disabled={disabled}
          >
            Moderate
          </button>
          <button
            onClick={() => {
              onDailyCapChange(20);
              onHourlyCapChange(5);
            }}
            className="px-3 py-2 text-xs border rounded-lg hover:bg-muted transition-colors"
            disabled={disabled}
          >
            Limited
          </button>
          <button
            onClick={() => {
              onDailyCapChange(-1);
              onHourlyCapChange(-1);
            }}
            className="px-3 py-2 text-xs border rounded-lg hover:bg-muted transition-colors"
            disabled={disabled}
          >
            Unlimited
          </button>
        </div>
      </div>
    </div>
  );
};

export default FrequencyCaps;
