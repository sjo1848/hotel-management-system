#!/bin/bash
# HMS Elite - Smoke Test Script
set -e

BASE_URL="http://localhost:3001/api/v1"
COOKIE_FILE="smoke_cookies.txt"

echo "🧪 Iniciando Smoke Test..."

# 1. Health Check
echo -n "[1/5] Verificando salud del sistema... "
STATUS=$(curl -s http://localhost:3001/health | grep -o "operational")
if [ "$STATUS" == "operational" ]; then echo "✅"; else echo "❌"; exit 1; fi

# 2. Login
echo -n "[2/5] Intentando Login (admin)... "
LOGIN_RES=$(curl -s -c $COOKIE_FILE -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d '{"username": "admin", "password": "admin123"}')

if echo "$LOGIN_RES" | grep -q "access_token"; then 
    echo "✅"
else 
    echo "❌"
    echo "Respuesta: $LOGIN_RES"
    exit 1
fi

# 3. Get Me
echo -n "[3/5] Verificando perfil de usuario... "
ME_RES=$(curl -s -b $COOKIE_FILE "$BASE_URL/auth/me")
if echo "$ME_RES" | grep -q "admin"; then echo "✅"; else echo "❌"; exit 1; fi

# 4. List Rooms
echo -n "[4/5] Listando habitaciones... "
ROOMS_RES=$(curl -s -b $COOKIE_FILE "$BASE_URL/rooms")
if echo "$ROOMS_RES" | grep -q "room_number"; then echo "✅"; else echo "❌"; exit 1; fi

# 5. Logout (con CSRF)
echo -n "[5/5] Intentando Logout seguro... "
CSRF_TOKEN=$(grep "csrf_token" $COOKIE_FILE | awk '{print $7}')
LOGOUT_RES=$(curl -s -b $COOKIE_FILE -X POST "$BASE_URL/auth/logout" -H "Content-Type: application/json" -H "x-csrf-token: $CSRF_TOKEN" -d '{}')

if echo "$LOGOUT_RES" | grep -q "ok"; then echo "✅"; else echo "❌"; exit 1; fi

echo -e "\n🎉 SMOKE TEST PASADO EXITOSAMENTE"
rm $COOKIE_FILE
