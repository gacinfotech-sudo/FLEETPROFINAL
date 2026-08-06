import { useState } from "react";
import { Car, BarChart3, Calendar, Users, History, TrendingUp, Menu, Shield, LogOut, UserPlus, ReceiptIcon, Banknote, Radio, MessageCircle, CalendarClock, Wallet, UserX, Gauge, Wrench, ClipboardCheck, Contact, HeartHandshake, Megaphone, PhoneIncoming, GitBranch, ListChecks, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/use-auth";
import GlobalCustomerSearch from "@/components/customers/global-customer-search";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  // Optional — when supplied, a "Search customers..." trigger renders at
  // the top of the sidebar (the only element persistent across every page
  // and both mobile/desktop layouts; the standalone header.tsx component
  // is dead code, never mounted anywhere, so it couldn't host this).
  onSelectCustomer?: (customerId: string) => void;
}

// `group` is purely a sidebar-presentation grouping — it does not change
// an item's id, route, permission flags, or the page component it renders.
// Every existing ViewType/route/deep-link keeps working unchanged; only
// how these entries are visually clustered in the nav changes. Booking is
// the primary operational function (see docs/CURRENT_INTERFACE_AUDIT.md),
// so its group sits directly under Dashboard rather than being scattered
// among unrelated entries as it was before.
const navItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "bookings", label: "Add Booking", icon: Calendar, group: "bookings" },
  { id: "live-bookings", label: "Live Bookings", icon: Radio, group: "bookings" },
  { id: "upcoming-bookings", label: "Upcoming Bookings", icon: CalendarClock, group: "bookings" },
  { id: "payment-dues", label: "Payment Collection Due", icon: Wallet, group: "bookings" },
  { id: "history", label: "Booking History", icon: History, group: "bookings" },
  { id: "inquiries", label: "Inquiries", icon: PhoneIncoming },
  { id: "leads", label: "Leads", icon: GitBranch },
  { id: "followups", label: "Follow-ups", icon: ListChecks },
  { id: "fleet", label: "View Fleet", icon: Car },
  { id: "vehicle-performance", label: "Vehicle Performance", icon: Wrench, restrictedForManagers: true },
  { id: "drivers", label: "Manage Drivers", icon: Users, restrictedForManagers: true },
  { id: "driver-attendance", label: "Driver Attendance", icon: ClipboardCheck, restrictedForManagers: true },
  { id: "driver-leave", label: "Driver Leave", icon: UserX, restrictedForManagers: true },
  { id: "driver-performance", label: "Driver Performance", icon: Gauge, restrictedForManagers: true },
  { id: "customers", label: "Customers", icon: Contact },
  { id: "after-sales", label: "After-Sales", icon: HeartHandshake, restrictedForManagers: true },
  { id: "campaigns", label: "Campaigns", icon: Megaphone, restrictedForManagers: true },
  { id: "vendors", label: "Vendors", icon: Building2, restrictedForManagers: true },
  { id: "revenue", label: "Revenue Report", icon: TrendingUp, restrictedForManagers: true },
  { id: "vendor-settlement", label: "Vendor Settlement", icon: Building2, restrictedForManagers: true },
  { id: "expenses", label: "Manage Expenses", icon: ReceiptIcon },
  { id: "salary", label: "Salary", icon: Banknote },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "users", label: "Manage Users", icon: UserPlus, adminOnly: true },
  { id: "profile", label: "Profile", icon: Shield },
];

const NAV_GROUPS: Record<string, { label: string; icon: typeof Calendar }> = {
  bookings: { label: "Bookings", icon: Calendar },
};

// Identical markup/behavior to what every nav item rendered before
// grouping existed — extracted only so both top-level and grouped items
// share one implementation instead of two copies drifting apart.
function NavButton({ item, isActive, onSelect, onToggleSidebar, compact }: {
  item: typeof navItems[number];
  isActive: boolean;
  onSelect: (id: string) => void;
  onToggleSidebar: () => void;
  // A grouped child already has its own left indent (the group's border);
  // stacking the top-level padding on top of that clipped longer labels
  // ("Upcoming Bookings", "Payment Collection Due") in the fixed-width
  // sidebar, so grouped children use a tighter, icon-sized padding.
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start py-3 lg:py-3 text-sm lg:text-base text-gray-700 hover:bg-gray-100 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] h-12 lg:h-auto",
        compact ? "px-2" : "px-3 lg:px-4",
        isActive && "bg-blue-50 border-r-4 border-blue-600 text-blue-700 shadow-sm"
      )}
      onClick={() => {
        onSelect(item.id);
        // Auto-close sidebar on mobile after selection
        if (window.innerWidth < 1024) {
          setTimeout(() => onToggleSidebar(), 200);
        }
      }}
    >
      <Icon className={compact ? "mr-2 shrink-0" : "mr-2 lg:mr-3 shrink-0"} size={18} />
      <span className="truncate">{item.label}</span>
    </Button>
  );
}

