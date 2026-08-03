import { DollarSign, DoorOpen, Type } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RoomFormValues = {
  room_number: string;
  room_type: string;
  price: string;
};

type RoomFormFieldsProps = {
  values: RoomFormValues;
  onChange: (values: RoomFormValues) => void;
};

const RoomFormFields = ({ values, onChange }: RoomFormFieldsProps) => (
  <div className="space-y-4">
    <div className="grid gap-2">
      <Label htmlFor="room_number" className="flex items-center gap-2">
        <Type className="h-4 w-4 text-muted-foreground" />
        Numero de habitacion
      </Label>
      <Input
        id="room_number"
        placeholder="Ej: 101, A-202..."
        value={values.room_number}
        onChange={(event) => onChange({ ...values, room_number: event.target.value })}
        className="bg-muted border-border focus:bg-card transition-colors"
        required
      />
    </div>

    <div className="grid gap-2">
      <Label htmlFor="room_type" className="flex items-center gap-2">
        <DoorOpen className="h-4 w-4 text-muted-foreground" />
        Tipo de habitacion
      </Label>
      <Input
        id="room_type"
        placeholder="Ej: Standard, Suite, Deluxe..."
        value={values.room_type}
        onChange={(event) => onChange({ ...values, room_type: event.target.value })}
        className="bg-muted border-border focus:bg-card transition-colors"
        required
      />
    </div>

    <div className="grid gap-2">
      <Label htmlFor="room_price" className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        Precio por noche
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <Input
          id="room_price"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={values.price}
          onChange={(event) => onChange({ ...values, price: event.target.value })}
          className="bg-muted border-border focus:bg-card transition-colors pl-7"
          required
        />
      </div>
    </div>
  </div>
);

export default RoomFormFields;
