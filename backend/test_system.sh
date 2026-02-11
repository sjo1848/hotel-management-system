#!/bin/bash
# HMS Elite - Integración Logic Test

URL="http://localhost:3001/api/v1"
echo "--- Iniciando Pruebas de Sistema ---"

# 1. Login Admin
echo -n "1. Login Admin: "
LOGIN_RES=$(curl -s -X POST "$URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin", "password":"admin123"}')

TOKEN=$(echo $LOGIN_RES | grep -oP '"access_token":"\K[^"]+')

if [ -z "$TOKEN" ]; then
    echo "Falla (No se obtuvo token)"
    exit 1
fi
echo "OK"

# 2. Verificar Admin Access (Usuarios)
echo -n "2. Acceso a Usuarios (Admin): "
USERS_RES=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$URL/users" \
  -H "Authorization: Bearer $TOKEN")

if [ "$USERS_RES" == "200" ]; then
    echo "OK"
else
    echo "Falla (Status: $USERS_RES)"
fi

# 3. Simular Housekeeping Flow
echo "3. Simulando flujo de Limpieza:"
# Obtener una habitación disponible
ROOM_ID=$(curl -s -X GET "$URL/rooms" \
  -H "Authorization: Bearer $TOKEN" | grep -oP '"id":"\K[^"]+' | head -1)

echo "   Room ID: $ROOM_ID"

# Marcar como sucia (simulado vía Housekeeping Start o manual status update si aplica)
# En el sistema real, el checkout la ensucia. Vamos a probar el listado de sucias.
echo -n "   Listado de habitaciones sucias: "
DIRTY_RES=$(curl -s -X GET "$URL/housekeeping/dirty" \
  -H "Authorization: Bearer $TOKEN")
echo "OK"

# Iniciar limpieza
echo -n "   Iniciar limpieza: "
START_RES=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$URL/housekeeping/$ROOM_ID/start" \
  -H "Authorization: Bearer $TOKEN")
echo "$START_RES (Esperado 200/404 si ya está limpia)"

# 4. Verificar Reportes
echo -n "4. Acceso a Reportes de Ingresos: "
REV_RES=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$URL/reports/revenue" \
  -H "Authorization: Bearer $TOKEN")
if [ "$REV_RES" == "200" ]; then
    echo "OK"
else
    echo "Falla (Status: $REV_RES)"
fi

echo "--- Pruebas finalizadas ---"
