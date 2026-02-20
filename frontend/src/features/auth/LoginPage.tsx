import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "./useAuth";
import { useToast } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();
  const [errorV, setErrorV] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedHotelId = hotelId.trim();
    const normalizedUsername = username.trim();
    if (!normalizedHotelId) {
      setErrorV("Hotel obligatorio.");
      toast({
        title: "Hotel obligatorio",
        description: "Ingresá nombre o ID del hotel.",
        variant: "error",
      });
      return;
    }
    if (!normalizedUsername) {
      setErrorV("Usuario obligatorio.");
      return;
    }
    setLoading(true);
    setErrorV("");
    try {
      await login(normalizedUsername, password, normalizedHotelId);
      // Toast handled by auth context usually, but we can do it here too
      navigate("/", { replace: true });
    } catch (error) {
      setErrorV("Credenciales inválidas");
      toast({
        title: "Error de acceso",
        description: "Usuario o contraseña incorrectos.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-100 text-slate-900 font-sans dark:bg-slate-950 dark:text-slate-200">
      {/* Dynamic Background */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30 transition-transform duration-[20s] hover:scale-105 dark:opacity-40"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2070&auto=format&fit=crop')"
        }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-100 via-slate-100/90 to-slate-200/40 dark:from-slate-950 dark:via-slate-950/90 dark:to-slate-900/50" />

      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-md p-8 mx-4 glass rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-700 motion-fade-up border-t border-white/50 dark:glass-dark dark:border-white/10">

        {/* Header */}
        <div className="mb-10 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-amber-700 mb-4 shadow-lg shadow-amber-900/20">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            HMS <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500">ELITE</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium tracking-wide uppercase">
            Gestión Hotelera Premium
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2 group">
            <Label htmlFor="hotel-id" className="text-slate-700 dark:text-slate-300 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors">Hotel (nombre o ID)</Label>
            <div className="relative transition-all duration-300 group-focus-within:scale-[1.02]">
              <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-500 dark:text-slate-400 group-focus-within:text-secondary transition-colors" />
              <Input
                id="hotel-id"
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value)}
                className="pl-10 bg-white/80 border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-white placeholder:text-slate-500 focus:border-secondary/50 focus:ring-secondary/20 h-12 rounded-xl backdrop-blur-sm dark:bg-white/5 dark:placeholder:text-slate-600"
                placeholder="Ej: Hotel Viena o ad11ca4b-..."
                required
              />
            </div>
          </div>

          <div className="space-y-2 group">
            <Label htmlFor="username" className="text-slate-700 dark:text-slate-300 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors">Usuario Global</Label>
            <div className="relative transition-all duration-300 group-focus-within:scale-[1.02]">
              <User className="absolute left-3 top-3 h-5 w-5 text-slate-500 dark:text-slate-400 group-focus-within:text-secondary transition-colors" />
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10 bg-white/80 border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-white placeholder:text-slate-500 focus:border-secondary/50 focus:ring-secondary/20 h-12 rounded-xl backdrop-blur-sm dark:bg-white/5 dark:placeholder:text-slate-600"
                placeholder="Identificación de usuario"
                required
              />
            </div>
          </div>

          <div className="space-y-2 group">
            <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors">Clave de Acceso</Label>
            <div className="relative transition-all duration-300 group-focus-within:scale-[1.02]">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500 dark:text-slate-400 group-focus-within:text-secondary transition-colors" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-white/80 border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-white placeholder:text-slate-500 focus:border-secondary/50 focus:ring-secondary/20 h-12 rounded-xl backdrop-blur-sm dark:bg-white/5 dark:placeholder:text-slate-600"
                placeholder="••••••••••••"
                required
              />
            </div>
          </div>

          {errorV && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center animate-in slide-in-from-top-2 flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {errorV}
            </div>
          )}

          <Button
            type="submit"
            variant="secondary"
            className="w-full font-bold h-12 text-base shadow-xl shadow-amber-900/10 hover:shadow-amber-900/20 transition-all duration-300"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Validando Credenciales...
              </>
            ) : (
              "Acceder al Sistema"
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Versión 2.0.0 &middot; Infraestructura Segura
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
