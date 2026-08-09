import { useState } from "react";
import { Car, BarChart3, Calendar, Users, History, TrendingUp, Shield, LogOut, UserPlus, ReceiptIcon, Banknote, Radio, MessageCircle, CalendarClock, Wallet, UserX, Gauge, Wrench, ClipboardCheck, Contact, HeartHandshake, Megaphone, PhoneIncoming, GitBranch, ListChecks, Building2, ChevronDown, ChevronRight, Gift, ListFilter, Satellite, UserRoundPlus, Users2, KeySquare, MapPin, AlertCircle, FileText, Repeat2, DollarSign } from "lucide-react";
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
  // and both mobile/desktop layouts).
  onSelectCustomer?: (customerId: string) => void;
}

// `group` is purely a sidebar-presentation grouping — it does not change
// an item's id, route, permission flags, or the page component it renders.
//
// WAVE 1: Section-wise consolidation (2026-08-09)
// Dashboard → Customers (inquiries/leads/followups) → Bookings (all booking ops)
// → Drivers → Fleet → Vendors → Finance/Payments → Communication → Admin
//
// MANDATED PRIMARY ORDER (see docs/final-ui report): Dashboard, then
// Customers, then Bookings. These three must remain in this order to avoid
// e2e regression (tests/e2e/ui-shell-redesign.spec.ts).
const navItems = [
  // DASHBOARD
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },

  // CUSTOMERS: All customer-related operations (inquiries, leads, followups, self-drive)
  { id: "customers", label: "Customer Database", icon: Contact, group: "customers" },
  { id: "customers-add", label: "Add Customer", icon: UserRoundPlus, group: "customers" },
  { id: "inquiries", label: "Inquiries", icon: PhoneIncoming, group: "customers" },
  { id: "leads", label: "Leads", icon: GitBranch, group: "customers" },
  { id: "followups", label: "Follow-ups", icon: ListChecks, group: "customers" },
  { id: "self-drive", label: "Self Drive Bookings", icon: KeySquare, group: "customers" },
  { id: "after-sales", label: "After-Sales", icon: HeartHandshake, group: "customers", restrictedForManagers: true },
  { id: "campaigns", label: "Campaigns", icon: Megaphone, group: "customers", restrictedForManagers: true },
  { id: "rewards-referrals", label: "Rewards & Referrals", icon: Gift, group: "customers", restrictedForManagers: true },

  // BOOKINGS: All booking-related operations (create, view, schedule, payment)
  { id: "bookings", label: "Create Booking", icon: Calendar, group: "bookings" },
  { id: "live-bookings", label: "Live Bookings", icon: Radio, group: "bookings" },
  { id: "live-operations", label: "Vehicles on Booking", icon: Car, group: "bookings" },
  { id: "upcoming-bookings", label: "Upcoming Bookings", icon: CalendarClock, group: "bookings" },
  { id: "booking-queues", label: "Booking Queues", icon: ListFilter, group: "bookings" },
  { id: "history", label: "Booking History", icon: History, group: "bookings" },
  { id: "payment-dues", label: "Payment Collection", icon: Wallet, group: "bookings" },

  // DRIVERS: All driver-related operations (schedule, duties, compliance, performance)
  // Every driver-related destination lives inside this ONE group — never
  // add a driver-* item outside it (that re-creates the scattered-sidebar
  // problem this grouping removed; see docs/final-ui driver report).
  { id: "drivers", label: "Driver Database", icon: Users, group: "drivers", restrictedForManagers: true },
  { id: "drivers-add", label: "Add Driver", icon: UserRoundPlus, group: "drivers", restrictedForManagers: true },
  { id: "driver-attendance", label: "Attendance", icon: ClipboardCheck, group: "drivers", restrictedForManagers: true },
  { id: "driver-leave", label: "Leave Calendar", icon: UserX, group: "drivers", restrictedForManagers: true },
  { id: "driver-performance", label: "Performance", icon: Gauge, group: "drivers", restrictedForManagers: true },

  // FLEET: All vehicle and fleet operations (vehicles, GPS, maintenance, fuel)
  { id: "fleet", label: "Fleet Overview", icon: Car, group: "fleet" },
  { id: "gps-tracking", label: "GPS Tracking", icon: Satellite, group: "fleet" },
  { id: "vehicle-performance", label: "Vehicle Performance", icon: Wrench, group: "fleet", restrictedForManagers: true },

  // VENDORS: All vendor-related operations (vendor mgmt, rates, settlements)
  { id: "vendors", label: "Vendors", icon: Building2, group: "vendors", restrictedForManagers: true },
  { id: "vendor-settlement", label: "Vendor Settlement", icon: Repeat2, group: "vendors", restrictedForManagers: true },

  // FINANCE/PAYMENTS: All financial operations (revenue, expenses, salary)
  { id: "revenue", label: "Revenue Report", icon: TrendingUp, group: "finance", restrictedForManagers: true },
  { id: "expenses", label: "Manage Expenses", icon: ReceiptIcon, group: "finance" },
  { id: "salary", label: "Salary", icon: Banknote, group: "finance" },

  // COMMUNICATION: WhatsApp and messaging
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, group: "communication" },

  // ADMIN: User management and settings (adminOnly)
  { id: "users", label: "Manage Users", icon: UserPlus, group: "admin", adminOnly: true },
  { id: "profile", label: "Profile", icon: Shield, group: "admin" },
];

