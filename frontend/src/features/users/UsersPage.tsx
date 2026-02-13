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
import { User } from "@/types/domain";
import { useToast } from "@/components/ui/toast";
import UserCreateDrawer from "./components/UserCreateDrawer";
import { invalidateResource, useResourceQuery } from "@/lib/useResourceQuery";
import { getErrorMessage } from "@/api/errors";

const UsersPage = () => {
  const { toast } = useToast();
  const usersQueryKey = "users:list";
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const {
    data: usersData,
    isLoading: loading,
    error: usersError,
    refetch: refetchUsers,
  } = useResourceQuery<User[]>({
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

  const columns: Column<User>[] = [
    {
      header: "Usuario",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900">{item.username}</div>
            <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">ID: {item.id.slice(0, 8)}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Rol del Sistema",
      cell: (item) => (
        <Badge variant={item.role === "admin" ? "info" : "secondary"} className="gap-1">
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
              <MoreHorizontal className="h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toast({ title: "Seguridad", description: "La edición de perfiles está restringida." })}>
              Editar Permisos
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-red-600"
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 rounded-lg shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
              Control de Acceso
            </h2>
          </div>
          <p className="text-slate-500 font-medium mt-2">
            Gestión de operadores y niveles de seguridad (RBAC).
          </p>
        </div>

        <Button 
          className="h-12 rounded-xl bg-slate-900 shadow-xl shadow-slate-200 transition-all active:scale-95 gap-2"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Nuevo Operador
        </Button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
        {usersError && (
          <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
            {getErrorMessage(usersError, "No tienes permisos para gestionar usuarios.")}
          </div>
        )}
        <DataTable
          columns={columns}
          data={users}
          isLoading={loading}
          searchable
          searchPlaceholder="Buscar por nombre de usuario..."
        />
      </div>

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
