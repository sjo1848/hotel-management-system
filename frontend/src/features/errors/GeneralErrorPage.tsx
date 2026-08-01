import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const GeneralErrorPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-10 rounded-[2rem] border border-border bg-card/95 p-8 text-center shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex justify-center">
          <div className="flex h-24 w-24 rotate-12 items-center justify-center rounded-3xl border border-rose-500/20 bg-rose-500/10 text-rose-500 shadow-xl shadow-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="w-12 h-12 -rotate-12" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-black text-foreground">
            ¡Oops! Algo salió mal.
          </h1>
          <p className="font-medium text-muted-foreground">
            Se ha producido un error inesperado en el sistema. Nuestros ingenieros ya han sido notificados (metafóricamente).
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Recomendación
          </p>
          <p className="text-xs italic text-muted-foreground">
            Intenta recargar la página o volver a iniciar sesión si el problema persiste.
          </p>
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={() => window.location.reload()}
            className="h-14 rounded-2xl bg-primary px-10 text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 hover:bg-primary/90 active:scale-95"
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
