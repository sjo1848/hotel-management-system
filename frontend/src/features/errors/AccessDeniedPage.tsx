import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const AccessDeniedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-800/70 p-4">
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-32 h-32 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 shadow-inner">
              <ShieldAlert className="w-16 h-16" />
            </div>
            <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
              Error 403
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Acceso denegado
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Tu rol actual no tiene permisos para ver esta sección.
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
            className="h-12 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Regresar a la página anterior
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedPage;
