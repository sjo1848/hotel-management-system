import React from "react";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  BedDouble,
  Users,
  Settings,
  LogOut,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logout } from "@/features/auth/authService";

const SidebarItem = ({ icon: Icon, label, path }) => {
  const location = useLocation();
  const isActive = location.pathname === path;

  return (
    <Link to={path}>
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${isActive ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
      >
        <Icon className="w-5 h-5" />
        <span className="font-medium text-sm">{label}</span>
      </div>
    </Link>
  );
};

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout().catch(() => null);
    localStorage.removeItem("hms_token");
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen app-shell overflow-hidden font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-slate-900 to-slate-700 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold">H</span>
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              HMS Elite
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Gestión hotelera premium
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <p className="px-4 text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            Operaciones
          </p>
          <SidebarItem icon={LayoutDashboard} label="Dashboard" path="/" />
          <SidebarItem icon={ClipboardList} label="Reservas" path="/bookings" />
          <SidebarItem icon={CalendarDays} label="Calendario" path="/calendar" />
          <SidebarItem icon={BedDouble} label="Habitaciones" path="/rooms" />
          <SidebarItem icon={Users} label="Huéspedes" path="/guests" />

          <p className="px-4 text-xs font-semibold text-slate-400 mt-8 mb-2 uppercase tracking-wider">
            Sistema
          </p>
          <SidebarItem icon={Settings} label="Configuración" path="/settings" />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
          <h1 className="text-xl font-semibold text-slate-800">HMS Manager</h1>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full relative"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </Button>
            <div className="w-8 h-8 bg-slate-200 rounded-full border border-slate-300"></div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
