import { useNavigate } from "react-router-dom";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-8 rounded-[2rem] border border-border bg-card/95 p-8 text-center shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-500">
        <div className="flex justify-center">
          <div className="relative">
            <div className="flex h-32 w-32 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary shadow-inner">
              <FileQuestion className="w-16 h-16" />
            </div>
            <div className="absolute -right-2 -top-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-black uppercase tracking-widest text-foreground shadow-sm">
              Error 404
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Página no encontrada
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Parece que la habitación que buscas no existe o el recepcionista se ha perdido por los pasillos.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button 
            onClick={() => navigate("/")}
            className="h-12 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Inicio
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => window.history.back()}
            className="h-12 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            Regresar a la página anterior
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
