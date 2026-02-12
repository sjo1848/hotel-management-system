import { useNavigate } from "react-router-dom";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-32 h-32 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shadow-inner">
              <FileQuestion className="w-16 h-16" />
            </div>
            <div className="absolute -top-2 -right-2 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm text-xs font-black text-slate-800 uppercase tracking-widest">
              Error 404
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Página no encontrada
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Parece que la habitación que buscas no existe o el recepcionista se ha perdido por los pasillos.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button 
            onClick={() => navigate("/")}
            className="h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Inicio
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => window.history.back()}
            className="h-12 text-slate-500 hover:text-slate-800"
          >
            Regresar a la página anterior
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