export default function Sidebar({ currentView, onViewChange, isOpen, onToggle, onSelectCustomer }: SidebarProps) {
  const { logout, user } = useAuth();
  // Every group starts expanded — Booking is the primary operational
  // function (docs/CURRENT_INTERFACE_AUDIT.md), so its items must be
  // visible without an extra click, not tucked behind a collapsed
  // section by default.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Filter navigation items based on user role
  const visibleNavItems = navItems.filter(item => {
    if (item.adminOnly) {
      return user?.role === 'admin' || user?.role === 'client';
    }
    if (item.restrictedForManagers && user?.role === 'manager') {
      return false;
    }
    return true;
  });

  // Groups the array's already-adjacent same-`group` entries into blocks —
  // every entry's id/route/permission-flags are untouched, only how they
  // are visually clustered changes. An item whose group has zero visible
  // children after the role filter above (not possible today, since no
  // grouped item is currently restrictedForManagers/adminOnly, but kept
  // correct for future items) never renders an empty group header.
  const navBlocks: Array<{ type: "item"; item: typeof navItems[number] } | { type: "group"; key: string; items: typeof navItems }> = [];
  for (const item of visibleNavItems) {
    if (!item.group) {
      navBlocks.push({ type: "item", item });
      continue;
    }
    const last = navBlocks[navBlocks.length - 1];
    if (last && last.type === "group" && last.key === item.group) {
      last.items.push(item);
    } else {
      navBlocks.push({ type: "group", key: item.group, items: [item] });
    }
  }

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden transition-opacity duration-300 ease-in-out animate-in fade-in-0"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col h-screen",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-center h-16 bg-blue-600">
          <div className="flex items-center">
            <Car className="text-white text-2xl mr-3" size={32} />
            <span className="text-white text-xl font-bold">FleetPro</span>
          </div>
        </div>
        
        {onSelectCustomer && (
          <div className="pt-3 lg:pt-4">
            <GlobalCustomerSearch
              onSelectCustomer={(customerId) => {
                onSelectCustomer(customerId);
                if (window.innerWidth < 1024) {
                  setTimeout(() => onToggle(), 200);
                }
              }}
            />
          </div>
        )}

        <nav className="mt-2 lg:mt-2 flex-1 overflow-y-auto min-h-0">
          <div className="px-3 lg:px-4 space-y-1 lg:space-y-2">
            {navBlocks.map((block) => {
              if (block.type === "item") {
                return <NavButton key={block.item.id} item={block.item} isActive={currentView === block.item.id} onSelect={onViewChange} onToggleSidebar={onToggle} />;
              }

              const group = NAV_GROUPS[block.key];
              // A deep-linked/active child keeps its group visibly
              // expanded even if the user had collapsed it earlier —
              // never hide the currently-open page behind a collapsed
              // section.
              const hasActiveChild = block.items.some((child) => child.id === currentView);
              const isGroupOpen = hasActiveChild || !collapsedGroups.has(block.key);
              const GroupIcon = group.icon;

              return (
                <Collapsible key={block.key}>
                  <CollapsibleTrigger
                    className="px-3 lg:px-4 py-3 text-sm lg:text-base text-gray-700 hover:bg-gray-100 h-12 lg:h-auto"
                    onClick={() => toggleGroup(block.key)}
                  >
                    <span className="flex items-center">
                      <GroupIcon className="mr-2 lg:mr-3" size={18} />
                      {group.label}
                    </span>
                    {isGroupOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </CollapsibleTrigger>
                  <CollapsibleContent isOpen={isGroupOpen} className="pl-2 space-y-1 lg:space-y-2 border-l-2 border-gray-100 ml-3">
                    {block.items.map((item) => (
                      <NavButton key={item.id} item={item} isActive={currentView === item.id} onSelect={onViewChange} onToggleSidebar={onToggle} compact />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="p-3 lg:p-4 border-t border-gray-200">
          <Button
            variant="ghost"
            className="w-full justify-start px-3 lg:px-4 py-3 text-sm lg:text-base text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] h-12 lg:h-auto"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 lg:mr-3" size={18} />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
}
