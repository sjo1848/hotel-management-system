import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  Search,
  Menu,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";
import { Capability, roleHasCapability } from "@/features/auth/capabilities";

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  path, 
  active, 
  collapsed 
}: { 
  icon: any, 
  label: string, 
  path: string, 
  active: boolean,
  collapsed: boolean
}) => {
  return (
    <Link to={path} title={collapsed ? label : ""}>
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 group relative overflow-hidden",
          active
            ? "bg-white/10 text-white shadow-lg backdrop-blur-md border border-white/5"
            : "text-slate-400 hover:bg-white/5 hover:text-white",
          collapsed && "justify-center px-0"
        )}
      >
        {active && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary shadow-[0_0_10px_rgba(var(--secondary),0.5)]" />
        )}
        <Icon className={cn(
          "w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110", 
          active ? "text-secondary" : "text-slate-500 group-hover:text-slate-300"
        )} />
        {!collapsed && (
          <span className="font-medium text-sm tracking-wide animate-in fade-in slide-in-from-left-2 duration-300">
            {label}
          </span>
        )}
      </div>
    </Link>
  );
};

type NavItem = {
  icon: any;
  label: string;
  path: string;
  capability: Capability;
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [searchValue, setSearchValue] = useState("");
  
  // Persistencia del estado de la sidebar
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchValue.trim()) {
      const term = searchValue.toLowerCase();
      if (!isNaN(Number(term))) {
        navigate(`/rooms`);
      } else if (term.includes("@")) {
        navigate(`/guests`);
      } else {
        navigate(`/bookings`);
      }
      setSearchValue("");
    }
  };

  const principalItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/", capability: "analytics.kpis.read" },
    { icon: ClipboardList, label: "Reservas", path: "/bookings", capability: "bookings.read" },
    { icon: CalendarDays, label: "Calendario", path: "/calendar", capability: "bookings.read" },
  ];

  const managementItems: NavItem[] = [
    { icon: BedDouble, label: "Habitaciones", path: "/rooms", capability: "rooms.read" },
    { icon: Users, label: "Huéspedes", path: "/guests", capability: "guests.read" },
    { icon: Brush, label: "Servicios", path: "/housekeeping", capability: "housekeeping.read" },
  ];

  const settingsItems: NavItem[] = [
    { icon: Globe, label: "Red Global", path: "/network", capability: "saas.hotels.read" },
    { icon: Settings, label: "Usuarios", path: "/users", capability: "users.read" },
    { icon: TrendingUp, label: "Tendencias", path: "/reports", capability: "reports.revenue.read" },
  ];

  const canSee = (capability: Capability) => roleHasCapability(user?.role, capability);
  const visiblePrincipalItems = principalItems.filter((item) => canSee(item.capability));
  const visibleManagementItems = managementItems.filter((item) => canSee(item.capability));
  const visibleSettingsItems = settingsItems.filter((item) => canSee(item.capability));

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* SIDEBAR - DEEP THEME */}
      <aside className={cn(
        "bg-slate-950 text-white flex flex-col shadow-2xl z-50 relative transition-all duration-500 ease-in-out",
        isCollapsed ? "w-20" : "w-72"
      )}>
        {/* Abstract Background Decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-64 bg-secondary/5 blur-[100px] pointer-events-none" />

        {/* Brand */}
        <div className={cn("relative transition-all duration-500", isCollapsed ? "p-4 text-center" : "p-8 pb-4")}>
          <div className={cn("flex items-center gap-4", isCollapsed && "justify-center")}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/20 shrink-0">
              <span className="font-bold text-xl text-white">H</span>
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                <h1 className="text-2xl font-bold tracking-tight text-white leading-none">
                  HMS <span className="text-secondary">ELITE</span>
                </h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-1 font-semibold">
                  {user?.hotel_id === "00000000-0000-0000-0000-000000000001" ? "SEDE CENTRAL" : "PROPIEDAD ASIGNADA"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-24 w-6 h-6 bg-secondary text-slate-900 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform z-50"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Navigation */}
        <nav className="relative flex-1 px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar overflow-x-hidden">
          <div>
            {!isCollapsed && visiblePrincipalItems.length > 0 && (
              <p className="px-4 text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest animate-in fade-in duration-300">
                Principal
              </p>
            )}
            <div className="space-y-1">
              {visiblePrincipalItems.map((item) => (
                <SidebarItem
                  key={item.path}
                  icon={item.icon}
                  label={item.label}
                  path={item.path}
                  active={
                    item.path === "/"
                      ? location.pathname === "/"
                      : location.pathname.startsWith(item.path)
                  }
                  collapsed={isCollapsed}
                />
              ))}
            </div>
          </div>

          <div>
            {!isCollapsed && visibleManagementItems.length > 0 && (
              <p className="px-4 text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest animate-in fade-in duration-300">
                Gestión
              </p>
            )}
            <div className="space-y-1">
              {visibleManagementItems.map((item) => (
                <SidebarItem
                  key={item.path}
                  icon={item.icon}
                  label={item.label}
                  path={item.path}
                  active={location.pathname.startsWith(item.path)}
                  collapsed={isCollapsed}
                />
              ))}
            </div>
          </div>

          {visibleSettingsItems.length > 0 && (
            <div>
              {!isCollapsed && (
                <p className="px-4 text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest animate-in fade-in duration-300">
                  Configuración
                </p>
              )}
              <div className="space-y-1">
                {visibleSettingsItems.map((item) => (
                  <SidebarItem
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    path={item.path}
                    active={location.pathname.startsWith(item.path)}
                    collapsed={isCollapsed}
                  />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* User Footer */}
        <div className={cn(
          "relative p-4 mx-4 mb-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm transition-all duration-500",
          isCollapsed && "mx-2 p-2"
        )}>
          <div className={cn("flex items-center gap-3", !isCollapsed && "mb-3", isCollapsed && "justify-center")}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-white/10 shrink-0">
              <span className="font-bold text-sm">{user?.username?.charAt(0).toUpperCase() || "U"}</span>
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden animate-in fade-in duration-300">
                <p className="text-sm font-medium truncate">{user?.username || "Usuario"}</p>
                <p className="text-xs text-slate-500 truncate capitalize">{user?.role || "Staff"}</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/10 h-9 text-xs animate-in fade-in duration-300"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
        {/* Top Header Glass */}
        <header className="h-20 px-8 flex items-center justify-between z-40 sticky top-0 md:relative">
          <div className="flex-1 max-w-xl">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
              <Input
                placeholder="Buscar reservas, habitaciones o huéspedes..."
                className="pl-10 bg-white border-slate-200/60 shadow-sm focus:ring-secondary/20 rounded-xl h-10 w-full transition-all duration-300 focus:w-[105%]"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 ml-4">
            <Button size="icon" variant="ghost" className="rounded-full hover:bg-white hover:shadow-sm text-slate-500 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </Button>
            <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setIsCollapsed(!isCollapsed)}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-auto p-8 pt-0">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
