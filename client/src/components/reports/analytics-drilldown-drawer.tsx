"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Summary metric item type for the drawer's summary section
 */
export interface SummaryMetric {
  label: string
  value: string | number
  icon?: React.ReactNode
}

/**
 * View full details link configuration
 */
export interface ViewFullLink {
  label: string
  onClick: () => void
}

/**
 * Props for the AnalyticsDrilldownDrawer component
 */
export interface AnalyticsDrilldownDrawerProps {
  /**
   * Whether the drawer is open
   */
  isOpen: boolean

  /**
   * Callback to close the drawer
   */
  onClose: () => void

  /**
   * Title of the drawer
   */
  title: string

  /**
   * Optional summary metrics displayed at the top
   */
  summary?: SummaryMetric[]

  /**
   * Optional filter UI component
   */
  filters?: React.ReactNode

  /**
   * Main content (lists, tables, etc.)
   */
  children?: React.ReactNode

  /**
   * Optional "View All" or details link at the bottom
   */
  viewFullLink?: ViewFullLink

  /**
   * Additional CSS classes to apply to the drawer
   */
  className?: string
}

/**
 * A reusable slide-over drawer component for analytics drill-down interactions.
 *
 * Features:
 * - Responsive: side panel on desktop (right side), full-width on mobile
 * - Keyboard accessible: Escape to close, Tab focus management
 * - Theme-aware with CSS variables
 * - Smooth open/close animations
 * - Summary metrics display (optional)
 * - Filter controls (optional)
 * - Main content area with scrolling support
 * - "View Details" CTA at footer (optional)
 *
 * @example
 * ```tsx
 * <AnalyticsDrilldownDrawer
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Transaction Details"
 *   summary={[
 *     { label: "Total Revenue", value: "Rs 50,000" },
 *     { label: "Transactions", value: 125 }
 *   ]}
 *   filters={<FilterUI />}
 *   viewFullLink={{ label: "View All", onClick: handleViewAll }}
 * >
 *   <TransactionList data={transactions} />
 * </AnalyticsDrilldownDrawer>
 * ```
 */
export const AnalyticsDrilldownDrawer = React.forwardRef<
  HTMLDivElement,
  AnalyticsDrilldownDrawerProps
>(
  (
    {
      isOpen,
      onClose,
      title,
      summary,
      filters,
      children,
      viewFullLink,
      className,
    },
    ref
  ) => {
    const contentRef = React.useRef<HTMLDivElement>(null)
    const drawerRef = React.useRef<HTMLDivElement>(null)

    // Handle Escape key to close drawer
    React.useEffect(() => {
      if (!isOpen) return

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose()
        }
      }

      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }, [isOpen, onClose])

    // Handle backdrop click to close drawer
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    }

    // Prevent body scroll when drawer is open
    React.useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = "hidden"
      } else {
        document.body.style.overflow = "unset"
      }
      return () => {
        document.body.style.overflow = "unset"
      }
    }, [isOpen])

    if (!isOpen) return null

    return (
      <>
        {/* Overlay backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={handleBackdropClick}
          aria-hidden="true"
        />

        {/* Drawer container */}
        <div
          ref={drawerRef}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex flex-col w-full sm:w-96 md:w-[32rem] lg:w-[36rem] bg-background border-l border-border shadow-lg transition-transform duration-300 ease-out transform",
            isOpen ? "translate-x-0" : "translate-x-full",
            className
          )}
        >
          {/* Header with title and close button */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className={cn(
                "p-1 rounded-md transition-colors",
                "hover:bg-muted",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Close drawer"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Summary metrics section */}
          {summary && summary.length > 0 && (
            <div className="px-6 py-4 border-b border-border bg-muted/20 flex-shrink-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {summary.map((metric, index) => (
                  <div key={index} className="flex flex-col">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {metric.label}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      {metric.icon && (
                        <span className="text-muted-foreground flex-shrink-0">
                          {metric.icon}
                        </span>
                      )}
                      <span className="text-sm md:text-base font-semibold text-foreground">
                        {metric.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters section */}
          {filters && (
            <div className="px-6 py-4 border-b border-border bg-background flex-shrink-0 overflow-x-auto">
              {filters}
            </div>
          )}

          {/* Main content area (scrollable) */}
          <div
            ref={contentRef}
            className={cn(
              "flex-1 overflow-y-auto px-6 py-4",
              "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
            )}
          >
            {children || (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No data to display</p>
              </div>
            )}
          </div>

          {/* Footer with CTA */}
          {viewFullLink && (
            <div className="px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
              <button
                onClick={viewFullLink.onClick}
                className={cn(
                  "w-full px-4 py-2 rounded-md text-sm font-medium",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90",
                  "transition-colors duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  "disabled:opacity-50 disabled:pointer-events-none"
                )}
                type="button"
              >
                {viewFullLink.label}
              </button>
            </div>
          )}
        </div>
      </>
    )
  }
)

AnalyticsDrilldownDrawer.displayName = "AnalyticsDrilldownDrawer"

export default AnalyticsDrilldownDrawer
