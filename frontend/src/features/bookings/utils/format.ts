import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export const currency = (value: number) => `$${(value / 100).toLocaleString("es-AR")}`;

export const stayRange = (checkIn: string, checkOut: string) =>
  `${format(parseISO(checkIn), "dd MMM", { locale: es })} al ${format(parseISO(checkOut), "dd MMM", { locale: es })}`;
