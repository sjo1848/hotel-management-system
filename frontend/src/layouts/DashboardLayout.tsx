import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
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
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";
import { Capability, roleHasCapability } from "@/features/auth/capabilities";
import ThemeToggle from "@/theme/ThemeToggle";

type SidebarTooltip = {
  label: string;
  description?: string;
  top: number;
  left: number;
};

const SidebarItem = ({
  icon: Icon,
  label,
  description,
  path,
  active,
  collapsed,
  showDescription,
  showCompactLabel,
  onNavigate,
  onCompactExpand,
  requireExpandBeforeNavigate,
  onTooltipChange,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  path: string;
  active: boolean;
  collapsed: boolean;
  showDescription?: boolean;
  showCompactLabel?: boolean;
  onNavigate?: () => void;
  onCompactExpand?: () => void;
  requireExpandBeforeNavigate?: boolean;
  onTooltipChange?: (tooltip: SidebarTooltip | null) => void;
}) => {
  const showTooltip = (target: HTMLAnchorElement) => {
    if (!collapsed || !onTooltipChange) return;
    const rect = target.getBoundingClientRect();
    onTooltipChange({
      label,
      description,
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    });
  };

  return (
    <Link
      to={path}
      onClick={(event) => {
        if (requireExpandBeforeNavigate) {
          event.preventDefault();
          onCompactExpand?.();
          return;
        }
        onNavigate?.();
      }}
      onMouseEnter={(event) => showTooltip(event.currentTarget)}
      onMouseMove={(event) => showTooltip(event.currentTarget)}
      onMouseLeave={() => onTooltipChange?.(null)}
      onPointerEnter={(event) => showTooltip(event.currentTarget as HTMLAnchorElement)}
      onPointerMove={(event) => showTooltip(event.currentTarget as HTMLAnchorElement)}
      onPointerLeave={() => onTooltipChange?.(null)}
      onFocus={(event) => showTooltip(event.currentTarget)}
      onBlur={() => onTooltipChange?.(null)}
    >
      <div
        className={cn(
          "app-sidebar-link flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 group relative md:py-3",
          !collapsed && "py-3.5",
          active ? "app-sidebar-link-active" : "",
          collapsed && "justify-center px-0",
          collapsed && showCompactLabel && "flex-col gap-2 px-1.5 py-2.5",
          collapsed && "hover:bg-transparent",
        )}
      >
        <div className="relative flex h-11 w-11 items-center justify-center">
          <div
            className={cn(
              "absolute inset-0 rounded-2xl transition-all duration-200 ease-out",
              collapsed
                ? "scale-75 bg-secondary/0 opacity-0 group-hover:scale-100 group-hover:bg-secondary/12 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:bg-secondary/12 group-focus-within:opacity-100"
                : "",
              active ? "scale-100 bg-secondary/16 opacity-100" : "",
            )}
          />
          <Icon
            className={cn(
              "relative z-10 h-5 w-5 shrink-0 transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:scale-110 group-focus-within:-translate-y-0.5 group-focus-within:scale-110",
            )}
            style={{
              color: active
                ? "hsl(var(--secondary))"
                : "hsl(var(--shell-sidebar-icon))",
            }}
          />
        </div>
        {!collapsed && (
          <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
            <span className="block truncate font-medium text-sm tracking-wide">
              {label}
            </span>
            {showDescription && description ? (
              <span
                className="mt-0.5 block truncate text-xs font-medium"
                style={{ color: "hsl(var(--shell-sidebar-muted))" }}
              >
                {description}
              </span>
            ) : null}
          </div>
        )}
        {collapsed && showCompactLabel ? (
          <span className="sr-only">{label}</span>
        ) : null}
      </div>
    </Link>
  );
};