const NAV_GROUPS: Record<string, { label: string; icon: typeof Calendar }> = {
  customers: { label: "Customers", icon: Users2 },
  bookings: { label: "Bookings", icon: Calendar },
  drivers: { label: "Drivers", icon: Users },
  fleet: { label: "Fleet", icon: Car },
  vendors: { label: "Vendors", icon: Building2 },
  finance: { label: "Finance / Payments", icon: DollarSign },
  communication: { label: "Communication", icon: MessageCircle },
  admin: { label: "Admin", icon: Shield },
};

// Identical markup/behavior shared by top-level and grouped items so the
// two never drift apart visually.
function NavButton({ item, isActive, onSelect, onToggleSidebar, compact }: {
  item: typeof navItems[number];
  isActive: boolean;
  onSelect: (id: string) => void;
  onToggleSidebar: () => void;
  // A grouped child already has its own left indent (the group's border);
  // stacking the top-level padding on top of that clipped longer labels
  // in the fixed-width sidebar, so grouped children use a tighter padding.
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Button
      variant="ghost"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "w-full justify-start py-2.5 text-sm text-gray-700 hover:bg-gray-100 h-10 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
        compact ? "px-2" : "px-3",
        isActive && "bg-blue-50 text-blue-700 font-medium shadow-sm"
      )}
      onClick={() => {
        onSelect(item.id);
        // Auto-close sidebar on mobile after selection
        if (window.innerWidth < 1024) {
          setTimeout(() => onToggleSidebar(), 200);
        }
      }}
    >
      <Icon className={cn("shrink-0", compact ? "mr-2" : "mr-2.5", isActive ? "text-blue-600" : "text-gray-500")} size={18} />
      <span className="truncate">{item.label}</span>
    </Button>
  );
}

export default function Sidebar({ currentView, onViewChange, isOpen, onToggle, onSelectCustomer }: SidebarProps) {
  const { logout, user } = useAuth();
  // Customers and Bookings start expanded — they are the primary
  // operational functions and must be visible without an extra click.
  // Other groups start collapsed to keep the sidebar compact; an active
  // child still forces its parent open (see below).
  // WAVE 1: Start Customers, Bookings expanded. Drivers, Fleet, Vendors,
  // Finance, Communication collapsed. Admin hidden until needed.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(["drivers", "fleet", "vendors", "finance", "communication", "admin"])
  );

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
  // ids/routes/permission flags untouched, only visual clustering changes.
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

      {/* Sidebar — width comes from the shell layout token, never a local
          hard-coded value (see index.css --sidebar-width). */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[var(--sidebar-width)] bg-white border-r border-gray-200 shadow-xl lg:shadow-none transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col h-screen",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand — always navigates home to the Dashboard. */}
        <button
          type="button"
          aria-label="Go to Dashboard"
          onClick={() => {
            onViewChange("dashboard");
            if (window.innerWidth < 1024) {
              setTimeout(() => onToggle(), 200);
            }
          }}
          className="flex items-center justify-center h-[var(--header-height)] shrink-0 bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset"
        >
          <Car className="text-white mr-3" size={28} />
          <span className="text-white text-xl font-bold tracking-tight">FleetPro</span>
        </button>

        {onSelectCustomer && (
          // The horizontal inset lives on this wrapper, not on the trigger
          // button itself — a w-full child with its own mx-* margins was
          // the root cause of the long-standing sidebar-search overflow.
          <div className="px-3 pt-3">
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

        <nav className="mt-2 flex-1 overflow-y-auto min-h-0">
          <div className="px-3 space-y-0.5">
            {navBlocks.map((block) => {
              if (block.type === "item") {
                return <NavButton key={block.item.id} item={block.item} isActive={currentView === block.item.id} onSelect={onViewChange} onToggleSidebar={onToggle} />;
              }

              const group = NAV_GROUPS[block.key];
              // A deep-linked/active child keeps its group visibly
              // expanded even if the user had collapsed it earlier.
              const hasActiveChild = block.items.some((child) => child.id === currentView);
              const isGroupOpen = hasActiveChild || !collapsedGroups.has(block.key);
              const GroupIcon = group.icon;

              return (
                <Collapsible key={block.key}>
                  <CollapsibleTrigger
                    className={cn(
                      "px-3 py-2.5 text-sm h-10 rounded-lg hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500",
                      hasActiveChild ? "text-blue-700 font-semibold" : "text-gray-800 font-medium"
                    )}
                    onClick={() => toggleGroup(block.key)}
                  >
                    <span className="flex items-center">
                      <GroupIcon className={cn("mr-2.5", hasActiveChild ? "text-blue-600" : "text-gray-500")} size={18} />
                      {group.label}
                    </span>
                    {isGroupOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent isOpen={isGroupOpen} className="pl-2 space-y-0.5 border-l-2 border-gray-100 ml-4 mb-1">
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
        <div className="p-3 border-t border-gray-200 shrink-0">
          <Button
            variant="ghost"
            className="w-full justify-start px-3 py-2.5 text-sm h-10 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500"
            onClick={handleLogout}
          >
            <LogOut className="mr-2.5" size={18} />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
}
