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
        element: <DashboardHome />,
      },
      {
        path: "/bookings",
        element: <BookingsPage />,
      },
      {
        path: "/rooms",
        element: <RoomsPage />,
      },
      {
        path: "/calendar",
        element: <CalendarPage />,
      },
      {
        path: "/guests",
        element: <GuestsPage />,
      },
      {
        path: "/housekeeping",
        element: <HousekeepingPage />,
      },
      {
        path: "/users",
        element: <UsersPage />,
      },
      {
        path: "/network",
        element: <HotelNetworkPage />,
      },
      {
        path: "/reports",
        element: <ReportsPage />,
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
    <AuthProvider>
      <ToastProvider>
        <ApiInterceptor />
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
