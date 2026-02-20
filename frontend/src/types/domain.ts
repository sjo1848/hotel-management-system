/**
 * HMS Elite - Unified Domain Types
 * This file acts as the single source of truth for frontend entities.
 */

export type UserRole = "admin" | "saas_admin" | "ops" | "receptionist" | "housekeeping";

export type User = {
  id: string;
  hotel_id: string;
  username: string;
  role: UserRole;
};

export type RoomStatus = "Available" | "Occupied" | "Dirty" | "Cleaning" | "Maintenance";

export type Room = {
  id: string;
  hotel_id: string;
  room_number: string;
  room_type: string;
  status: RoomStatus;
  price_cents: number;
};

export type BookingStatus = "Confirmed" | "Cancelled" | "CheckedIn" | "CheckedOut";

export type Booking = {
  id: string;
  hotel_id: string;
  room_id: string;
  guest_id: string | null;
  guest_name: string;
  check_in: string; // ISO Date YYYY-MM-DD
  check_out: string; // ISO Date YYYY-MM-DD
  total_price_cents: number;
  status: BookingStatus;
  room?: Room; // Optional populated room info
};

export type Guest = {
  id: string;
  hotel_id: string;
  full_name: string;
  email: string;
  phone?: string;
  created_at?: string;
};

export type InvoiceStatus = "PENDING" | "PAID" | "VOIDED";
export type InvoicePaymentMethod = "CASH" | "CARD" | "TRANSFER";

export type Invoice = {
  id: string;
  hotel_id: string;
  booking_id: string;
  amount_cents: number;
  status: InvoiceStatus;
  payment_method: InvoicePaymentMethod;
  created_at: string;
};

export type ExtraCharge = {
  id: string;
  hotel_id: string;
  booking_id: string;
  description: string;
  amount_cents: number;
  category: string;
  created_at?: string;
};

export type Hotel = {
  id: string;
  name: string;
  address?: string;
};
