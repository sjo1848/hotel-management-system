import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "./useAuth";
import { useToast } from "@/components/ui/toast";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();
  const [errorV, setErrorV] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorV("");
    try {
      await login(username, password);
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
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-950 text-slate-200 font-sans">
      {/* Dynamic Background */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 transition-transform duration-[20s] hover:scale-105"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2070&auto=format&fit=crop')"
        }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-slate-900/50" />

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-md p-8 mx-4 glass-dark rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-700 border-t border-white/10">

        {/* Header */}
        <div className="mb-10 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-amber-700 mb-4 shadow-lg shadow-amber-900/20">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
            HMS <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500">ELITE</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">
            Gestión Hotelera Premium
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2 group">
            <Label htmlFor="username" className="text-slate-300 group-focus-within:text-white transition-colors">Usuario Global</Label>
            <div className="relative transition-all duration-300 group-focus-within:scale-[1.02]">
              <User className="absolute left-3 top-3 h-5 w-5 text-slate-500 group-focus-within:text-secondary transition-colors" />
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10 bg-white/5 border-slate-700/50 text-white placeholder:text-slate-600 focus:border-secondary/50 focus:ring-secondary/20 h-12 rounded-xl backdrop-blur-sm"
                placeholder="Identificación de usuario"
                required
              />
            </div>
          </div>

          <div className="space-y-2 group">
            <Label htmlFor="password" className="text-slate-300 group-focus-within:text-white transition-colors">Clave de Acceso</Label>
            <div className="relative transition-all duration-300 group-focus-within:scale-[1.02]">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500 group-focus-within:text-secondary transition-colors" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-white/5 border-slate-700/50 text-white placeholder:text-slate-600 focus:border-secondary/50 focus:ring-secondary/20 h-12 rounded-xl backdrop-blur-sm"
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
          <p className="text-xs text-slate-600">
            Versión 2.0.0 &middot; Infraestructura Segura
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
