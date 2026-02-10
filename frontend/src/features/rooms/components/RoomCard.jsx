import React from "react";
import { Users, Wifi, Wind, Coffee, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Agregamos onBook a las props
const RoomCard = ({ room, onBook }) => {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all border-slate-200 group">
      <div className="relative h-48 bg-slate-100">
        <img
          src={`https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000`}
          alt={room.room_type}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <Badge className="absolute top-4 right-4 bg-white/90 text-slate-900 hover:bg-white">
          {room.status}
        </Badge>
      </div>

      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold text-slate-800">
              Habitación {room.room_number}
            </CardTitle>
            <p className="text-sm text-slate-500 capitalize">
              {room.room_type}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-slate-900">
              ${(room.price_cents / 100).toLocaleString("es-AR")}
            </span>
            <span className="text-xs text-slate-500 block">/ noche</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex gap-4 text-slate-500 text-sm">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" /> 2
          </div>
          <div className="flex items-center gap-1">
            <Wifi className="w-4 h-4" /> Wifi
          </div>
          <div className="flex items-center gap-1">
            <Wind className="w-4 h-4" /> A/C
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <Button
          className="w-full bg-slate-900 hover:bg-slate-800 group-hover:bg-blue-600 transition-colors"
          onClick={onBook} // <--- ACÁ ESTÁ LA CLAVE
        >
          Reservar Ahora
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default RoomCard;
