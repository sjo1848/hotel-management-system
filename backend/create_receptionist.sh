#!/bin/bash
URL="http://localhost:3000/api/v1"
COOKIE_FILE="cookies.txt"

echo "1. Logueando como admin..."
# Login y guardar cookies
LOGIN_RES=$(curl -s -c "$COOKIE_FILE" -X POST "$URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin", "password":"admin123"}')

TOKEN=$(echo $LOGIN_RES | grep -oP '"access_token":"\K[^"]+')
if [ -z "$TOKEN" ]; then
    echo "Error: Login fallido"
    exit 1
fi

# Extraer el token CSRF de la cookie
CSRF_TOKEN=$(grep "csrf_token" "$COOKIE_FILE" | awk '{print $7}')
echo "Token CSRF obtenido: $CSRF_TOKEN"

echo "2. Creando usuario receptionist..."
CREATE_RES=$(curl -s -b "$COOKIE_FILE" -X POST "$URL/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"receptionist", "password":"receptionist123", "role":"receptionist"}')

echo "Respuesta: $CREATE_RES"

if [[ "$CREATE_RES" == *"receptionist"* ]]; then
    echo "¡Usuario receptionist creado con éxito!"
else
    echo "Falla al crear usuario."
fi

# Limpieza
rm "$COOKIE_FILE"
