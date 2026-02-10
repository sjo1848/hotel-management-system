-- Borramos la tabla de prueba anterior
DROP TABLE IF EXISTS test_connection;

-- Creamos la tabla de Habitaciones
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_number VARCHAR(10) UNIQUE NOT NULL,
    room_type VARCHAR(50) NOT NULL, -- 'Simple', 'Doble', 'Suite'
    status VARCHAR(20) DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'OCCUPIED', 'DIRTY', 'MAINTENANCE'
    price_cents BIGINT NOT NULL, -- Recordá: Centavos para evitar errores
    version INTEGER DEFAULT 1
);

-- Insertamos un par de habitaciones para probar
INSERT INTO rooms (room_number, room_type, price_cents) VALUES
('101', 'Doble Standard', 5000000), -- $50.000,00
('102', 'Doble Standard', 5000000),
('201', 'Suite Ejecutiva', 8500000);


-- Tabla de Reservas
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    guest_name VARCHAR(100) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    total_price_cents BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'CONFIRMED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Validación para que el check_out sea después del check_in
    CONSTRAINT valid_dates CHECK (check_out > check_in)
);

-- Tabla de Huéspedes
CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Backfill: columnas nuevas si ya existe la tabla
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_price_cents BIGINT DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'CONFIRMED';

-- Una reserva de prueba para la habitación 101
INSERT INTO bookings (room_id, guest_name, check_in, check_out)
VALUES (
    (SELECT id FROM rooms WHERE room_number = '101'),
    'John Doe',
    CURRENT_DATE + INTERVAL '1 day',
    CURRENT_DATE + INTERVAL '3 days'
);
