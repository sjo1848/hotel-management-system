import { MoreVertical, PencilLine, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RoomStatus } from "@/types/domain";

type RoomActionsMenuProps = {
  status: RoomStatus;
  canEdit?: boolean;
  canChangeStatus?: boolean;
  onViewDetails: () => void;
  onEdit?: () => void;
  onChangeStatus: (status: "AVAILABLE" | "DIRTY") => void;
};

const RoomActionsMenu = ({
  status,
  canEdit = false,
  canChangeStatus = false,
  onViewDetails,
  onEdit,
  onChangeStatus,
}: RoomActionsMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-52">
      <DropdownMenuLabel>Gestion admin</DropdownMenuLabel>
      <DropdownMenuItem onClick={onViewDetails}>
        <Settings2 className="mr-2 h-4 w-4" />
        Ver detalle completo
      </DropdownMenuItem>
      {canEdit && onEdit ? (
        <DropdownMenuItem onClick={onEdit}>
          <PencilLine className="mr-2 h-4 w-4" />
          Editar habitacion
        </DropdownMenuItem>
      ) : null}
      {canChangeStatus ? <DropdownMenuSeparator /> : null}
      {canChangeStatus && status !== "Maintenance" && status !== "Available" ? (
        <DropdownMenuItem onClick={() => onChangeStatus("AVAILABLE")}>
          Marcar disponible
        </DropdownMenuItem>
      ) : null}
      {canChangeStatus && status !== "Maintenance" && status !== "Dirty" && status !== "Cleaning" ? (
        <DropdownMenuItem onClick={() => onChangeStatus("DIRTY")}>
          Enviar a limpieza
        </DropdownMenuItem>
      ) : null}
      {canChangeStatus && status === "Maintenance" ? (
        <DropdownMenuItem disabled>Resolver desde Housekeeping</DropdownMenuItem>
      ) : null}
    </DropdownMenuContent>
  </DropdownMenu>
);

export default RoomActionsMenu;
