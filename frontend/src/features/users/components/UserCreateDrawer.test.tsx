import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UserCreateDrawer from "./UserCreateDrawer";
import { createUser } from "../usersService";

vi.mock("../usersService", () => ({
  createUser: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("UserCreateDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createUser).mockResolvedValue({
      id: "user-1",
      username: "recepcion_noche",
      role: "receptionist",
    });
  });

  it("offers all tenant roles, excludes SaaS admin, and submits the selected role", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<UserCreateDrawer isOpen onClose={onClose} onSuccess={onSuccess} />);

    expect(screen.getByRole("button", { name: /Recepción/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Operaciones/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Housekeeping/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Administrador/i })).toBeInTheDocument();
    expect(screen.queryByText(/saas admin/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nombre de Usuario/i), {
      target: { value: "recepcion_noche" },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña Temporal/i), {
      target: { value: "temporary-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Recepción/i }));
    fireEvent.click(screen.getByRole("button", { name: /Registrar usuario/i }));

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith({
        username: "recepcion_noche",
        password: "temporary-password",
        role: "receptionist",
      }),
    );
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
