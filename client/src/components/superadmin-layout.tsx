import { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { LogOut, LayoutDashboard, Building2, Menu } from 'lucide-react';
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
        await fetch('https://localhost:5050/api/auth/logout', {
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
        {/* Logo */}
        <div className="p-6 border-b border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">
              FP
            </div>
            {sidebarOpen && (
              <div>
                <div className="font-bold text-lg">FleetPro</div>
                <div className="text-xs text-blue-200">Admin Panel</div>
              </div>
            )}
          </div>
        </div>

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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <div className="text-sm text-gray-600">Root Admin</div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
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
