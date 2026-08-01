import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import GuestDetailsSheet from "./GuestDetailsSheet";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("GuestDetailsSheet", () => {
  it("shows only persisted V1 profile claims and identifies deferred CRM fields", () => {
    render(
      <GuestDetailsSheet
        isOpen
        onClose={vi.fn()}
        guest={{
          id: "11111111-1111-1111-1111-111111111111",
          hotel_id: "22222222-2222-2222-2222-222222222222",
          full_name: "Ana Torres",
          email: "ana@example.com",
          phone: "+54 11 5555 0101",
          created_at: "2026-08-01T12:00:00Z",
        }}
      />,
    );

    expect(screen.getByText("Ficha de huésped")).toBeInTheDocument();
    expect(screen.getByText("Datos de contacto disponibles en el contrato V1.")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Torres")).toHaveLength(2);
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("Alcance de la ficha V1")).toBeInTheDocument();
    expect(screen.getByText(/Documento, preferencias e historial consolidado/)).toBeInTheDocument();
    expect(screen.queryByText(/Huésped Verificado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cliente Premium/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Perfil completo/i)).not.toBeInTheDocument();
  });
});
