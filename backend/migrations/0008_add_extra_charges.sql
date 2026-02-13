-- HMS Elite - Módulo de Cargos Incidentales (Profit Guard)
-- Permite registrar consumos extras para evitar fugas de dinero

CREATE TABLE IF NOT EXISTS extra_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    description VARCHAR(200) NOT NULL,
    amount_cents BIGINT NOT NULL,
    category VARCHAR(50) DEFAULT 'GENERAL', -- MINIBAR, RESTAURANTE, LAVANDERIA, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para carga rápida en la ficha de la reserva
CREATE INDEX IF NOT EXISTS idx_extra_charges_booking ON extra_charges(booking_id);
CREATE INDEX IF NOT EXISTS idx_extra_charges_hotel ON extra_charges(hotel_id);

-- Actualización de Facturas: Añadir desglose si fuera necesario (opcional por ahora)
-- La factura actual se calcula sobre el total_price_cents de la reserva.
-- En el futuro, el total_price_cents de la reserva deberá ser la suma de (habitación * noches) + extras.
