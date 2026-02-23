use super::*;

#[path = "ops/bookings.rs"]
mod bookings;
#[path = "ops/finance.rs"]
mod finance;
#[path = "ops/guests_users.rs"]
mod guests_users;
#[path = "ops/hotels.rs"]
mod hotels;
#[path = "ops/housekeeping.rs"]
mod housekeeping;
#[path = "ops/rooms.rs"]
mod rooms;

pub use bookings::{
    add_extra_charge_handler, create_booking_handler, get_invoice_by_booking_handler,
    list_bookings_handler, list_extra_charges_handler, list_invoices_handler,
    update_booking_handler,
};
pub use finance::{close_cash_handler, get_current_balance_handler};
pub use guests_users::{
    create_guest_handler, create_user_handler, delete_user_handler, list_guests_handler,
    list_users_handler,
};
pub use hotels::{create_hotel_handler, get_hotel_network_kpis_handler, list_hotels_handler};
pub use housekeeping::{finish_cleaning_handler, list_dirty_rooms_handler, start_cleaning_handler};
pub use rooms::{
    create_room_handler, get_rooms_handler, search_rooms_handler, update_room_status_handler,
};
