import { useMemo, useRef, useState } from "react";
import { User, Calendar, Plus, Search, ChevronRight } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/lib/useMediaQuery";

const GuestsPage = () => {
  const { toast } = useToast();
  const guestsQueryKey = "guests:list";
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [mobileSearch, setMobileSearch] = useState("");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const detailsReturnRef = useRef<HTMLElement | null>(null);

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
  const mobileGuests = useMemo(() => {
    const query = mobileSearch.trim().toLocaleLowerCase();
    if (!query) return guests;
    return guests.filter((guest) =>
      [guest.full_name, guest.email, guest.phone].filter(Boolean).some((value) =>
        value?.toLocaleLowerCase().includes(query),
      ),
    );
  }, [guests, mobileSearch]);

  const openDetails = (guest: Guest) => {
    detailsReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedGuest(guest);
    setIsDetailsOpen(true);
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
    setSelectedGuest(null);
    const target = detailsReturnRef.current;
    detailsReturnRef.current = null;
    if (target) requestAnimationFrame(() => target.focus());
  };

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
            className="min-h-9 text-xs font-bold text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => {
              openDetails(item);
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
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 md:space-y-8">
      {isMobile ? (
        <div className="flex min-h-11 items-center justify-between gap-3" aria-label="Encabezado de huéspedes">
          <div className="min-w-0"><h1 className="truncate text-xl font-black">Huéspedes</h1><p className="truncate text-xs text-muted-foreground">Directorio del hotel</p></div>
          <Button className="h-11 shrink-0 rounded-xl px-3" onClick={() => setIsCreateOpen(true)}><Plus className="h-4 w-4" />Nuevo</Button>
        </div>
      ) : <PageHeader
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
      />}

      {isMobile ? (
        <section className="space-y-4" aria-label="Directorio móvil de huéspedes">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={mobileSearch} onChange={(event) => setMobileSearch(event.target.value)} placeholder="Buscar huésped" className="h-11 rounded-xl pl-9" aria-label="Buscar huésped" />
          </div>
          {loading ? <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Cargando huéspedes…</p> : null}
          {guestsError ? <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"><p>No se pudo cargar la lista.</p><Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void refetchGuests()}>Reintentar</Button></div> : null}
          {!loading && !guestsError && mobileGuests.length === 0 ? <p role="status" className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No hay huéspedes que coincidan.</p> : null}
          <div className="divide-y rounded-2xl border border-border bg-card">
            {mobileGuests.map((guest) => (
              <button key={guest.id} type="button" onClick={() => openDetails(guest)} className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">{guest.full_name.charAt(0)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-foreground">{guest.full_name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{guest.email || guest.phone || "Sin contacto registrado"}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <DataTable
          columns={columns}
          data={guests}
          isLoading={loading}
          error={guestsError ? getErrorMessage(guestsError, "No se pudo cargar la lista de huéspedes") : null}
          onRetry={() => { void refetchGuests(); }}
          searchable
          searchPlaceholder="Buscar por nombre o email..."
        />
      )}

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
        onClose={closeDetails}
      />
    </div>
  );
};

export default GuestsPage;
