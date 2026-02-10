import React from "react";
import BookingList from "./components/BookingList.jsx";

const BookingsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Reservas</h2>
        <p className="text-sm text-slate-500 mt-1">
          Gestiona reservas activas y cambios de última hora.
        </p>
      </div>

      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-medium text-slate-900">Todas las reservas</h3>
        </div>
        <div className="p-0">
          <BookingList limit={0} showActions />
        </div>
      </div>
    </div>
  );
};

export default BookingsPage;
