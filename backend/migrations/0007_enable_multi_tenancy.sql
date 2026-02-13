-- HMS Elite - Migración Multi-tenancy
-- Convierte el sistema de hotel único a plataforma multi-hotel

-- 1. Crear tabla de hoteles
CREATE TABLE IF NOT EXISTS hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    address TEXT,
    config_json JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insertar hotel por defecto para migración de datos actuales
INSERT INTO hotels (id, name, address) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Hotel Sede Central', 'Dirección por defecto')
ON CONFLICT DO NOTHING;

-- 3. Añadir columna hotel_id a las tablas existentes (inicialmente opcional)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id);
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id);

-- 4. Asignar todos los registros actuales al hotel por defecto
UPDATE rooms SET hotel_id = '00000000-0000-0000-0000-000000000001' WHERE hotel_id IS NULL;
UPDATE users SET hotel_id = '00000000-0000-0000-0000-000000000001' WHERE hotel_id IS NULL;
UPDATE guests SET hotel_id = '00000000-0000-0000-0000-000000000001' WHERE hotel_id IS NULL;
UPDATE bookings SET hotel_id = '00000000-0000-0000-0000-000000000001' WHERE hotel_id IS NULL;
UPDATE audit_events SET hotel_id = '00000000-0000-0000-0000-000000000001' WHERE hotel_id IS NULL;
UPDATE refresh_tokens SET hotel_id = '00000000-0000-0000-0000-000000000001' WHERE hotel_id IS NULL;
UPDATE invoices SET hotel_id = '00000000-0000-0000-0000-000000000001' WHERE hotel_id IS NULL;

-- 5. Aplicar restricción NOT NULL ahora que los datos están migrados
ALTER TABLE rooms ALTER COLUMN hotel_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN hotel_id SET NOT NULL;
ALTER TABLE guests ALTER COLUMN hotel_id SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN hotel_id SET NOT NULL;
ALTER TABLE audit_events ALTER COLUMN hotel_id SET NOT NULL;
ALTER TABLE refresh_tokens ALTER COLUMN hotel_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN hotel_id SET NOT NULL;

-- 6. Índices para performance multi-tenant
CREATE INDEX IF NOT EXISTS idx_rooms_hotel ON rooms(hotel_id);
CREATE INDEX IF NOT EXISTS idx_users_hotel ON users(hotel_id);
CREATE INDEX IF NOT EXISTS idx_bookings_hotel ON bookings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_guests_hotel ON guests(hotel_id);
