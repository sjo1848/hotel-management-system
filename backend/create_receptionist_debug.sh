#!/bin/bash
URL="http://localhost:3001/api/v1"
COOKIE_FILE="cookies_debug.txt"

echo "--- HMS Debug User Creation ---"

echo "1. Intentando login..."
LOGIN_RES=$(curl -s -v -c "$COOKIE_FILE" -X POST "$URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin", "password":"admin123"}' 2> login_debug.log)

TOKEN=$(echo $LOGIN_RES | grep -oP '"access_token":"\K[^"]+')
if [ -z "$TOKEN" ]; then
    echo "ERROR: No se pudo obtener el JWT."
    cat login_debug.log
    exit 1
fi
echo "JWT obtenido con éxito."

CSRF_TOKEN=$(grep "csrf_token" "$COOKIE_FILE" | awk '{print $7}')
if [ -z "$CSRF_TOKEN" ]; then
    echo "ERROR: No se encontró cookie csrf_token."
    cat "$COOKIE_FILE"
    exit 1
fi
echo "CSRF Token: $CSRF_TOKEN"

echo "2. Creando usuario..."
CREATE_RES=$(curl -s -v -b "$COOKIE_FILE" -X POST "$URL/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"receptionist", "password":"receptionist123", "role":"receptionist"}' 2> create_debug.log)

echo "Response Body: $CREATE_RES"
echo "--- Detalle de la petición (Headers) ---"
cat create_debug.log | grep ">"

if [[ "$CREATE_RES" == *"receptionist"* ]] || [[ "$CREATE_RES" == *"ALREADY_EXISTS"* ]]; then
    echo "RESULTADO: OK (Creado o ya existía)"
else
    echo "RESULTADO: FALLO"
fi

rm "$COOKIE_FILE"
