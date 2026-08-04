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
import { PageHeader } from "@/components/ui/page-header";

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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 font-bold text-primary shadow-sm">
            {item.full_name.charAt(0)}
          </div>
          <div>
            <div className="font-bold text-foreground">{item.full_name}</div>
            <div className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              ID: {item.id.slice(0, 8)}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: "Contacto",
      cell: (item) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="w-3 h-3" /> {item.email}
          </div>
          {item.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" /> {item.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Miembro Desde",
      cell: (item) => (
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          {item.created_at 
            ? format(new Date(item.created_at), "dd MMM, yyyy")
            : "Fecha no disponible"}
        </div>
      ),
    },
    {
      header: "Acciones",
      cell: (item) => (
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs font-bold text-primary hover:bg-primary/10 hover:text-primary"
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
      <PageHeader
        title="Directorio de Huéspedes"
        description="Historial y gestión de clientes del hotel."
        icon={<User className="h-5 w-5" />}
        actions={
          <Button
            className="h-12 gap-2 rounded-xl bg-primary shadow-xl shadow-primary/15 transition-all active:scale-95"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Registrar Huésped
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={guests}
        isLoading={loading}
        error={guestsError ? getErrorMessage(guestsError, "No se pudo cargar la lista de huéspedes") : null}
        onRetry={() => {
          void refetchGuests();
        }}
        searchable
        searchPlaceholder="Buscar por nombre o email..."
      />

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
