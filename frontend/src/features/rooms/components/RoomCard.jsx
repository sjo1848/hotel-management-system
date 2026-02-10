import React from "react";
import { Bed, CheckCircle2, AlertCircle } from "lucide-react";

const RoomCard = ({ room }) => {
  // Mapeo de estados a estilos de Tailwind
  const statusStyles = {
    Available: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: <CheckCircle2 className="w-4 h-4 mr-1" />,
    },
    Occupied: {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      icon: <AlertCircle className="w-4 h-4 mr-1" />,
    },
    // Default para mantenimiento o sucio
    default: {
      bg: "bg-slate-50",
      text: "text-slate-700",
      border: "border-slate-200",
      icon: <AlertCircle className="w-4 h-4 mr-1" />,
    },
  };

  const style = statusStyles[room.status] || statusStyles.default;

  return (
    <div
      className={`p-5 rounded-xl border ${style.border} bg-white shadow-sm hover:shadow-md transition-shadow duration-200`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-100 rounded-lg">
          <Bed className="w-6 h-6 text-slate-600" />
        </div>
        <span
          className={`flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
        >
          {style.icon}
          {room.status}
        </span>
      </div>

      <h3 className="text-lg font-bold text-slate-900">
        Habitación {room.room_number}
      </h3>
      <p className="text-sm text-slate-500 mb-4">{room.room_type}</p>

      <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
        <div>
          <span className="text-2xl font-bold text-slate-900">
            ${(room.price_cents / 100).toFixed(2)}
          </span>
          <span className="text-xs text-slate-400 ml-1">/ noche</span>
        </div>
        <button className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
          Reservar
        </button>
      </div>
    </div>
  );
};

export default RoomCard;
