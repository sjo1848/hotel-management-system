import { createBrowserRouter, RouterProvider, Outlet, Navigate } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardHome from "./features/dashboard/DashboardHome";
import BookingsPage from "./features/bookings/BookingsPage";
import RoomsPage from "./features/rooms/RoomsPage";
import CalendarPage from "./features/schedule/CalendarPage";
import GuestsPage from "./features/guests/GuestsPage";
import HousekeepingPage from "./features/housekeeping/HousekeepingPage";
import LoginPage from "./features/auth/LoginPage";
import UsersPage from "./features/users/UsersPage";
import ReportsPage from "./features/reports/ReportsPage";
import HotelNetworkPage from "./features/dashboard/HotelNetworkPage";
import { ReactNode } from "react";
import { AuthProvider } from "./features/auth/AuthContext";
import { useAuth } from "./features/auth/useAuth";
import { ToastProvider } from "./components/ui/toast";
import { ApiInterceptor } from "./components/ApiInterceptor";
import NotFoundPage from "./features/errors/NotFoundPage";
import GeneralErrorPage from "./features/errors/GeneralErrorPage";
import AccessDeniedPage from "./features/errors/AccessDeniedPage";
import { Capability, roleHasCapability } from "./features/auth/capabilities";
import { HMSQueryProvider } from "./lib/QueryProvider";

const AppLayout = () => (
  <DashboardLayout>
    <Outlet />
  </DashboardLayout>
);

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
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
        element: (
          <RequireCapability capability="analytics.kpis.read">
            <DashboardHome />
          </RequireCapability>
        ),
      },
      {
        path: "/bookings",
        element: (
          <RequireCapability capability="bookings.read">
            <BookingsPage />
          </RequireCapability>
        ),
      },
      {
        path: "/rooms",
        element: (
          <RequireCapability capability="rooms.read">
            <RoomsPage />
          </RequireCapability>
        ),
      },
      {
        path: "/calendar",
        element: (
          <RequireCapability capability="bookings.read">
            <CalendarPage />
          </RequireCapability>
        ),
      },
      {
        path: "/guests",
        element: (
          <RequireCapability capability="guests.read">
            <GuestsPage />
          </RequireCapability>
        ),
      },
      {
        path: "/housekeeping",
        element: (
          <RequireCapability capability="housekeeping.read">
            <HousekeepingPage />
          </RequireCapability>
        ),
      },
      {
        path: "/users",
        element: (
          <RequireCapability capability="users.read">
            <UsersPage />
          </RequireCapability>
        ),
      },
      {
        path: "/network",
        element: (
          <RequireCapability capability="saas.hotels.read">
            <HotelNetworkPage />
          </RequireCapability>
        ),
      },
      {
        path: "/reports",
        element: (
          <RequireCapability capability="reports.revenue.read">
            <ReportsPage />
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
    <HMSQueryProvider>
      <AuthProvider>
        <ToastProvider>
          <ApiInterceptor />
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </HMSQueryProvider>
  );
}

export default App;
