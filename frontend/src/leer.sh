#!/bin/bash

DIR="$1"

if [ -z "$DIR" ]; then
  echo "Uso: $0 /home/sjo1848/dev/hms-elite/frontend/src"
  exit 1
fi

find "$DIR" \
  -type d \( -name node_modules -o -name dist -o -name build -o -name .git \) -prune -o \
  -type f \
  ! -name "*.png" \
  ! -name "*.jpg" \
  ! -name "*.jpeg" \
  ! -name "*.gif" \
  ! -name "*.ico" \
  ! -name "*.pdf" \
  -print | while read -r file; do

  echo ""
  echo "========== $file =========="
  cat "$file"
done

