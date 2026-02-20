import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const GeneralErrorPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900 p-4">
      <div className="max-w-md w-full text-center space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-red-50 rounded-3xl rotate-12 flex items-center justify-center text-red-500 shadow-xl shadow-red-100">
            <AlertTriangle className="w-12 h-12 -rotate-12" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100">
            ¡Oops! Algo salió mal.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Se ha producido un error inesperado en el sistema. Nuestros ingenieros ya han sido notificados (metafóricamente).
          </p>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest mb-1">
            Recomendación
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 italic">
            Intenta recargar la página o volver a iniciar sesión si el problema persiste.
          </p>
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={() => window.location.reload()}
            className="h-14 px-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-200 transition-all hover:-translate-y-1 active:scale-95"
          >
            <RefreshCcw className="w-5 h-5 mr-3" />
            Recargar Aplicación
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GeneralErrorPage;
