-- HMS Elite - Renombra el hotel por defecto a "Hotel Viena"
-- Aplica sobre instalaciones ya migradas donde el nombre quedó como "Hotel Sede Central".
UPDATE hotels
SET name = 'Hotel Viena'
WHERE id = '00000000-0000-0000-0000-000000000001' AND name = 'Hotel Sede Central';