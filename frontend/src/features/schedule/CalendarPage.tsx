import React from "react";
import TapeChart from "../calendar/components/TapeChart";

const CalendarPage = () => {
  return (
    <div className="space-y-10">
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none text-slate-900">Plano de Ocupación</h2>
        <p className="text-slate-500 font-medium mt-3">
          Control visual de disponibilidad y gestión de estancias activas.
        </p>
      </div>

      <TapeChart />
    </div>
  );
};

export default CalendarPage;
