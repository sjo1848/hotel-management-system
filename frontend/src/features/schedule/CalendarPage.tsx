import React from "react";
import TapeChart from "./TapeChart";

const CalendarPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Calendario</h2>
        <p className="text-sm text-slate-500 mt-1">
          Visualizá la ocupación por habitación en las próximas semanas.
        </p>
      </div>

      <TapeChart />
    </div>
  );
};

export default CalendarPage;
