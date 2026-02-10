import React from "react";
import { Calendar as CalendarIcon, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const AvailabilityPicker = ({ onSearch }) => {
  const [date, setDate] = React.useState({
    from: undefined,
    to: undefined,
  });

  const handleSearch = () => {
    if (date?.from && date?.to) {
      // Formateamos para que Rust lo entienda (YYYY-MM-DD)
      onSearch(format(date.from, "yyyy-MM-dd"), format(date.to, "yyyy-MM-dd"));
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-end gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-10 transition-all hover:shadow-md">
      <div className="grid gap-2 flex-1">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">
          Rango de Estancia
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full md:w-[400px] justify-start text-left font-medium h-12 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white transition-colors",
                !date?.from && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-3 h-5 w-5 text-slate-400" />
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
                <span className="text-slate-400">¿Cuándo vienes?</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 rounded-2xl shadow-2xl border-slate-200"
            align="start"
          >
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
              locale={es}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button
        onClick={handleSearch}
        disabled={!date?.from || !date?.to}
        className="h-12 px-8 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-200 transition-all active:scale-95 disabled:opacity-50"
      >
        <Search className="w-4 h-4 mr-2" />
        Buscar Habitaciones
      </Button>
    </div>
  );
};

export default AvailabilityPicker;
