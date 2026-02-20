import { Users, Wifi, Coffee, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Room } from "@/types/domain";

type RoomCardProps = {
  room: Room;
  onBook: () => void;
  disabled?: boolean;
  nights?: number;
};

const RoomCard = ({ room, onBook, disabled = false, nights = 0 }: RoomCardProps) => {
  const pricePerNight = room.price_cents / 100;
  const total = nights > 0 ? pricePerNight * nights : 0;
  
  return (
    <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50 group bg-white dark:bg-slate-900 hover:-translate-y-1 transition-all duration-300">
      <div className="relative h-56 bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <img
          src={`https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000`}
          alt={room.room_type}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <Badge className="absolute top-4 right-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-none font-bold uppercase text-[10px] tracking-widest shadow-lg">
          {room.status}
        </Badge>
        <div className="absolute bottom-4 left-4 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Disponibilidad</p>
          <p className="text-sm font-bold">Confirmada Hoy</p>
        </div>
      </div>

      <CardHeader className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Habs. {room.room_number}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {room.room_type}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tighter">
              ${pricePerNight.toLocaleString("es-AR")}
            </div>
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block -mt-1">/ noche</span>
          </div>
        </div>
        
        {nights > 0 && (
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Estancia {nights} noches</span>
            <span className="text-sm font-black text-slate-900 dark:text-slate-100">${total.toLocaleString("es-AR")}</span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="flex justify-between items-center py-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Users className="w-4 h-4" />
              <span className="text-xs font-bold">2 Pers</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Wifi className="w-4 h-4" />
              <span className="text-xs font-bold">Fibra</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600">
            <Coffee className="w-4 h-4" />
            <span className="text-xs font-bold">Premium</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pb-6">
        <Button
          className={`w-full h-12 text-sm font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 ${
            disabled 
              ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed" 
              : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200"
          }`}
          disabled={disabled}
          onClick={onBook}
        >
          {disabled ? "Seleccionar Fechas" : "Reservar Ahora"}
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default RoomCard;
