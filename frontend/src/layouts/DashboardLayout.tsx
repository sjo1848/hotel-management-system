import React from "react";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  BedDouble,
  Users,
  Brush,
  Settings,
  LogOut,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";

const SidebarItem = ({ icon: Icon, label, path }) => {
  const location = useLocation();
  const isActive = location.pathname === path;

  return (
    <Link to={path}>
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
          isActive 
            ? "bg-slate-900 text-white shadow-md shadow-slate-200" 
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`} />
        <span className="font-semibold text-sm">{label}</span>
      </div>
    </Link>
  );
};

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout().catch(() => null);
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen app-shell overflow-hidden font-sans antialiased text-slate-900">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-50">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-200 rotate-3">
              <span className="text-white font-black text-xl">H</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                HMS ELITE
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Management
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-6">
          <div>
            <p className="px-4 text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.2em]">
              Operaciones
            </p>
            <div className="space-y-1">
              <SidebarItem icon={LayoutDashboard} label="Dashboard" path="/" />
              <SidebarItem icon={ClipboardList} label="Reservas" path="/bookings" />
              <SidebarItem icon={CalendarDays} label="Calendario" path="/calendar" />
              <SidebarItem icon={BedDouble} label="Habitaciones" path="/rooms" />
              <SidebarItem icon={Users} label="Huéspedes" path="/guests" />
              <SidebarItem icon={Brush} label="Housekeeping" path="/housekeeping" />
            </div>
          </div>

          <div>
            <p className="px-4 text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.2em]">
              Sistema
            </p>
            <div className="space-y-1">
              <SidebarItem icon={Settings} label="Usuarios" path="/users" />
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors font-bold text-xs uppercase tracking-wider"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-3" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-40">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Sistema de Gestión</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-1">Hospitalidad Premium</p>
          </div>
          
          <div className="flex items-center gap-6">
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl relative border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
            </Button>
            
            <div className="h-10 w-px bg-slate-200 mx-2"></div>

            <div className="flex items-center gap-3 bg-slate-50 pl-3 pr-1 py-1 rounded-2xl border border-slate-100">
              <div className="text-right">
                <div className="text-sm font-black text-slate-800 leading-none capitalize">
                  {user?.username || "Usuario"}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                  {user?.role || "sesion"}
                </div>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-slate-200 to-slate-300 rounded-xl border border-white shadow-sm flex items-center justify-center font-bold text-slate-500 uppercase">
                {user?.username?.charAt(0) || "U"}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