type NavItem = {
  icon: LucideIcon;
  label: string;
  description: string;
  path: string;
  capability: Capability;
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [searchValue, setSearchValue] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileNavExpanded, setMobileNavExpanded] = useState(false);
  const [sidebarTooltip, setSidebarTooltip] = useState<SidebarTooltip | null>(null);
  const [mobileNavPreview, setMobileNavPreview] = useState<{
    label: string;
    description?: string;
  } | null>(null);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    setSidebarTooltip(null);
    if (!mobileNavOpen) {
      setMobileNavExpanded(false);
    }
  }, [isCollapsed, mobileNavOpen, location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    setMobileNavExpanded(true);
  }, [mobileNavOpen]);

  useEffect(() => {
    const dismissTooltip = () => setSidebarTooltip(null);
    window.addEventListener("resize", dismissTooltip);
    window.addEventListener("scroll", dismissTooltip, true);

    return () => {
      window.removeEventListener("resize", dismissTooltip);
      window.removeEventListener("scroll", dismissTooltip, true);
    };
  }, []);

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
        navigate("/rooms");
      } else if (term.includes("@")) {
        navigate("/guests");
      } else {
        navigate("/bookings");
      }
      setSearchValue("");
    }
  };

  const principalItems: NavItem[] = [
    { icon: ClipboardList, label: "Recepción", description: "Llegadas, salidas, cobros y reservas", path: "/bookings", capability: "bookings.read" },
    { icon: LayoutDashboard, label: "Dashboard", description: "KPIs y salud operativa general", path: "/", capability: "analytics.kpis.read" },
    { icon: CalendarDays, label: "Calendario", description: "Ocupación y disponibilidad por fecha", path: "/calendar", capability: "bookings.read" },
  ];

  const managementItems: NavItem[] = [
    { icon: BedDouble, label: "Habitaciones", description: "Inventario, estados y disponibilidad", path: "/rooms", capability: "rooms.read" },
    { icon: Users, label: "Huéspedes", description: "Directorio y fichas de clientes", path: "/guests", capability: "guests.read" },
    { icon: Brush, label: "Housekeeping", description: "Limpieza, handoff y mantenimiento", path: "/housekeeping", capability: "housekeeping.read" },
  ];

  const settingsItems: NavItem[] = [
    { icon: Globe, label: "Red Global", description: "Visión multi-hotel y planes", path: "/network", capability: "saas.hotels.read" },
    { icon: Settings, label: "Usuarios", description: "Accesos, roles y operadores", path: "/users", capability: "users.read" },
    { icon: TrendingUp, label: "Tendencias", description: "Ingresos, ocupación y reportes", path: "/reports", capability: "reports.revenue.read" },
  ];

  const canSee = (capability: Capability) => roleHasCapability(user?.role, capability);
  const visiblePrincipalItems = principalItems.filter((item) => canSee(item.capability));
  const visibleManagementItems = managementItems.filter((item) => canSee(item.capability));
  const visibleSettingsItems = settingsItems.filter((item) => canSee(item.capability));
  const visibleNavItems = [
    ...visiblePrincipalItems,
    ...visibleManagementItems,
    ...visibleSettingsItems,
  ];
  const activeNavItem = visibleNavItems.find((item) =>
    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path),
  );

  useEffect(() => {
    setMobileNavPreview(
      activeNavItem
        ? { label: activeNavItem.label, description: activeNavItem.description }
        : { label: "Menu", description: "Navegacion principal" },
    );
  }, [activeNavItem?.description, activeNavItem?.label, location.pathname, mobileNavOpen]);

  const renderNavSection = (
    title: string,
    items: NavItem[],
    collapsed: boolean,
    isRootAware = false,
    onNavigate?: () => void,
    showDescription = false,
    showCompactLabel = false,
    requireExpandBeforeNavigate = false,
  ) => {
    if (items.length === 0) return null;

    return (
      <div>
        {!collapsed && (
          <p className="sidebar-text-muted mb-4 px-4 text-xs font-bold uppercase tracking-widest">
            {title}
          </p>
        )}
        <div className="space-y-1">
          {items.map((item) => (
            <SidebarItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              description={item.description}
              path={item.path}
              active={
                isRootAware && item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.path)
              }
              collapsed={collapsed}
              showDescription={showDescription}
              showCompactLabel={showCompactLabel}
              onNavigate={onNavigate}
              onCompactExpand={() => setMobileNavExpanded(true)}
              requireExpandBeforeNavigate={requireExpandBeforeNavigate}
              onTooltipChange={(tooltip) => {
                setSidebarTooltip(tooltip);
                if (collapsed && mobileNavOpen) {
                  setMobileNavPreview(
                    tooltip
                      ? { label: item.label, description: item.description }
                      : activeNavItem
                        ? {
                            label: activeNavItem.label,
                            description: activeNavItem.description,
                          }
                        : { label: "Menu", description: "Navegacion principal" },
                  );
                }
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  const navigationContent = (
    collapsed: boolean,
    onNavigate?: () => void,
    showCompactLabel = false,
    requireExpandBeforeNavigate = false,
  ) => (
    <>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <nav className="drawer-scrollbar h-full min-h-0 overflow-y-auto px-4 py-6 space-y-8">
          {renderNavSection("Recepción y control", visiblePrincipalItems, collapsed, true, onNavigate, !collapsed, showCompactLabel, requireExpandBeforeNavigate)}
          {renderNavSection("Inventario y servicio", visibleManagementItems, collapsed, false, onNavigate, !collapsed, showCompactLabel, requireExpandBeforeNavigate)}
          {renderNavSection("Dirección y administración", visibleSettingsItems, collapsed, false, onNavigate, !collapsed, showCompactLabel, requireExpandBeforeNavigate)}
        </nav>
      </div>

      <div
        className={cn(
          "sidebar-footer-surface relative mx-4 mb-4 rounded-2xl border p-4 backdrop-blur-sm transition-all duration-500",
          collapsed && "mx-2 p-2",
        )}
      >
        <div className={cn("flex items-center gap-3", !collapsed && "mb-3", collapsed && "justify-center")}>
          <div className="sidebar-avatar-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-full border">
            <span className="text-sm font-bold">{user?.username?.charAt(0).toUpperCase() || "U"}</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.username || "Usuario"}</p>
              <p className="sidebar-text-muted truncate text-xs capitalize">{user?.role || "Staff"}</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="sidebar-text-muted min-h-10 w-full justify-start text-xs hover:bg-[hsl(var(--shell-sidebar-hover))] hover:text-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div className="theme-fade app-shell flex h-dvh overflow-hidden font-sans text-foreground">
      <aside
        className={cn(
          "app-sidebar relative z-50 hidden shadow-2xl transition-all duration-500 ease-in-out md:flex md:flex-col",
          isCollapsed ? "w-20" : "w-72",
        )}
      >
        <div className="pointer-events-none absolute inset-0 app-sidebar-gradient" />
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-64 bg-secondary/10 blur-[120px]" />

        <div className={cn("relative transition-all duration-500", isCollapsed ? "p-4 text-center" : "p-8 pb-4")}>
          <div className={cn("flex items-center gap-4", isCollapsed && "justify-center")}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-amber-700 shadow-lg shadow-amber-900/20">
              <span className="text-xl font-bold text-secondary-foreground">H</span>
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                <h1 className="sidebar-text-fg text-2xl font-bold leading-none tracking-tight">
                  HMS <span className="text-secondary">ELITE</span>
                </h1>
                <p className="sidebar-text-muted mt-1 text-xs font-semibold uppercase tracking-[0.2em]">
                  {user?.hotel_name || (user?.hotel_id === "00000000-0000-0000-0000-000000000001" ? "SEDE CENTRAL" : "PROPIEDAD ASIGNADA")}
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "app-sidebar-toggle absolute top-1/2 z-50 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-secondary-foreground transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex",
            isCollapsed ? "-right-5" : "-right-4",
          )}
          aria-label={isCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
          aria-pressed={!isCollapsed}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {navigationContent(isCollapsed)}
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className={cn(
            "app-sidebar sidebar-text-fg flex h-dvh max-h-dvh flex-col overflow-hidden border-r p-0 transition-[width,max-width] duration-300 ease-out md:hidden",
            mobileNavExpanded ? "w-[18rem] max-w-[18rem]" : "w-28 max-w-28",
          )}
          onMouseEnter={() => setMobileNavExpanded(true)}
          onMouseMove={() => setMobileNavExpanded(true)}
          onMouseLeave={() => setMobileNavExpanded(false)}
        >
          <div className="relative px-3 py-5">
            <div className={cn("mb-4 flex", mobileNavExpanded ? "justify-end" : "justify-center")}>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-xl"
                aria-label={mobileNavExpanded ? "Colapsar menú móvil" : "Expandir menú móvil"}
                onClick={() => setMobileNavExpanded((current) => !current)}
              >
                {mobileNavExpanded ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className={cn("relative flex", mobileNavExpanded ? "items-center gap-4 px-2" : "justify-center")}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-amber-700 shadow-lg shadow-amber-900/20">
                <span className="text-xl font-bold text-secondary-foreground">H</span>
              </div>
              {mobileNavExpanded ? (
                <div>
                  <p className="sidebar-text-fg text-sm font-black tracking-tight">
                    HMS ELITE
                  </p>
                  <p className="sidebar-text-muted mt-1 text-xs font-semibold uppercase tracking-[0.18em]">
                    Navegacion
                  </p>
                </div>
              ) : null}
            </div>
            <div className="relative mt-4 text-center">
              <p className={cn("sidebar-text-fg font-bold", mobileNavExpanded ? "text-sm" : "text-xs")}>
                {mobileNavPreview?.label ?? "Menu"}
              </p>
              <p className={cn("sidebar-text-muted mt-1 font-medium leading-4", mobileNavExpanded ? "px-3 text-xs" : "text-xs")}>
                {mobileNavPreview?.description ?? "Navegacion principal"}
              </p>
            </div>
          </div>
          {navigationContent(
            !mobileNavExpanded,
            () => setMobileNavOpen(false),
            !mobileNavExpanded,
            !mobileNavExpanded,
          )}
        </SheetContent>
      </Sheet>

      <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="app-header responsive-shell-header sticky top-0 z-40 md:relative">
          <div className="flex w-full items-center gap-3 md:max-w-xl md:flex-1">
            <Button size="icon" variant="ghost" className="shrink-0 md:hidden" onClick={() => setMobileNavOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="group relative min-w-0 flex-1">
              <Search className="app-search-icon absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors group-focus-within:text-foreground" />
              <Input
                placeholder="Buscar huésped, habitación o reserva..."
                className="app-search-input h-10 w-full min-w-0 rounded-xl pl-10 shadow-sm transition-all duration-300"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
          </div>

          <div className="flex w-full items-center justify-end gap-2 md:ml-4 md:w-auto md:gap-4">
            <ThemeToggle className="hidden sm:inline-flex" compact />
            <Button size="icon" variant="ghost" aria-label="Notificaciones" className="relative rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full border border-card bg-red-500" />
            </Button>
          </div>
        </header>

        <div className="motion-stage min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background/30 px-4 pb-4 pt-0 md:p-8 md:pt-0">
          <div key={location.pathname} className="motion-page mx-auto min-w-0 max-w-7xl">
            {children}
          </div>
        </div>
      </main>

      {sidebarTooltip && (isCollapsed || mobileNavOpen) && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[120]"
              style={{
                top: sidebarTooltip.top,
                left: sidebarTooltip.left,
                transform: "translateY(-50%)",
              }}
            >
              <div className="animate-in fade-in slide-in-from-left-2 zoom-in-95 duration-200 motion-reduce:animate-none">
                <div className="relative overflow-hidden rounded-full border border-border bg-card px-3 py-2 shadow-2xl shadow-black/20 backdrop-blur-md">
                  <div className="absolute inset-y-1 left-1 w-1 rounded-full bg-secondary/80" />
                  <div className="whitespace-nowrap pl-2 text-xs font-semibold tracking-wide text-foreground">
                    {sidebarTooltip.label}
                  </div>
                </div>
                <div className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1 -translate-y-1/2 rotate-45 rounded-sm border-l border-t border-border bg-card" />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default DashboardLayout;
