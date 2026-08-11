import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  AlertCircle,
  Eye,
  EyeOff,
  Settings,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface PricingRule {
  id: string;
  name: string;
  type: "demand" | "time" | "segment" | "vehicle" | "route" | "frequency" | "seasonal" | "competitive";
  priceMultiplier: number;
  enabled: boolean;
  priority: number;
}

interface PricingDashboardProps {
  rules?: PricingRule[];
  onRuleToggle?: (ruleId: string, enabled: boolean) => void;
  onPriorityChange?: (ruleId: string, priority: number) => void;
}

const RULE_TYPE_COLORS: Record<string, string> = {
  demand: "bg-red-50 border-red-200",
  time: "bg-blue-50 border-blue-200",
  segment: "bg-purple-50 border-purple-200",
  vehicle: "bg-green-50 border-green-200",
  route: "bg-orange-50 border-orange-200",
  frequency: "bg-amber-50 border-amber-200",
  seasonal: "bg-pink-50 border-pink-200",
  competitive: "bg-indigo-50 border-indigo-200",
};

const RULE_TYPE_ICONS: Record<string, React.ReactNode> = {
  demand: <Zap className="h-5 w-5 text-red-600" />,
  time: <AlertCircle className="h-5 w-5 text-blue-600" />,
  segment: <DollarSign className="h-5 w-5 text-purple-600" />,
  vehicle: <TrendingUp className="h-5 w-5 text-green-600" />,
  route: <TrendingUp className="h-5 w-5 text-orange-600" />,
  frequency: <CheckCircle2 className="h-5 w-5 text-amber-600" />,
  seasonal: <AlertCircle className="h-5 w-5 text-pink-600" />,
  competitive: <TrendingDown className="h-5 w-5 text-indigo-600" />,
};

export default function PricingDashboard({
  rules = [],
  onRuleToggle,
  onPriorityChange,
}: PricingDashboardProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const filteredRules = selectedType ? rules.filter((r) => r.type === selectedType) : rules;
  const enabledRules = rules.filter((r) => r.enabled).length;

  const stats = {
    total: rules.length,
    enabled: enabledRules,
    avgMultiplier: (rules.reduce((sum, r) => sum + r.priceMultiplier, 0) / Math.max(rules.length, 1)).toFixed(2),
    revenue: Math.round(rules.reduce((sum, r) => sum + (r.priceMultiplier - 1) * 10000, 0)),
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">💰 Total Rules</p>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">pricing strategies</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">✅ Active</p>
              <p className="text-3xl font-bold text-green-600">{stats.enabled}</p>
              <p className="text-xs text-gray-500 mt-1">rules enabled</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">📊 Avg Multiplier</p>
              <p className="text-3xl font-bold text-purple-600">{stats.avgMultiplier}x</p>
              <p className="text-xs text-gray-500 mt-1">price adjustment</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">💵 Est. Revenue</p>
              <p className="text-3xl font-bold text-orange-600">₹{(stats.revenue / 1000).toFixed(0)}K</p>
              <p className="text-xs text-gray-500 mt-1">additional revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={!selectedType ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType(null)}
        >
          All ({rules.length})
        </Button>
        <Button
          variant={selectedType === "demand" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("demand")}
        >
          ⚡ Demand
        </Button>
        <Button
          variant={selectedType === "time" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("time")}
        >
          🕐 Time
        </Button>
        <Button
          variant={selectedType === "segment" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("segment")}
        >
          👥 Segment
        </Button>
        <Button
          variant={selectedType === "vehicle" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("vehicle")}
        >
          🚗 Vehicle
        </Button>
        <Button
          variant={selectedType === "frequency" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("frequency")}
        >
          📍 Frequency
        </Button>
        <Button
          variant={selectedType === "seasonal" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("seasonal")}
        >
          🎄 Seasonal
        </Button>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {filteredRules.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No pricing rules in this category</p>
            </CardContent>
          </Card>
        ) : (
          filteredRules.map((rule) => {
            const isExpanded = expandedRule === rule.id;
            const percentageChange = ((rule.priceMultiplier - 1) * 100).toFixed(0);
            const isMarkup = rule.priceMultiplier > 1;

            return (
              <Card
                key={rule.id}
                className={`border-2 transition-all ${RULE_TYPE_COLORS[rule.type]} ${
                  !rule.enabled ? "opacity-60" : ""
                }`}
              >
                <CardContent className="pt-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">{RULE_TYPE_ICONS[rule.type]}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                          <Badge variant="outline" className="text-xs capitalize">
                            {rule.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          ID: <code className="text-xs bg-gray-100 px-2 py-1 rounded">{rule.id}</code>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className={`text-right ${
                          isMarkup ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        <div className="text-lg font-bold flex items-center gap-1">
                          {isMarkup ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : (
                            <TrendingDown className="h-5 w-5" />
                          )}
                          {isMarkup ? "+" : ""}{percentageChange}%
                        </div>
                        <p className="text-xs text-gray-500">
                          {rule.priceMultiplier.toFixed(2)}x multiplier
                        </p>
                      </div>

                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) =>
                          onRuleToggle?.(rule.id, checked)
                        }
                      />
                    </div>
                  </div>

                  {/* Priority Slider */}
                  <div className="mb-4 p-3 bg-white rounded border">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Priority Level
                      </label>
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                        {rule.priority}
                      </Badge>
                    </div>
                    <Slider
                      value={[rule.priority]}
                      onValueChange={(value) =>
                        onPriorityChange?.(rule.id, value[0])
                      }
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Higher priority rules override lower ones
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 text-sm">
                    {rule.enabled ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-green-700">Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-500">Disabled</span>
                      </>
                    )}
                  </div>

                  {/* Expand Details */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpandedRule(isExpanded ? null : rule.id)
                    }
                    className="w-full mt-3"
                  >
                    {isExpanded ? "Hide Details" : "Show Details"}
                  </Button>

                  {/* Details Section */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-600">Rule Type</p>
                          <p className="text-sm font-medium capitalize">{rule.type}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Multiplier</p>
                          <p className="text-sm font-medium">{rule.priceMultiplier}x</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Status</p>
                          <p className="text-sm font-medium">{rule.enabled ? "✅ Enabled" : "❌ Disabled"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Priority</p>
                          <p className="text-sm font-medium">{rule.priority}</p>
                        </div>
                      </div>
                      <div className="p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-blue-700">
                          💡 This rule {isMarkup ? "increases" : "decreases"} prices by{" "}
                          {Math.abs(Math.round(parseFloat(percentageChange)))}%
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Summary */}
      {rules.length > 0 && (
        <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Smart Pricing System Active</p>
                <p className="text-sm text-indigo-100 mt-1">
                  {stats.enabled} of {stats.total} pricing rules are live. Expected revenue impact: ₹
                  {(stats.revenue / 1000).toFixed(0)}K monthly
                </p>
              </div>
              <Settings className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
