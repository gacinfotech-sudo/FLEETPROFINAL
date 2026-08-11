import { useState, useEffect } from "react";
import { Search, X, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Command {
  id: string;
  title: string;
  description: string;
  category: string;
  action: () => void;
  icon?: string;
  shortcut?: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  commands?: Command[];
  isOpen?: boolean;
  onClose?: () => void;
}

const DEFAULT_COMMANDS: Command[] = [
  {
    id: "create-booking",
    title: "Create Booking",
    description: "Start a new booking for a customer",
    category: "Bookings",
    icon: "📝",
    shortcut: "B",
    keywords: ["booking", "new", "create"],
    action: () => {
      window.location.href = "/bookings/create";
    },
  },
  {
    id: "collect-payment",
    title: "Collect Payment",
    description: "Send payment reminder or collect payment",
    category: "Payments",
    icon: "💰",
    shortcut: "P",
    keywords: ["payment", "collect", "money"],
    action: () => {
      window.location.href = "/bookings/payments";
    },
  },
  {
    id: "assign-vehicle",
    title: "Assign Vehicle",
    description: "Assign a vehicle to pending booking",
    category: "Fleet",
    icon: "🚗",
    shortcut: "V",
    keywords: ["vehicle", "assign", "car"],
    action: () => {
      window.location.href = "/bookings/pending";
    },
  },
  {
    id: "onboard-driver",
    title: "Onboard Driver",
    description: "Add a new driver to your fleet",
    category: "Drivers",
    icon: "👤",
    shortcut: "D",
    keywords: ["driver", "onboard", "add"],
    action: () => {
      window.location.href = "/drivers/onboard";
    },
  },
  {
    id: "view-analytics",
    title: "View Analytics",
    description: "Check your business performance metrics",
    category: "Analytics",
    icon: "📊",
    shortcut: "A",
    keywords: ["analytics", "metrics", "performance"],
    action: () => {
      window.location.href = "/analytics";
    },
  },
  {
    id: "schedule-maintenance",
    title: "Schedule Maintenance",
    description: "Schedule vehicle maintenance",
    category: "Fleet",
    icon: "🔧",
    keywords: ["maintenance", "service", "repair"],
    action: () => {
      window.location.href = "/maintenance/schedule";
    },
  },
  {
    id: "send-message",
    title: "Send Message",
    description: "Send updates to customers or drivers",
    category: "Messages",
    icon: "💬",
    keywords: ["message", "send", "notify"],
    action: () => {
      window.location.href = "/messages";
    },
  },
  {
    id: "upload-documents",
    title: "Upload Documents",
    description: "Upload driver or vehicle documents",
    category: "Documents",
    icon: "📎",
    keywords: ["document", "upload", "file"],
    action: () => {
      window.location.href = "/documents/upload";
    },
  },
  {
    id: "refresh-dashboard",
    title: "Refresh Dashboard",
    description: "Refresh all dashboard data",
    category: "Dashboard",
    icon: "🔄",
    shortcut: "R",
    keywords: ["refresh", "reload", "update"],
    action: () => {
      window.location.reload();
    },
  },
];

export default function CommandPalette({
  commands = DEFAULT_COMMANDS,
  isOpen = false,
  onClose,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(isOpen);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on query
  const filteredCommands = commands.filter((cmd) => {
    const searchText = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(searchText) ||
      cmd.description.toLowerCase().includes(searchText) ||
      cmd.category.toLowerCase().includes(searchText) ||
      cmd.keywords?.some((k) => k.toLowerCase().includes(searchText))
    );
  });

  // Group commands by category
  const groupedCommands = filteredCommands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = [];
      }
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<string, Command[]>
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? filteredCommands.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        handleClose();
      }
    }
  };

  const handleClose = () => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
    onClose?.();
  };

  // Global keyboard shortcut to open (/)
  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      if (e.key === "/" && e.target === document.body) {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyPress);
    return () => window.removeEventListener("keydown", handleGlobalKeyPress);
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search commands... (/ for help)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none text-lg text-gray-900 placeholder-gray-500"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center">
              <Zap className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No commands found</p>
              <p className="text-xs text-gray-400 mt-1">
                Try searching for "booking" or "payment"
              </p>
            </div>
          ) : (
            <div className="p-2">
              {Object.entries(groupedCommands).map(([category, cmds]) => (
                <div key={category}>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {category}
                  </div>
                  {cmds.map((cmd, idx) => {
                    const isSelected =
                      filteredCommands.indexOf(cmd) === selectedIndex;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          cmd.action();
                          handleClose();
                        }}
                        onMouseEnter={() => {
                          setSelectedIndex(filteredCommands.indexOf(cmd));
                        }}
                        className={`w-full px-3 py-2 rounded-md flex items-center justify-between gap-3 text-left transition-colors ${
                          isSelected
                            ? "bg-blue-100 text-blue-900"
                            : "text-gray-900 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {cmd.icon && (
                            <span className="text-lg flex-shrink-0">
                              {cmd.icon}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{cmd.title}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {cmd.description}
                            </p>
                          </div>
                        </div>

                        {cmd.shortcut && (
                          <Badge
                            variant="outline"
                            className="flex-shrink-0 font-mono text-xs"
                          >
                            {cmd.shortcut}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 flex justify-between">
          <div className="flex gap-4">
            <div>
              <span className="font-semibold">↑↓</span> Navigate
            </div>
            <div>
              <span className="font-semibold">⏎</span> Execute
            </div>
            <div>
              <span className="font-semibold">Esc</span> Close
            </div>
          </div>
          <div>
            {filteredCommands.length} command{filteredCommands.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
