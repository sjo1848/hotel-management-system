import { useMemo, useState } from "react";
import { User, Mail, Phone, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/ui/data-table";
import { getGuests } from "./services/guestService";
import { Guest } from "@/types/domain";
import { useToast } from "@/components/ui/toast";
import { format } from "date-fns";
import GuestCreateDrawer from "./components/GuestCreateDrawer";
import GuestDetailsSheet from "./components/GuestDetailsSheet";
import { invalidateResource, useResourceQuery } from "@/lib/useResourceQuery";
import { getErrorMessage } from "@/api/errors";

const GuestsPage = () => {
  const { toast } = useToast();
  const guestsQueryKey = "guests:list";
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);

  const {
    data: guestsData,
    isLoading: loading,
    error: guestsError,
    refetch: refetchGuests,
  } = useResourceQuery<Guest[]>({
    queryKey: guestsQueryKey,
    queryFn: getGuests,
    staleTimeMs: 10_000,
  });
  const guests = useMemo(() => guestsData ?? [], [guestsData]);

  const columns: Column<Guest>[] = [
    {
      header: "Huésped",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
            {item.full_name.charAt(0)}
          </div>
          <div>
            <div className="font-bold text-slate-900">{item.full_name}</div>
            <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">ID: {item.id.slice(0, 8)}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Contacto",
      cell: (item) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Mail className="w-3 h-3" /> {item.email}
          </div>
          {item.phone && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Phone className="w-3 h-3" /> {item.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Miembro Desde",
      cell: (item) => (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          {item.created_at 
            ? format(new Date(item.created_at), "dd MMM, yyyy")
            : "Fecha no disponible"}
        </div>
      ),
    },
    {
      header: "",
      cell: (item) => (
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-indigo-600 font-bold text-xs h-8"
            onClick={() => {
              setSelectedGuest(item);
              setIsDetailsOpen(true);
            }}
          >
            Ver Ficha
          </Button>
        </div>
      ),
      className: "w-[100px]",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <User className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
              Directorio de Huéspedes
            </h2>
          </div>
          <p className="text-slate-500 font-medium mt-2">
            Historial y gestión de clientes del hotel.
          </p>
        </div>

        <Button 
          className="h-12 rounded-xl bg-slate-900 shadow-xl shadow-slate-200 transition-all active:scale-95 gap-2"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Registrar Huésped
        </Button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
        {guestsError && (
          <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
            {getErrorMessage(guestsError, "No se pudo cargar la lista de huéspedes")}
          </div>
        )}
        <DataTable
          columns={columns}
          data={guests}
          isLoading={loading}
          searchable
          searchPlaceholder="Buscar por nombre o email..."
        />
      </div>

      <GuestCreateDrawer 
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={async () => {
          invalidateResource(guestsQueryKey);
          await refetchGuests();
          toast({ title: "Listado actualizado", variant: "success" });
        }}
      />

      <GuestDetailsSheet
        guest={selectedGuest}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedGuest(null);
        }}
      />
    </div>
  );
};

export default GuestsPage;
