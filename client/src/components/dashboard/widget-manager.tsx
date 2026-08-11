import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardWidget } from "@/hooks/use-dashboard-layout";

interface WidgetManagerProps {
  widgets: DashboardWidget[];
  onToggle: (id: string) => void;
  onReset: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function WidgetManager({
  widgets,
  onToggle,
  onReset,
  isOpen,
  onClose,
}: WidgetManagerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dashboard Widgets</CardTitle>
            <Button size="sm" variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {widgets.map((widget) => (
            <div
              key={widget.id}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{widget.title}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {widget.type} • {widget.size}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 ml-2"
                onClick={() => onToggle(widget.id)}
                title={widget.enabled ? "Hide widget" : "Show widget"}
              >
                {widget.enabled ? (
                  <Eye className="w-4 h-4 text-blue-600" />
                ) : (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                )}
              </Button>
            </div>
          ))}

          <div className="border-t pt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                onReset();
                onClose();
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Layout
            </Button>
            <Button size="sm" variant="default" className="flex-1" onClick={onClose}>
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
