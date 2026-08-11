import { useState } from "react";
import { X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ShortcutGroup {
  category: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: "🚀 Quick Actions",
    shortcuts: [
      { keys: ["B"], description: "Create Booking" },
      { keys: ["P"], description: "Collect Payment" },
      { keys: ["D"], description: "Onboard Driver" },
      { keys: ["V"], description: "Assign Vehicle" },
      { keys: ["A"], description: "View Analytics" },
    ],
  },
  {
    category: "🎯 Navigation",
    shortcuts: [
      { keys: ["/"], description: "Search/Command Palette" },
      { keys: ["Ctrl", "S"], description: "Toggle Sidebar" },
      { keys: ["H"], description: "Open Help" },
      { keys: ["Escape"], description: "Close Modal/Panel" },
    ],
  },
  {
    category: "📱 Dashboard",
    shortcuts: [
      { keys: ["R"], description: "Refresh Dashboard" },
      { keys: ["T"], description: "Toggle Theme" },
      { keys: ["N"], description: "View Notifications" },
    ],
  },
  {
    category: "📋 Forms",
    shortcuts: [
      { keys: ["Enter"], description: "Submit Form" },
      { keys: ["Ctrl", "S"], description: "Auto-save Form" },
      { keys: ["Escape"], description: "Clear Form" },
    ],
  },
];

interface KeyboardShortcutsHelpProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function KeyboardShortcutsHelp({
  isOpen = false,
  onClose,
}: KeyboardShortcutsHelpProps) {
  const [open, setOpen] = useState(isOpen);

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 rounded-full bg-white shadow-lg hover:shadow-xl z-40"
        title="Keyboard Shortcuts (Press H)"
      >
        <HelpCircle className="h-5 w-5 text-gray-600" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 sticky top-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">⌨️ Keyboard Shortcuts</h2>
              <p className="text-blue-100 text-sm mt-1">
                Learn how to navigate faster with keyboard shortcuts
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category}>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {group.category}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <p className="text-gray-700">{shortcut.description}</p>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <div key={keyIdx} className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="bg-white border-gray-300 font-mono text-sm px-2.5 py-0.5"
                          >
                            {key}
                          </Badge>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="text-gray-400 text-xs">+</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Tips Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <h4 className="font-semibold text-blue-900 mb-2">💡 Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                • Shortcuts don't work when typing in inputs or text areas
              </li>
              <li>
                • Press <kbd className="px-1.5 py-0.5 bg-white border rounded">
                  /
                </kbd>{" "}
                to open the command palette for more options
              </li>
              <li>
                • Press{" "}
                <kbd className="px-1.5 py-0.5 bg-white border rounded">H</kbd> or{" "}
                <kbd className="px-1.5 py-0.5 bg-white border rounded">?</kbd>{" "}
                anytime to open this help dialog
              </li>
              <li>
                • Customize shortcuts in Settings → Keyboard Preferences
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 p-4 flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1"
          >
            Close
          </Button>
          <Button className="flex-1">
            🎛️ Customize Shortcuts
          </Button>
        </div>
      </Card>
    </div>
  );
}
