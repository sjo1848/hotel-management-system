import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Phone,
  MoreVertical,
  History,
  ExternalLink
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getGuests, Guest } from "./services/guestService";

const GuestsPage = () => {
  const [data, setData] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGuests = async () => {
      try {
        const guestsData = await getGuests();
        setData(guestsData);
      } catch (error) {
        console.error("Failed to load guests", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGuests();
  }, []);

  const columns: Column<Guest>[] = [
    {
      header: "Huésped",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100 uppercase">
            {item.full_name.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-slate-900">{item.full_name}</div>
            <div className="text-xs text-slate-400 font-mono">ID: {item.id.substring(0, 8)}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Contacto",
      cell: (item) => (
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            {item.email}
          </div>
          {item.phone && (
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {item.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Acciones",
      cell: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Información de Huésped</DropdownMenuLabel>
            <DropdownMenuItem className="gap-2">
              <ExternalLink className="w-4 h-4" /> Ver Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <History className="w-4 h-4" /> Historial de Reservas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-indigo-600 font-medium">
              Editar Datos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "text-right w-[50px]",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Directorio de Huéspedes
            </h2>
          </div>
          <p className="text-slate-500 text-sm mt-1 ml-11">
            Gestiona la base de datos de clientes y su historial de fidelidad.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="h-10 gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all bg-slate-900">
            <UserPlus className="w-4 h-4" /> Registrar Huésped
          </Button>
        </div>
      </div>

      <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={data}
          isLoading={loading}
          searchable
          searchPlaceholder="Nombre, email o ID..."
        />
      </div>
    </div>
  );
};

export default GuestsPage;
