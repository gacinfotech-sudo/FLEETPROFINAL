import React from "react";
import { Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RevenueDashboardHeaderProps {
  /** Currently selected date range (e.g., "today", "last7days", "custom") */
  dateRange: string;
  /** Callback when date range changes */
  onDateRangeChange: (range: string) => void;
  /** Callback when export is clicked */
  onExport: () => void;
  /** Optional theme switcher component from TASK-01 */
  themeSwitcher?: React.ReactNode;
}

const DATE_RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7days", label: "Last 7 Days" },
  { value: "last30days", label: "Last 30 Days" },
  { value: "thismonth", label: "This Month" },
  { value: "lastmonth", label: "Last Month" },
  { value: "thisquarter", label: "This Quarter" },
  { value: "thisyear", label: "This Year" },
  { value: "alltime", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

export default function RevenueDashboardHeader({
  dateRange,
  onDateRangeChange,
  onExport,
  themeSwitcher,
}: RevenueDashboardHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Header Card - Premium Styling */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface,#ffffff)] p-6 shadow-sm dark:shadow-none dark:border-slate-700">
        {/* Title and Subtitle Section */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--text-primary,#000000)] dark:text-white">
            Revenue Analytics
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary,#666666)] dark:text-slate-400">
            Track revenue, expenses, profitability and fleet performance.
          </p>
        </div>

        {/* Controls Section - Responsive Layout */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Date Filter Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Calendar className="h-5 w-5 text-[var(--text-secondary,#666666)] dark:text-slate-400 flex-shrink-0" />
            <Select value={dateRange} onValueChange={onDateRangeChange}>
              <SelectTrigger
                className="w-full sm:w-[200px] bg-[var(--background,#f9fafb)] dark:bg-slate-800 border-[var(--border,#e5e7eb)] dark:border-slate-700 text-[var(--text-primary,#000000)] dark:text-white hover:bg-[var(--background,#f0f1f3)] dark:hover:bg-slate-700 focus:ring-2 focus:ring-[var(--primary,#0066ff)] focus:ring-offset-0"
                aria-label="Select date range for revenue report"
              >
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--background,#ffffff)] dark:bg-slate-800 border-[var(--border,#e5e7eb)] dark:border-slate-700">
                {DATE_RANGE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-[var(--text-primary,#000000)] dark:text-white hover:bg-[var(--primary,#0066ff)] hover:text-white dark:hover:bg-blue-600 focus:bg-[var(--primary,#0066ff)] focus:text-white dark:focus:bg-blue-600 dark:focus:text-white cursor-pointer"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Right Side Controls - Responsive Flex */}
          <div className="flex items-center gap-3 justify-between sm:justify-end">
            {/* Export Button */}
            <Button
              onClick={onExport}
              variant="outline"
              className="flex-1 sm:flex-none bg-[var(--background,#f9fafb)] dark:bg-slate-800 border-[var(--border,#e5e7eb)] dark:border-slate-700 text-[var(--text-primary,#000000)] dark:text-white hover:bg-[var(--primary,#0066ff)] hover:text-white dark:hover:bg-blue-600 focus:ring-2 focus:ring-[var(--primary,#0066ff)] focus:ring-offset-0 focus:outline-none transition-colors"
              aria-label="Export revenue report"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>

            {/* Theme Switcher Slot - Optional */}
            {themeSwitcher && (
              <div className="flex-shrink-0">
                {themeSwitcher}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional styling note for premium appearance */}
      <style>{`
        /* Premium card hover effects */
        [class*="revenue-dashboard-header"] {
          transition: all 0.2s ease-in-out;
        }

        /* Ensure proper focus states for accessibility */
        button:focus-visible,
        [role="button"]:focus-visible {
          outline: 2px solid var(--primary, #0066ff);
          outline-offset: 2px;
        }

        /* Smooth select dropdown animations */
        [class*="SelectContent"] {
          animation: fadeIn 0.2s ease-in-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Dark mode optimizations */
        .dark [class*="SelectTrigger"] {
          background-color: hsl(240, 10%, 10%);
        }
      `}</style>
    </div>
  );
}
