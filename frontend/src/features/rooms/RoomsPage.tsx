import React, { useState } from "react";
import AvailabilityPicker from "./components/AvailabilityPicker";
import RoomList from "./components/RoomList";

type SearchDates = {
  from: string;
  to: string;
} | null;

const RoomsPage = () => {
  const [searchDates, setSearchDates] = useState<SearchDates>(null);

  const handleSearch = (from: string, to: string) => {
    setSearchDates({ from, to });
  };

  const handleClear = () => {
    setSearchDates(null);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Inventario de Habitaciones</h2>
        <p className="text-slate-500 font-medium mt-3">
          Verificá la disponibilidad y gestioná el estado de limpieza del hotel.
        </p>
      </div>

      <div className="relative z-30">
        <AvailabilityPicker onSearch={handleSearch} onClear={handleClear} />
      </div>

      <div className="relative z-10">
        <RoomList searchDates={searchDates} />
      </div>
    </div>
  );
};

export default RoomsPage;
