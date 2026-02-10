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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Habitaciones</h2>
        <p className="text-sm text-slate-500 mt-1">
          Buscá disponibilidad y reservá en segundos.
        </p>
      </div>

      <AvailabilityPicker onSearch={handleSearch} />

      <RoomList searchDates={searchDates} />
    </div>
  );
};

export default RoomsPage;
