import { useEffect, useCallback } from "react";

interface ShortcutConfig {
  key: string; // Single character or key name
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  callback: () => void;
  description?: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, preventDefault = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatches =
          event.key.toUpperCase() === shortcut.key.toUpperCase() ||
          event.code === shortcut.key;

        const ctrlMatches =
          (shortcut.ctrl ?? false) === (event.ctrlKey || event.metaKey);
        const shiftMatches = (shortcut.shift ?? false) === event.shiftKey;
        const altMatches = (shortcut.alt ?? false) === event.altKey;
        const metaMatches = (shortcut.meta ?? false) === event.metaKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          if (preventDefault) {
            event.preventDefault();
          }
          shortcut.callback();
          break;
        }
      }
    },
    [shortcuts, enabled, preventDefault]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}

// Common shortcuts
export const COMMON_SHORTCUTS = {
  CREATE_BOOKING: { key: "B", description: "Create new booking" },
  COLLECT_PAYMENT: { key: "P", description: "Collect payment" },
  ONBOARD_DRIVER: { key: "D", description: "Onboard driver" },
  ASSIGN_VEHICLE: { key: "V", description: "Assign vehicle" },
  VIEW_ANALYTICS: { key: "A", description: "View analytics" },
  OPEN_HELP: { key: "H", description: "Open help" },
  TOGGLE_SIDEBAR: { key: "S", ctrl: true, description: "Toggle sidebar" },
  OPEN_SEARCH: { key: "/", description: "Search/Command palette" },
  CLOSE_MODAL: { key: "Escape", description: "Close modal/panel" },
};
