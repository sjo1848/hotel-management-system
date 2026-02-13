use crate::domain::models::*;
use crate::infrastructure::web::handlers::*;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        get_rooms_handler,
        create_room_handler,
        create_booking_handler,
        login_handler,
        track_ui_telemetry_handler,
        get_dashboard_kpis_handler,
        list_dirty_rooms_handler,
        start_cleaning_handler,
        finish_cleaning_handler,
        get_revenue_report_handler,
        get_occupancy_report_handler,
    ),
    components(
        schemas(
            Room, RoomStatus, Booking, BookingStatus, Guest, User, AuditEvent,
            DashboardKpis, BookingAlert, Invoice, InvoiceStatus,
            CreateBookingRequest, CreateGuestRequest, CreateRoomRequest, LoginRequest, LoginResponse,
            UiTelemetryEventRequest,
            RevenueReport, OccupancyReport,
        )
    ),
    tags(
        (name = "Hotelería", description = "Gestión de habitaciones y servicios"),
        (name = "Reservas", description = "Control de estancias y huéspedes"),
        (name = "Autenticación", description = "Seguridad y sesiones"),
        (name = "Análisis", description = "KPIs y métricas de negocio"),
        (name = "Housekeeping", description = "Gestión de limpieza y mantenimiento")
    )
)]
pub struct ApiDoc;
