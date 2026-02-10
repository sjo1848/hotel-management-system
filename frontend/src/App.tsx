import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardHome from "./features/dashboard/DashboardHome";
import BookingList from "./features/bookings/components/BookingList.jsx";
import RoomList from "./features/rooms/components/RoomList.jsx";
import React from "react";

const Placeholder = ({ title }) => (
  <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-sm">
    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
    <p className="text-sm text-slate-500 mt-2">
      Esta sección está en construcción.
    </p>
  </div>
);

const NotFound = () => (
  <div className="p-8">
    <h2 className="text-lg font-semibold text-slate-800">Página no encontrada</h2>
    <p className="text-sm text-slate-500 mt-2">
      Revisa la URL o vuelve al dashboard.
    </p>
  </div>
);

const AppLayout = () => (
  <DashboardLayout>
    <Outlet />
  </DashboardLayout>
);

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        element: <DashboardHome />,
      },
      {
        path: "/bookings",
        element: <BookingList />,
      },
      {
        path: "/rooms",
        element: <RoomList />,
      },
      {
        path: "/guests",
        element: <Placeholder title="Huéspedes" />,
      },
      {
        path: "/settings",
        element: <Placeholder title="Configuración" />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
