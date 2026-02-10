import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { login } from "./authService";
import { useToast } from "@/components/ui/toast";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await login(username, password);
      localStorage.setItem("hms_token", data.token);
      toast({
        title: "Bienvenido",
        description: "Inicio de sesión correcto.",
        variant: "success",
      });
      navigate("/", { replace: true });
    } catch (error) {
      toast({
        title: "Credenciales inválidas",
        description: String(error),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 app-shell">
      <Card className="w-full max-w-md p-8 border border-slate-200 shadow-lg bg-white">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">HMS Elite</h1>
          <p className="text-sm text-slate-500 mt-1">
            Iniciá sesión para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full bg-slate-900" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ingresando...
              </>
            ) : (
              "Ingresar"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
