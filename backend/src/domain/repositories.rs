use crate::domain::models::Room;
use async_trait::async_trait;
use uuid::Uuid; // Importante

#[async_trait] // Esta macro es la clave
pub trait RoomRepository: Send + Sync {
    async fn find_all(&self) -> Result<Vec<Room>, String>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Room>, String>;
}
