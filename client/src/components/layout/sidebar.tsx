import { useState, useEffect } from "react";
import { Car, BarChart3, Calendar, Users, History, TrendingUp, Menu, Shield, LogOut, UserPlus, ReceiptIcon, Banknote, Radio, MessageCircle, CalendarClock, Wallet, UserX, Gauge, Wrench, ClipboardCheck, Contact, HeartHandshake, Megaphone, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import GlobalCustomerSearch from "@/components/customers/global-customer-search";
// The final-canonical merge brought back this manifest-driven sidebar but
// dropped the import that feeds it.
import { SAAS_MODULES, getNavigationStructure } from "@/modules/manifest";
import { ShieldCheck } from "lucide-react";

// Root Control Plane (Wave 1) — platform Super Admin console. These are
// genuine top-level routes (client/src/App.tsx), not `onViewChange` SPA
// sections like everything above, so they navigate with a real <a href>
// rather than the section-switch callback. Gated on role==='admin' as a
// client-side visibility stopgap only (matches App.tsx's ProtectedRoute
// requiredRole="admin" stopgap) — the actual authorization boundary is
// server-side, on every /api/root/** route, via platformRole.
const ROOT_NAV_ITEMS = [
  { href: "/root/dashboard", label: "Root Dashboard" },
  { href: "/root/tenants", label: "Tenant Database" },
  { href: "/root/customers", label: "Global Customers" },
  { href: "/root/sales", label: "Sales Pipeline" },
  { href: "/root/product-config", label: "Product Configuration" },
  { href: "/root/support-tickets", label: "Support Center" },
  { href: "/root/error-center", label: "Error Center" },
  { href: "/root/diagnostics", label: "Support Diagnostics" },
  { href: "/root/security", label: "Security" },
  { href: "/root/audit-log", label: "Audit Log" },
];

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  // Customer chosen from the sidebar's global customer search — optional so
  // shells without a customer pane can omit it.
  onSelectCustomer?: (customerId: string) => void;
}

const icons = {
  dashboard: BarChart3, live: Radio, upcoming: CalendarClock, 'payment-due': Wallet,
  booking: Calendar, fleet: Car, 'vehicle-performance': Wrench, drivers: Users,
  'driver-attendance': ClipboardCheck, 'driver-leave': UserX, 'driver-performance': Gauge,
  history: History, customers: Contact, 'after-sales': HeartHandshake, campaigns: Megaphone,
  revenue: TrendingUp, expenses: ReceiptIcon, salary: Banknote, whatsapp: MessageCircle,
  users: UserPlus, profile: Shield, contact: Contact, calendar: Calendar, receipt: ReceiptIcon,
  banknote: Banknote, alert: AlertCircle,
} as const;

export default function Sidebar({ currentView, onViewChange, isOpen, onToggle }: SidebarProps) {
  const { logout, user } = useAuth();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['dashboard']));

  const navStructure = getNavigationStructure(user?.role, user?.permissions);

  // Expand group if its child is currently active
  useEffect(() => {
    const activeModule = SAAS_MODULES.find((m) => m.id === currentView);
    if (activeModule?.parentGroup) {
      const parentGroup = activeModule.parentGroup;
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        next.add(parentGroup);
        return next;
      });
    }
  }, [currentView]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
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

  const renderNavigationItem = (moduleId: string) => {
    const module = SAAS_MODULES.find((m) => m.id === moduleId);
    if (!module) return null;

    const Icon = icons[module.iconKey as keyof typeof icons];
    const isActive = currentView === module.id;

    return (
      <Button
        key={module.id}
        variant="ghost"
        className={cn(
          "w-full justify-start px-3 lg:px-4 py-2 lg:py-2 text-sm lg:text-base text-gray-700 hover:bg-gray-100 transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] h-10 lg:h-auto",
          isActive && "bg-blue-50 border-r-4 border-blue-600 text-blue-700 shadow-sm"
        )}
        onClick={() => {
          onViewChange(module.id);
          if (window.innerWidth < 1024) {
            setTimeout(() => onToggle(), 200);
          }
        }}
      >
        {Icon && <Icon className="mr-2 lg:mr-3" size={16} />}
        {module.label}
      </Button>
    );
  };

  const renderGroup = (group: any) => {
    if (group.id === 'dashboard') {
      return (
        <div key={group.id} className="px-3 lg:px-4 space-y-1">
          {renderNavigationItem(group.children[0])}
        </div>
      );
    }

    const isExpanded = expandedGroups.has(group.id);
    const hasActiveChild = group.children.some((childId: string) => childId === currentView);

    return (
      <div key={group.id} className="space-y-1">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-between px-3 lg:px-4 py-2 lg:py-2 text-sm lg:text-base font-medium text-gray-700 hover:bg-gray-100 transition-all duration-200 h-10 lg:h-auto",
            hasActiveChild && "text-blue-700 bg-blue-50"
          )}
          onClick={() => toggleGroup(group.id)}
        >
          <div className="flex items-center">
            {icons[group.iconKey as keyof typeof icons] &&
              (() => {
                const Icon = icons[group.iconKey as keyof typeof icons];
                return <Icon className="mr-2 lg:mr-3" size={16} />;
              })()
            }
            {group.label}
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </Button>

        {isExpanded && (
          <div className="pl-4 lg:pl-6 space-y-1 border-l-2 border-gray-200">
            {group.children.map((childId: string) => renderNavigationItem(childId))}
          </div>
        )}
      </div>
    );
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

        <nav className="mt-6 lg:mt-8 flex-1 overflow-y-auto">
          <div className="px-1 lg:px-2 space-y-2 lg:space-y-3">
            {navStructure.map((group) => renderGroup(group))}
          </div>
        </nav>

        {/* Root Control Plane (Wave 1) — see ROOT_NAV_ITEMS comment above
            for why this section uses real <a href> navigation instead of
            onViewChange. Client-side visibility only; real gating is
            server-side. */}
        {user?.role === 'admin' && (
          <div className="px-3 lg:px-4 py-2 border-t border-gray-200 space-y-1 lg:space-y-2 max-h-48 overflow-y-auto">
            <div className="flex items-center px-1 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <ShieldCheck className="mr-2 shrink-0" size={14} />
              Root / Platform
            </div>
            {ROOT_NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors truncate"
              >
                {item.label}
              </a>
            ))}
          </div>
        )}

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
