use crate::domain::errors::DomainError;
use crate::domain::models::{Booking, BookingStatus};
use crate::domain::repositories::BookingTransactionRepository;
use chrono::NaiveDate;
use std::sync::Arc;
use uuid::Uuid;

pub struct BookingTransactionService {
    repository: Arc<dyn BookingTransactionRepository>,
}

impl BookingTransactionService {
    pub fn new(repository: Arc<dyn BookingTransactionRepository>) -> Self {
        Self { repository }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn update_booking_transactional(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
        actor_user_id: Option<Uuid>,
        guest_id: Option<Uuid>,
        guest_name: Option<String>,
        check_in: Option<NaiveDate>,
        check_out: Option<NaiveDate>,
        status: Option<BookingStatus>,
    ) -> Result<Booking, DomainError> {
        self.repository
            .update_booking_transactional(
                hotel_id,
                booking_id,
                actor_user_id,
                guest_id,
                guest_name,
                check_in,
                check_out,
                status,
            )
            .await
    }
}
