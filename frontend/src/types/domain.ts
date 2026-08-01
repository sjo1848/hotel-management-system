/**
 * HMS Elite - Unified Domain Types
 * This file acts as the single source of truth for frontend entities.
 */

export type UserRole = "admin" | "saas_admin" | "ops" | "receptionist" | "housekeeping";
export type TenantUserRole = Exclude<UserRole, "saas_admin">;

export type User = {
  id: string;
  hotel_id: string;
  username: string;
  role: UserRole;
};

export type ManagedUser = Pick<User, "id" | "username"> & {
  role: TenantUserRole;
};

export type RoomStatus = "Available" | "Occupied" | "Dirty" | "Cleaning" | "Maintenance";
export type RoomHoldType =
  | "Vip"
  | "Maintenance"
  | "Owner"
  | "Compliance"
  | "Commercial"
  | "Other";

export type Room = {
  id: string;
  hotel_id: string;
  room_number: string;
  room_type: string;
  status: RoomStatus;
  price_cents: number;
};

export type BulkRoomStatusUpdateResult = {
  room_ids: string[];
  updated_count: number;
  status: RoomStatus;
};

export type RoomHold = {
  id: string;
  hotel_id: string;
  room_id: string;
  start_date: string;
  end_date: string;
  hold_type: RoomHoldType;
  reason: string;
  created_by_user_id: string | null;
  created_at?: string | null;
};

export type RoomHoldBoardEntry = {
  hold_id: string;
  room_id: string;
  room_number: string;
  room_type: string;
  start_date: string;
  end_date: string;
  hold_type: RoomHoldType;
  reason: string;
  created_at?: string | null;
};

export type BookingStatus = "Confirmed" | "Cancelled" | "NoShow" | "CheckedIn" | "CheckedOut";

export type BookingFrontDeskData = {
  check_in_guests_count?: number | null;
  check_in_reference?: string | null;
  check_in_document_verified?: boolean | null;
  check_in_contact_confirmed?: boolean | null;
  check_in_stay_confirmed?: boolean | null;
  checked_in_at?: string | null;
  checked_in_by_user_id?: string | null;
  check_out_payment_policy?: string | null;
  check_out_reference?: string | null;
  check_out_charges_reviewed?: boolean | null;
  check_out_room_release_confirmed?: boolean | null;
  check_out_housekeeping_handoff?: boolean | null;
  checked_out_at?: string | null;
  checked_out_by_user_id?: string | null;
  terminal_reason?: string | null;
  terminal_recorded_at?: string | null;
  terminal_recorded_by_user_id?: string | null;
  late_arrival_eta?: string | null;
  late_arrival_note?: string | null;
  late_arrival_recorded_at?: string | null;
  late_arrival_recorded_by_user_id?: string | null;
};

export type FrontDeskBlocker = {
  kind: string;
  title: string;
  detail: string;
};

export type FrontDeskBoardEntry = {
  booking_id: string;
  room_id: string;
  room_number: string;
  room_type: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  booking_status: BookingStatus;
  room_status: RoomStatus;
  total_price_cents: number;
  operational_data: BookingFrontDeskData;
  blocker?: FrontDeskBlocker | null;
};

export type FrontDeskActionKind = "open-booking" | "prepare-check-in";

export type FrontDeskQueueItem = {
  entry: FrontDeskBoardEntry;
  lane: string;
  title: string;
  detail: string;
  primary_label: string;
  action_kind: FrontDeskActionKind;
};

export type FrontDeskBoard = {
  date: string;
  arrivals_ready: FrontDeskBoardEntry[];
  arrivals_blocked: FrontDeskBoardEntry[];
  departures_today: FrontDeskBoardEntry[];
  in_house: FrontDeskBoardEntry[];
  holds_today: RoomHoldBoardEntry[];
  action_queue: FrontDeskQueueItem[];
};

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
  operational_data: BookingFrontDeskData;
  room?: Room; // Optional populated room info
};

export type HousekeepingBoardRoom = {
  room_id: string;
  room_number: string;
  room_type: string;
  room_status: RoomStatus;
  turnover_today: boolean;
  departure_guest_name?: string | null;
  departure_booking_status?: BookingStatus | null;
  maintenance_case?: MaintenanceCase | null;
};

export type MaintenanceCase = {
  id: string;
  hotel_id: string;
  room_id: string;
  status: "Open" | "Resolved";
  priority: "Low" | "Medium" | "High" | "Urgent";
  reason: string;
  assigned_to: string;
  reported_by_user_id?: string | null;
  reported_at: string;
  resolution_note?: string | null;
  resolved_by_user_id?: string | null;
  resolved_at?: string | null;
  return_status?: "Dirty" | null;
};

export type MarkMaintenanceInput = {
  reason: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigned_to: string;
};

export type ResolveMaintenanceInput = {
  resolution_note: string;
};

export type HousekeepingDeparture = {
  booking_id: string;
  room_id: string;
  room_number: string;
  room_type: string;
  room_status: RoomStatus;
  guest_name: string;
  booking_status: BookingStatus;
};

export type HousekeepingBoard = {
  date: string;
  rooms: HousekeepingBoardRoom[];
  departures_today: HousekeepingDeparture[];
};

export type AuditEvent = {
  id: string;
  hotel_id: string | null;
  user_id: string | null;
  action: string;
  ip_address: string | null;
  created_at: string;
};

export type Guest = {
  id: string;
  hotel_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string | null;
};

export type InvoiceStatus = "PENDING" | "PAID" | "VOIDED";
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER";

export type Invoice = {
  id: string;
  hotel_id: string;
  booking_id: string;
  amount_cents: number;
  paid_amount_cents: number;
  status: InvoiceStatus;
  payment_method: PaymentMethod;
  payment_reference?: string | null;
  paid_at?: string | null;
  created_at: string;
};

export type PaymentEntry = {
  id: string;
  hotel_id: string;
  invoice_id: string;
  booking_id: string;
  amount_cents: number;
  payment_method: PaymentMethod;
  payment_reference?: string | null;
  note?: string | null;
  received_by_user_id?: string | null;
  received_at: string;
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
