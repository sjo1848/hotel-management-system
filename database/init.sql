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
