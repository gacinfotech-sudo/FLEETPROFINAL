import { useState, useRef } from "react";
import { Grip, X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DraggableWidgetProps {
  id: string;
  title: string;
  size: "small" | "medium" | "large";
  isDragging: boolean;
  isDragEnabled: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onRemove?: () => void;
  onResize?: (size: "small" | "medium" | "large") => void;
  children: React.ReactNode;
  className?: string;
}

export default function DraggableWidget({
  id,
  title,
  size,
  isDragging,
  isDragEnabled,
  onDragStart,
  onDragEnd,
  onRemove,
  onResize,
  children,
  className,
}: DraggableWidgetProps) {
  const [showControls, setShowControls] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    small: "lg:col-span-4",
    medium: "lg:col-span-6",
    large: "lg:col-span-12",
  };

  const nextSize: Record<string, "small" | "medium" | "large"> = {
    small: "medium",
    medium: "large",
    large: "small",
  };

  return (
    <div
      ref={dragRef}
      draggable={isDragEnabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      className={cn(
        "col-span-12",
        sizeClasses[size],
        "transition-all duration-200 rounded-lg",
        isDragging && "opacity-50 scale-95",
        isDragEnabled && "cursor-move",
        className
      )}
    >
      <div className="relative h-full bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        {/* Drag Handle */}
        {isDragEnabled && (
          <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <Grip className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" />
          </div>
        )}

        {/* Title & Controls */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {isDragEnabled && <div className="w-5" />}
            <h3 className="font-semibold text-gray-900">{title}</h3>
          </div>

          {showControls && (isDragEnabled || onRemove || onResize) && (
            <div className="flex items-center gap-1">
              {onResize && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => onResize(nextSize[size])}
                  title={`Resize: ${size} → ${nextSize[size]}`}
                >
                  {size === "large" ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              )}
              {onRemove && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={onRemove}
                  title="Remove widget"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
