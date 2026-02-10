import React, { useState } from "react";
import RoomList from "./features/rooms/components/RoomList";
import AvailabilityPicker from "./features/rooms/components/AvailabilityPicker";

function App() {
  // Estado para las fechas de búsqueda que vienen del AvailabilityPicker
  const [searchDates, setSearchDates] = useState({ from: "", to: "" });

  const handleSearch = (from: string, to: string) => {
    setSearchDates({ from, to });
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header Estilo SaaS */}
      <header className="bg-white border-b border-slate-200 py-6 mb-8">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏨</span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                HMS Elite
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Gestión Hotelera Profesional
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            {/* Aquí irán botones de perfil o notificaciones luego */}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-20">
        {/* Paso 1: Buscador con shadcn */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 ml-1">
            Reservaciones
          </h2>
          <AvailabilityPicker onSearch={handleSearch} />
        </section>

        {/* Paso 2: Grilla de Habitaciones (Acá adentro ocurre la magia) */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">
              {searchDates.from
                ? "Habitaciones Disponibles"
                : "Inventario de Habitaciones"}
            </h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
              Rust Backend Activo
            </span>
          </div>

          {/* RoomList recibe las fechas y se encarga de llamar a la API */}
          <RoomList searchDates={searchDates} />
        </section>
      </main>
    </div>
  );
}

export default App;
