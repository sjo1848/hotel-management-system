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
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
            ? "bg-slate-100 text-slate-900 shadow-lg backdrop-blur-md border border-slate-200 dark:bg-white/10 dark:text-white dark:border-white/5"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white",
          collapsed && "justify-center px-0"
        )}
      >
        {active && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary shadow-[0_0_10px_rgba(var(--secondary),0.5)]" />
        )}
        <Icon className={cn(
          "w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110", 
          active ? "text-secondary" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"
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
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden dark:bg-slate-950 dark:text-slate-100">
      {/* SIDEBAR - DEEP THEME */}
      <aside className={cn(
        "bg-white text-slate-900 flex flex-col shadow-2xl z-50 relative transition-all duration-500 ease-in-out border-r border-slate-200 dark:bg-slate-950 dark:text-white dark:border-slate-800",
        isCollapsed ? "w-20" : "w-72"
      )}>
        {/* Abstract Background Decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-100 to-white pointer-events-none dark:from-slate-900 dark:to-slate-950" />
        <div className="absolute top-0 left-0 right-0 h-64 bg-secondary/10 blur-[100px] pointer-events-none dark:bg-secondary/5" />

        {/* Brand */}
        <div className={cn("relative transition-all duration-500", isCollapsed ? "p-4 text-center" : "p-8 pb-4")}>
          <div
            className={cn(
              "flex",
              isCollapsed
                ? "flex-col items-center justify-center gap-3"
                : "items-start justify-between gap-4",
            )}
          >
            <div className={cn("flex items-center gap-4", isCollapsed && "justify-center")}>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/20 shrink-0">
                <span className="font-bold text-xl text-white">H</span>
              </div>
              {!isCollapsed && (
                <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-none dark:text-white">
                    HMS <span className="text-secondary">ELITE</span>
                  </h1>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-1 font-semibold dark:text-slate-400">
                    {user?.hotel_id === "00000000-0000-0000-0000-000000000001" ? "SEDE CENTRAL" : "PROPIEDAD ASIGNADA"}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
              className={cn(
                "h-9 w-9 rounded-xl border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                isCollapsed && "h-8 w-8 rounded-lg",
              )}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 mx-auto" />
              ) : (
                <ChevronLeft className="h-4 w-4 mx-auto" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar overflow-x-hidden">
          <div>
            {!isCollapsed && visiblePrincipalItems.length > 0 && (
              <p className="px-4 text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest animate-in fade-in duration-300">
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
              <p className="px-4 text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest animate-in fade-in duration-300">
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
                <p className="px-4 text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest animate-in fade-in duration-300">
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
          "relative p-4 mx-4 mb-4 rounded-2xl bg-white border border-slate-200 backdrop-blur-sm transition-all duration-500 dark:bg-white/5 dark:border-white/5",
          isCollapsed && "mx-2 p-2"
        )}>
          <div className={cn("flex items-center gap-3", !isCollapsed && "mb-3", isCollapsed && "justify-center")}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-white/10 shrink-0">
              <span className="font-bold text-sm">{user?.username?.charAt(0).toUpperCase() || "U"}</span>
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden animate-in fade-in duration-300">
                <p className="text-sm font-medium truncate text-slate-800 dark:text-slate-100">{user?.username || "Usuario"}</p>
                <p className="text-xs text-slate-500 truncate capitalize dark:text-slate-400">{user?.role || "Staff"}</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 h-9 text-xs animate-in fade-in duration-300 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative dark:bg-slate-950/70">
        {/* Top Header Glass */}
        <header className="h-20 px-8 flex items-center justify-between z-40 sticky top-0 md:relative">
          <div className="flex-1 max-w-xl">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-slate-600 transition-colors" />
              <Input
                placeholder="Buscar reservas, habitaciones o huéspedes..."
                className="pl-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/60 shadow-sm focus:ring-secondary/20 rounded-xl h-10 w-full transition-all duration-300 focus:w-[105%]"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 ml-4">
            <ThemeToggle />
            <Button size="icon" variant="ghost" className="rounded-full hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm text-slate-500 dark:text-slate-400 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900"></span>
            </Button>
            <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setIsCollapsed(!isCollapsed)}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-auto p-8 pt-0">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 motion-fade-up">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
