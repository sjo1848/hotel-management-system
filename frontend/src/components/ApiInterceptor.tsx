import { useEffect } from "react";
import { setGlobalErrorHandler } from "@/api/client";
import { useToast } from "@/components/ui/toast";

export const ApiInterceptor = () => {
  const { toast } = useToast();

  useEffect(() => {
    setGlobalErrorHandler((message, status) => {
      toast({
        title: status ? `Error ${status}` : "Error del Sistema",
        description: message,
        variant: "error",
      });
    });

    return () => {
      setGlobalErrorHandler(() => {});
    };
  }, [toast]);

  return null;
};
