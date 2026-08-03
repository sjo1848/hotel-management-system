import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import type { Room } from "@/types/domain";
import {
  RoomDetailWorkspace,
} from "./RoomDetailWorkspace";

type RoomAdminSheetProps = {
  room: Room | null;
  open: boolean;
  canManageInventory?: boolean;
  canManageStatus?: boolean;
  canCreateBooking?: boolean;
  onOpenChange: (open: boolean) => void;
  onReserve: (room: Room) => void;
  onSaved: () => Promise<void> | void;
};

const RoomAdminSheet = ({
  room,
  open,
  canManageInventory = false,
  canManageStatus = false,
  canCreateBooking = false,
  onOpenChange,
  onReserve,
  onSaved,
}: RoomAdminSheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="w-full overflow-hidden border-l border-border bg-card p-0 sm:max-w-[640px]">
      <RoomDetailWorkspace
        room={room}
        canManageInventory={canManageInventory}
        canManageStatus={canManageStatus}
        canCreateBooking={canCreateBooking}
        onReserve={onReserve}
        onRequestClose={() => onOpenChange(false)}
        onSaved={onSaved}
      />
    </SheetContent>
  </Sheet>
);

export default RoomAdminSheet;
