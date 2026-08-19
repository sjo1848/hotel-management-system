import { useMemo, useState } from "react";
import { Plus, Shield, MoreHorizontal, Fingerprint, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUsers, deleteUser } from "./usersService";
import { ManagedUser } from "@/types/domain";
import { useToast } from "@/components/ui/toast";
import UserCreateDrawer from "./components/UserCreateDrawer";
import { invalidateResource, useResourceQuery } from "@/lib/useResourceQuery";
import { getErrorMessage } from "@/api/errors";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const UsersPage = () => {
  const { toast } = useToast();
  const usersQueryKey = "users:list";
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingView, setPendingView] = useState<ManagedUser | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ManagedUser | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [mobileSearch, setMobileSearch] = useState("");
  const isMobile = useMediaQuery("(max-width: 767px)");

  const {
    data: usersData,
    isLoading: loading,
    error: usersError,
    refetch: refetchUsers,
  } = useResourceQuery<ManagedUser[]>({
    queryKey: usersQueryKey,
    queryFn: getUsers,
    staleTimeMs: 10_000,
  });
  const users = useMemo(() => usersData ?? [], [usersData]);

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      toast({ title: "Usuario eliminado", variant: "success" });
      invalidateResource(usersQueryKey);
      await refetchUsers();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo eliminar el usuario"),
        variant: "error",
      });
    }
  };

  const mobileUsers = useMemo(() => {
    const query = mobileSearch.trim().toLocaleLowerCase();
    return query ? users.filter((user) => user.username.toLocaleLowerCase().includes(query)) : users;
  }, [mobileSearch, users]);

  const columns: Column<ManagedUser>[] = [
    {
      header: "Usuario",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-foreground">{item.username}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">ID: {item.id.slice(0, 8)}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Rol del Sistema",
      cell: (item) => (
        <Badge
          variant={item.role === "admin" ? "info" : "secondary"}
          className="gap-1"
        >
          <Shield className="w-3 h-3" /> {item.role.toUpperCase()}
        </Badge>
      ),
    },
    {
      header: "Acciones",
      cell: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Acciones de ${item.username}`} className="min-h-[44px] min-w-[44px]">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toast({ title: "Seguridad", description: "La edición de perfiles está restringida." })}>
              Editar Permisos
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => setPendingDelete(item)}
            >
              Eliminar Cuenta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "w-[50px]",
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 md:space-y-8">
      {isMobile ? (
        <div className="flex min-h-11 items-center justify-between gap-3" aria-label="Encabezado de usuarios">
          <div className="min-w-0"><h1 className="truncate text-xl font-black">Usuarios</h1><p className="truncate text-xs text-muted-foreground">Accesos y roles</p></div>
          <Button className="h-11 shrink-0 rounded-xl px-3" onClick={() => setIsCreateOpen(true)}><Plus className="h-4 w-4" />Nuevo</Button>
        </div>
      ) : <PageHeader
        title="Control de Acceso"
        description="Gestión de usuarios tenant y roles operativos (RBAC)."
        icon={<Shield className="h-5 w-5" />}
        actions={
          <Button
            className="h-12 gap-2 rounded-xl bg-primary shadow-xl shadow-primary/15 transition-all active:scale-95"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Nuevo usuario
          </Button>
        }
      />}

      {isMobile ? (
        <section className="space-y-4" aria-label="Usuarios móviles">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={mobileSearch} onChange={(event) => setMobileSearch(event.target.value)} placeholder="Buscar usuario" className="h-11 rounded-xl pl-9" aria-label="Buscar usuario" /></div>
          {loading ? <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Cargando usuarios…</p> : null}
          {usersError ? <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"><p>No se pudieron cargar los usuarios.</p><Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void refetchUsers()}>Reintentar</Button></div> : null}
          {!loading && !usersError && mobileUsers.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No hay usuarios que coincidan.</p> : null}
          <div className="divide-y rounded-2xl border border-border bg-card">
            {!loading && !usersError ? mobileUsers.map((user) => <button key={user.id} type="button" aria-label={`Ver usuario ${user.username}`} onClick={() => { setPendingDelete(null); setConfirmingDelete(false); setPendingView(user); }} className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Fingerprint className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{user.username}</span><span className="mt-1 block text-xs uppercase tracking-wide text-muted-foreground">{user.role}</span></span><MoreHorizontal className="h-5 w-5 text-muted-foreground" /></button>) : null}
          </div>
        </section>
      ) : <DataTable
        columns={columns}
        data={users}
        isLoading={loading}
        error={usersError ? getErrorMessage(usersError, "No tienes permisos para gestionar usuarios.") : null}
        onRetry={() => {
          void refetchUsers();
        }}
        searchable
        searchPlaceholder="Buscar por nombre de usuario..."
      />}

      <Sheet open={Boolean(pendingView)} onOpenChange={(open) => { if (!open) setPendingView(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl p-5">
          <SheetHeader className="text-left"><SheetTitle>{pendingView?.username}</SheetTitle><SheetDescription>Cuenta de acceso y rol del sistema ({pendingView?.role}).</SheetDescription></SheetHeader>
          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rol</p><p className="mt-1 font-semibold">{pendingView?.role}</p><p className="mt-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">ID</p><p className="mt-1 font-mono text-xs">{pendingView?.id}</p></div>
            <Button variant="outline" className="h-11 w-full" onClick={() => toast({ title: "Seguridad", description: "La edición de perfiles está restringida." })}>Editar permisos</Button>
            <Button variant="destructive" className="h-11 w-full" onClick={() => { setPendingDelete(pendingView); setConfirmingDelete(false); setPendingView(null); }}>Eliminar cuenta</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) { setPendingDelete(null); setConfirmingDelete(false); } }}>
        <SheetContent side="bottom" className="rounded-t-3xl p-5">
          <SheetHeader className="text-left"><SheetTitle>{confirmingDelete ? "Confirmar eliminación" : pendingDelete?.username}</SheetTitle><SheetDescription>{confirmingDelete ? `Esta acción quitará el acceso de ${pendingDelete?.username}.` : `Rol actual: ${pendingDelete?.role}. Elegí una acción explícita para esta cuenta.`}</SheetDescription></SheetHeader>
          {confirmingDelete ? <div className="mt-5 grid grid-cols-2 gap-3"><Button variant="outline" className="h-11" onClick={() => setConfirmingDelete(false)}>Volver</Button><Button variant="destructive" className="h-11" onClick={() => { if (pendingDelete) void handleDelete(pendingDelete.id); setPendingDelete(null); setConfirmingDelete(false); }}>Eliminar cuenta</Button></div> : <div className="mt-5 grid gap-3"><Button variant="destructive" className="h-11" onClick={() => setConfirmingDelete(true)}>Eliminar cuenta</Button><Button variant="outline" className="h-11" onClick={() => setPendingDelete(null)}>Cerrar</Button></div>}
        </SheetContent>
      </Sheet>

      <UserCreateDrawer 
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={async () => {
          invalidateResource(usersQueryKey);
          await refetchUsers();
          toast({ title: "Listado actualizado", variant: "success" });
        }}
      />
    </div>
  );
};

export default UsersPage;
