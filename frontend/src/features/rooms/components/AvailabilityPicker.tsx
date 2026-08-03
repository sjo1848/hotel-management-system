import React from "react";
import { Calendar as CalendarIcon, Search, X } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type AvailabilityPickerProps = {
  onSearch: (from: string, to: string) => void;
  onClear?: () => void;
};

const AvailabilityPicker = ({ onSearch, onClear }: AvailabilityPickerProps) => {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });

  const handleSearch = () => {
    if (date?.from && date?.to) {
      // Formateamos para que Rust lo entienda (YYYY-MM-DD)
      onSearch(format(date.from, "yyyy-MM-dd"), format(date.to, "yyyy-MM-dd"));
    }
  };

  const handleSelect = (value: DateRange | undefined) => {
    setDate(value);
  };

  const handleClear = () => {
    setDate({ from: undefined, to: undefined });
    onClear?.();
  };
  const nights =
    date?.from && date?.to
      ? Math.max(0, differenceInCalendarDays(date.to, date.from))
      : 0;

  return (
    <div className="flex flex-col md:flex-row items-end gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm mb-10 transition-all hover:shadow-md">
      <div className="grid gap-2 flex-1">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
          Rango de estancia
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full md:w-[400px] justify-start text-left font-medium h-12 rounded-xl border-border bg-muted/50 hover:bg-card transition-colors",
                !date?.from && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-3 h-5 w-5 text-muted-foreground" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "dd LLL", { locale: es })} -{" "}
                    {format(date.to, "dd LLL, y", { locale: es })}
                  </>
                ) : (
                  format(date.from, "dd LLL, y", { locale: es })
                )
              ) : (
                <span className="text-muted-foreground">Seleccionar entrada y salida</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 rounded-2xl shadow-2xl border-border"
            align="start"
          >
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from || new Date()}
              selected={date}
              onSelect={handleSelect}
              numberOfMonths={2}
              locale={es}
              disabled={{ before: new Date() }}
            />
          </PopoverContent>
        </Popover>
        {date?.from && date?.to ? (
          nights > 0 ? (
            <div className="text-xs font-medium text-primary">
              Estancia válida:{" "}
              <span className="font-bold">
                {nights} {nights === 1 ? "noche" : "noches"}
              </span>
            </div>
          ) : (
            <div className="text-xs text-red-500 font-medium">
              La fecha de salida debe ser posterior a la de entrada.
            </div>
          )
        ) : (
          <div className="text-xs text-muted-foreground">
            Seleccioná entrada y salida para ver disponibilidad.
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleClear}
          disabled={!date?.from && !date?.to}
          variant="outline"
          className="h-12 px-4 rounded-xl border-border"
        >
          <X className="w-4 h-4 mr-2" />
          Limpiar
        </Button>
        <Button
          onClick={handleSearch}
          disabled={!date?.from || !date?.to || nights <= 0}
          className="h-12 rounded-xl bg-primary px-8 text-primary-foreground shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          <Search className="w-4 h-4 mr-2" />
          Buscar Habitaciones
        </Button>
      </div>
    </div>
  );
};

export default AvailabilityPicker;
