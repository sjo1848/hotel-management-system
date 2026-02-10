import React, { useState } from "react";
import AvailabilityPicker from "./components/AvailabilityPicker";
import RoomList from "./components/RoomList";

const RoomsPage = () => {
  const [searchDates, setSearchDates] = useState(null);

  const handleSearch = (from, to) => {
    setSearchDates({ from, to });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Habitaciones</h2>
        <p className="text-sm text-slate-500 mt-1">
          Busca disponibilidad y reserva en segundos.
        </p>
      </div>

      <AvailabilityPicker onSearch={handleSearch} />

      <RoomList searchDates={searchDates} />
    </div>
  );
};

export default RoomsPage;
