// Category Subscriptions Component - Manage category-specific preferences
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CategoryOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

interface ChannelOption {
  id: string;
  label: string;
  icon: string;
}

interface CategoryPreference {
  enabled: boolean;
  channels: string[];
}

interface CategorySubscriptionsProps {
  categories: CategoryOption[];
  channels: ChannelOption[];
  preferences: Record<string, CategoryPreference>;
  unsubscribedFrom: string[];
  onCategoryChange: (categoryId: string, enabled: boolean) => void;
  onChannelChange: (categoryId: string, channelId: string) => void;
  onUnsubscribe: (categoryId: string) => void;
}

export const CategorySubscriptions: React.FC<CategorySubscriptionsProps> = ({
  categories,
  channels,
  preferences,
  unsubscribedFrom,
  onCategoryChange,
  onChannelChange,
  onUnsubscribe
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {categories.map(category => {
        const catPref = preferences[category.id] || { enabled: true, channels: [] };
        const isExpanded = expandedCategory === category.id;
        const isUnsubscribed = unsubscribedFrom.includes(category.id);

        return (
          <div
            key={category.id}
            className="border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
          >
            {/* Category Header */}
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="text-left">
                  <p className="font-semibold flex items-center gap-2">
                    <span className="text-lg">{category.icon}</span>
                    {category.label}
                  </p>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    isUnsubscribed
                      ? 'secondary'
                      : catPref.enabled
                        ? 'default'
                        : 'secondary'
                  }
                  className="ml-2"
                >
                  {isUnsubscribed ? 'Unsubscribed' : catPref.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {/* Category Details */}
            {isExpanded && (
              <div className="border-t p-4 bg-muted/30 space-y-4">
                {/* Category Toggle */}
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Enable this category</p>
                  <Switch
                    checked={catPref.enabled && !isUnsubscribed}
                    onCheckedChange={(checked) => onCategoryChange(category.id, checked)}
                    disabled={isUnsubscribed}
                  />
                </div>

                {/* Channel Selection */}
                {catPref.enabled && !isUnsubscribed && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Receive via:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {channels.map(channel => (
                        <label
                          key={channel.id}
                          className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={catPref.channels.includes(channel.id)}
                            onChange={() => onChannelChange(category.id, channel.id)}
                            className="w-4 h-4 rounded"
                            aria-label={`Enable ${channel.label} for ${category.label}`}
                          />
                          <span className="text-sm flex items-center gap-1">
                            <span>{channel.icon}</span>
                            {channel.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unsubscribe Button */}
                <div className="pt-2 border-t">
                  <Button
                    variant={isUnsubscribed ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onUnsubscribe(category.id)}
                    className="w-full sm:w-auto"
                  >
                    {isUnsubscribed ? '✓ Unsubscribed' : 'Unsubscribe'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    {isUnsubscribed
                      ? 'You won\'t receive any notifications for this category'
                      : 'Stop receiving notifications for this category'}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CategorySubscriptions;
