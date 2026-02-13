import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BookingDrawer from './BookingDrawer';
import * as bookingService from '../services/bookingService';
import * as guestService from '@/features/guests/services/guestService';

// Mock de servicios
vi.mock('../services/bookingService', () => ({
  createBooking: vi.fn(),
}));

vi.mock('@/features/guests/services/guestService', () => ({
  getGuests: vi.fn().mockResolvedValue([]),
  createGuest: vi.fn().mockResolvedValue({ id: 'new-guest-id' }),
}));

// Mock de Toast
const mockToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock de Radix UI Sheet (para evitar problemas con portales y animaciones en tests)
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetDescription: ({ children }: any) => <div>{children}</div>,
  SheetFooter: ({ children }: any) => <div>{children}</div>,
}));

describe('BookingDrawer Integration', () => {
  const mockRoom: any = {
    id: 'room-1',
    room_number: '101',
    room_type: 'Single',
    price_cents: 5000,
    status: 'Available',
  };

  const mockDates = {
    from: '2026-03-01',
    to: '2026-03-03',
  };

  const defaultProps = {
    room: mockRoom,
    dates: mockDates,
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete the full booking flow successfully', async () => {
    render(<BookingDrawer {...defaultProps} />);

    // --- PASO 1: RESUMEN ---
    expect(screen.getByText(/Resumen de Estancia/i)).toBeDefined();
    expect(screen.getByText('2026-03-01')).toBeDefined();
    
    // Click en Siguiente
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));

    // --- PASO 2: DATOS DEL HUÉSPED ---
    await waitFor(() => {
      expect(screen.getByText(/Datos del Huésped/i)).toBeDefined();
    });

    const nameInput = screen.getByLabelText(/Nombre Completo/i);
    const emailInput = screen.getByLabelText(/Email/i);

    fireEvent.change(nameInput, { target: { value: 'Juan Pérez' } });
    fireEvent.change(emailInput, { target: { value: 'juan@example.com' } });

    // Click en Siguiente
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));

    // --- PASO 3: CONFIRMACIÓN ---
    await waitFor(() => {
      expect(screen.getByText(/Confirmar Reserva/i)).toBeDefined();
      expect(screen.getByText(/Juan Pérez/i)).toBeDefined();
    });

    // Mock exitoso de la reserva
    (bookingService.createBooking as any).mockResolvedValue({ id: 'booking-1' });

    // Click en Confirmar y Reservar
    fireEvent.click(screen.getByRole('button', { name: /Confirmar y Reservar/i }));

    // Verificar resultado
    await waitFor(() => {
      expect(bookingService.createBooking).toHaveBeenCalledWith(expect.objectContaining({
        room_id: 'room-1',
        guest_name: 'Juan Pérez',
        check_in: '2026-03-01',
        check_out: '2026-03-03',
      }));
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'success',
        title: 'Reserva confirmada',
      }));
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it('should allow going back between steps', async () => {
    render(<BookingDrawer {...defaultProps} />);
    await waitFor(() => {
      expect(guestService.getGuests).toHaveBeenCalled();
    });

    // Paso 1 -> 2
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Resumen de Estancia/i)).toBeNull();
    });

    // Paso 2 -> 1 (Atrás)
    fireEvent.click(screen.getByRole('button', { name: /Atrás/i }));
    await waitFor(() => {
      expect(screen.getByText(/Resumen de Estancia/i)).toBeDefined();
    });
  });
});
