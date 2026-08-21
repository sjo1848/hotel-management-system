import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import BookingCaseWorkspace, {
  type BookingCaseWorkspaceProps,
} from "./BookingCaseWorkspace";

interface BookingDetailsSheetProps
  extends Omit<BookingCaseWorkspaceProps, "isOpen"> {
  isOpen: boolean;
}

const BookingDetailsSheet = ({
  booking,
  isOpen,
  onClose,
  ...workspaceProps
}: BookingDetailsSheetProps) => (
  <Sheet open={isOpen} onOpenChange={onClose}>
    <SheetContent
      aria-labelledby="booking-case-sheet-title"
      hideCloseButton
      className="w-full overflow-hidden border-l border-border bg-card p-0 sm:max-w-[760px]"
    >
      <SheetTitle className="sr-only">Caso de reserva de {booking?.guest_name ?? "huésped"}</SheetTitle>
      <SheetDescription className="sr-only">
        Gestión operativa de la reserva, estadía, cuenta e historial.
      </SheetDescription>
      <div className="flex min-h-0 flex-1 flex-col">
        <BookingCaseWorkspace
          booking={booking}
          isOpen={isOpen}
          onClose={onClose}
          showHeaderClose
          titleId="booking-case-sheet-title"
          {...workspaceProps}
        />
      </div>
    </SheetContent>
  </Sheet>
);

export default BookingDetailsSheet;
