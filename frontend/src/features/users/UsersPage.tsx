import { useMemo, useState } from "react";
import { Plus, Shield, MoreHorizontal, Fingerprint } from "lucide-react";
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

const UsersPage = () => {
  const { toast } = useToast();
  const usersQueryKey = "users:list";
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;
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
      header: "",
      cell: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toast({ title: "Seguridad", description: "La edición de perfiles está restringida." })}>
              Editar Permisos
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => handleDelete(item.id)}
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <PageHeader
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
      />

      <DataTable
        columns={columns}
        data={users}
        isLoading={loading}
        error={usersError ? getErrorMessage(usersError, "No tienes permisos para gestionar usuarios.") : null}
        onRetry={() => {
          void refetchUsers();
        }}
        searchable
        searchPlaceholder="Buscar por nombre de usuario..."
      />

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
