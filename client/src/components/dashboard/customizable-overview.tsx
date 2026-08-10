import { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardOverview from "./overview";
import DraggableWidget from "./draggable-widget";
import WidgetManager from "./widget-manager";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";

interface CustomizableOverviewProps {
  onNavigate: (view: string) => void;
  onViewBooking: (booking: any) => void;
  onSelectCustomer: (customerId: string) => void;
  onFleetStatusClick: (status: string) => void;
  onDriverStatusClick: (status: string) => void;
  canViewRevenue: boolean;
}

export default function CustomizableOverview({
  onNavigate,
  onViewBooking,
  onSelectCustomer,
  onFleetStatusClick,
  onDriverStatusClick,
  canViewRevenue,
}: CustomizableOverviewProps) {
  const { widgets, isLoading, toggleWidget, reorderWidgets, resizeWidget, resetLayout, getEnabledWidgets } =
    useDashboardLayout();
  const [isEditMode, setIsEditMode] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const enabledWidgets = getEnabledWidgets();

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverIndex.current = index;
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (!draggedId) return;

    const draggedIndex = enabledWidgets.findIndex((w) => w.id === draggedId);
    if (draggedIndex !== -1 && draggedIndex !== dropIndex) {
      reorderWidgets(draggedIndex, dropIndex);
    }
    setDraggedId(null);
    dragOverIndex.current = null;
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    dragOverIndex.current = null;
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading dashboard...</div>;
  }

  return (
    <div>
      {/* Header with Customize Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isEditMode ? "Customize your dashboard by dragging widgets" : "Live overview of your fleet operations"}
          </p>
        </div>
        <Button
          variant={isEditMode ? "default" : "outline"}
          className={isEditMode ? "bg-blue-600 hover:bg-blue-700" : ""}
          onClick={() => (isEditMode ? setIsEditMode(false) : setIsEditMode(true))}
        >
          <Settings className="w-4 h-4 mr-2" />
          {isEditMode ? "Done Editing" : "Customize"}
        </Button>
      </div>

      {/* Edit Mode Toolbar */}
      {isEditMode && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">Edit Mode Active</p>
            <p className="text-xs text-blue-700">Drag widgets to reorder • Click X to hide • Click ◡/▢ to resize</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowManager(true)}>
            Manage Widgets
          </Button>
        </div>
      )}

      {/* Dashboard Grid */}
      <div className="grid grid-cols-12 gap-4">
        {enabledWidgets.map((widget, index) => (
          <div
            key={widget.id}
            onDragOver={(e) => isEditMode && handleDragOver(e, index)}
            onDrop={(e) => isEditMode && handleDrop(e, index)}
            className={isEditMode ? "group" : ""}
          >
            <DraggableWidget
              id={widget.id}
              title={widget.title}
              size={widget.size}
              isDragging={draggedId === widget.id}
              isDragEnabled={isEditMode}
              onDragStart={() => handleDragStart(widget.id)}
              onDragEnd={handleDragEnd}
              onRemove={isEditMode ? () => toggleWidget(widget.id) : undefined}
              onResize={isEditMode ? (size) => resizeWidget(widget.id, size) : undefined}
            >
              {widget.id === "kpi-cards" && (
                <DashboardOverview
                  onNavigate={onNavigate}
                  onViewBooking={onViewBooking}
                  onSelectCustomer={onSelectCustomer}
                  onFleetStatusClick={onFleetStatusClick}
                  onDriverStatusClick={onDriverStatusClick}
                  canViewRevenue={canViewRevenue}
                />
              )}

              {/* Other widgets would render their content here */}
              {widget.id !== "kpi-cards" && (
                <div className="h-40 flex items-center justify-center text-muted-foreground">
                  Widget content: {widget.title}
                </div>
              )}
            </DraggableWidget>
          </div>
        ))}
      </div>

      {/* Widget Manager Modal */}
      <WidgetManager
        widgets={widgets}
        onToggle={toggleWidget}
        onReset={resetLayout}
        isOpen={showManager}
        onClose={() => setShowManager(false)}
      />
    </div>
  );
}
