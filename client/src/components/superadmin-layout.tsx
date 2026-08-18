import { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { LogOut, LayoutDashboard, Building2, Menu, DollarSign, CreditCard, Package, Settings, Users, Sliders, Shield, BarChart3, Heart, Lock, MessageSquare } from 'lucide-react';
import { useState } from 'react';

interface SuperAdminLayoutProps {
  children: ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function handleLogout() {
    try {
      const token = localStorage.getItem('fleetpro_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    }

    localStorage.removeItem('fleetpro_token');
    localStorage.removeItem('fleetpro_user');
    setLocation('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-blue-900 text-white transition-all duration-300 flex flex-col`}>
        {/* Logo - Clickable */}
        <button
          onClick={() => setLocation('/superadmin/dashboard')}
          className="p-6 border-b border-blue-800 hover:bg-blue-800 transition-colors text-left w-full"
          title="Go to Dashboard"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg hover:bg-blue-500 transition-colors">
              FP
            </div>
            {sidebarOpen && (
              <div>
                <div className="font-bold text-lg hover:text-blue-200 transition-colors">FleetPro</div>
                <div className="text-xs text-blue-200">Admin Panel</div>
              </div>
            )}
          </div>
        </button>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-2">
          <NavItem
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            onClick={() => setLocation('/superadmin')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<Building2 size={20} />}
            label="Tenants"
            onClick={() => setLocation('/superadmin/tenants')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<Package size={20} />}
            label="Plans"
            onClick={() => setLocation('/superadmin/plans')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<CreditCard size={20} />}
            label="Subscriptions"
            onClick={() => setLocation('/superadmin/subscriptions')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<DollarSign size={20} />}
            label="Billing"
            onClick={() => setLocation('/superadmin/billing')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<DollarSign size={20} />}
            label="💰 Revenue Intelligence"
            onClick={() => setLocation('/superadmin/revenue')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<Users size={20} />}
            label="👥 User Management"
            onClick={() => setLocation('/superadmin/users')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<Sliders size={20} />}
            label="⚙️ Settings"
            onClick={() => setLocation('/superadmin/settings')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<Shield size={20} />}
            label="🔍 Audit Logs"
            onClick={() => setLocation('/superadmin/audit')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<BarChart3 size={20} />}
            label="📊 Advanced Analytics"
            onClick={() => setLocation('/superadmin/analytics')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<Heart size={20} />}
            label="❤️ Customer Success"
            onClick={() => setLocation('/superadmin/cs')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<Lock size={20} />}
            label="🔒 Compliance & Security"
            onClick={() => setLocation('/superadmin/compliance')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<MessageSquare size={20} />}
            label="💬 Support Ticketing"
            onClick={() => setLocation('/superadmin/support')}
            open={sidebarOpen}
          />
          <NavItem
            icon={<Settings size={20} />}
            label="Advanced Console"
            onClick={() => setLocation('/superadmin/console')}
            open={sidebarOpen}
          />
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-blue-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
          >
            <Menu size={24} />
          </button>
          <div className="text-xs sm:text-sm text-gray-600 truncate ml-2">Root Admin</div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  open: boolean;
}

function NavItem({ icon, label, onClick, open }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-800 transition-colors text-left"
    >
      {icon}
      {open && <span>{label}</span>}
    </button>
  );
}
