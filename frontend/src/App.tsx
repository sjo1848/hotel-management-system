import { Suspense, lazy, ReactNode } from "react";
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardHome from "./features/dashboard/DashboardHome";
import LoginPage from "./features/auth/LoginPage";
import { AuthProvider } from "./features/auth/AuthContext";
import { useAuth } from "./features/auth/useAuth";
import { ToastProvider } from "./components/ui/toast";
import { ApiInterceptor } from "./components/ApiInterceptor";
import NotFoundPage from "./features/errors/NotFoundPage";
import GeneralErrorPage from "./features/errors/GeneralErrorPage";
import AccessDeniedPage from "./features/errors/AccessDeniedPage";
import { Capability, roleHasCapability } from "./features/auth/capabilities";
import { HMSQueryProvider } from "./lib/QueryProvider";
import { ThemeProvider } from "./theme/ThemeContext";
import { GuidedModeProvider } from "./features/guided/GuidedModeContext";

const BookingsPage = lazy(() => import("./features/bookings/BookingsPage"));
const RoomsPage = lazy(() => import("./features/rooms/RoomsPage"));
const CalendarPage = lazy(() => import("./features/schedule/CalendarPage"));
const GuestsPage = lazy(() => import("./features/guests/GuestsPage"));
const HousekeepingPage = lazy(() => import("./features/housekeeping/HousekeepingPage"));
const UsersPage = lazy(() => import("./features/users/UsersPage"));
const ReportsPage = lazy(() => import("./features/reports/ReportsPage"));
const HotelNetworkPage = lazy(() => import("./features/dashboard/HotelNetworkPage"));

const AppLayout = () => (
  <DashboardLayout>
    <Outlet />
  </DashboardLayout>
);

const RouteLoading = () => (
  <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
    <p className="text-sm font-semibold text-muted-foreground">Cargando modulo...</p>
  </div>
);

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Verificando sesión...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const RequireCapability = ({
  capability,
  children,
}: {
  capability: Capability;
  children: ReactNode;
}) => {
  const { user } = useAuth();

  if (!roleHasCapability(user?.role, capability)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};

const RoleHomeRedirect = () => {
  const { user } = useAuth();

  if (roleHasCapability(user?.role, "analytics.kpis.read")) {
    return <DashboardHome />;
  }

  if (roleHasCapability(user?.role, "bookings.read")) {
    return <Navigate to="/bookings" replace />;
  }

  if (roleHasCapability(user?.role, "housekeeping.read")) {
    return <Navigate to="/housekeeping" replace />;
  }

  if (roleHasCapability(user?.role, "saas.hotels.read")) {
    return <Navigate to="/network" replace />;
  }

  return <Navigate to="/forbidden" replace />;
};

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <GeneralErrorPage />,
  },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    errorElement: <GeneralErrorPage />,
    children: [
      {
        path: "/",
        element: <RoleHomeRedirect />,
      },
      {
        path: "/bookings",
        element: (
          <RequireCapability capability="bookings.read">
            <Suspense fallback={<RouteLoading />}>
              <BookingsPage />
            </Suspense>
          </RequireCapability>
        ),
      },
      {
        path: "/rooms",
        element: (
          <RequireCapability capability="rooms.read">
            <Suspense fallback={<RouteLoading />}>
              <RoomsPage />
            </Suspense>
          </RequireCapability>
        ),
      },
      {
        path: "/calendar",
        element: (
          <RequireCapability capability="bookings.read">
            <Suspense fallback={<RouteLoading />}>
              <CalendarPage />
            </Suspense>
          </RequireCapability>
        ),
      },
      {
        path: "/guests",
        element: (
          <RequireCapability capability="guests.read">
            <Suspense fallback={<RouteLoading />}>
              <GuestsPage />
            </Suspense>
          </RequireCapability>
        ),
      },
      {
        path: "/housekeeping",
        element: (
          <RequireCapability capability="housekeeping.read">
            <Suspense fallback={<RouteLoading />}>
              <HousekeepingPage />
            </Suspense>
          </RequireCapability>
        ),
      },
      {
        path: "/users",
        element: (
          <RequireCapability capability="users.read">
            <Suspense fallback={<RouteLoading />}>
              <UsersPage />
            </Suspense>
          </RequireCapability>
        ),
      },
      {
        path: "/network",
        element: (
          <RequireCapability capability="saas.hotels.read">
            <Suspense fallback={<RouteLoading />}>
              <HotelNetworkPage />
            </Suspense>
          </RequireCapability>
        ),
      },
      {
        path: "/reports",
        element: (
          <RequireCapability capability="reports.revenue.read">
            <Suspense fallback={<RouteLoading />}>
              <ReportsPage />
            </Suspense>
          </RequireCapability>
        ),
      },
      {
        path: "/forbidden",
        element: <AccessDeniedPage />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

function App() {
  return (
    <ThemeProvider>
      <HMSQueryProvider>
        <AuthProvider>
          <GuidedModeProvider>
            <ToastProvider>
              <ApiInterceptor />
              <RouterProvider router={router} />
            </ToastProvider>
          </GuidedModeProvider>
        </AuthProvider>
      </HMSQueryProvider>
    </ThemeProvider>
  );
}

export default App;
