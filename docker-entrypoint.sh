#!/usr/bin/env sh
# Generate a self-signed certificate when none is mounted, so nginx can start
# without manual cert setup. Replace with a real certificate for production.
set -e

CERT_DIR=/etc/nginx/certs

if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  echo "[nginx-init] No certificate found in $CERT_DIR — generating self-signed fallback."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out  "$CERT_DIR/fullchain.pem" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=IP:127.0.0.1"
  echo "[nginx-init] Self-signed certificate created (expires in 10 years)."
  echo "[nginx-init] Replace with a real certificate before exposing to the internet."
fi

exec "$@"
