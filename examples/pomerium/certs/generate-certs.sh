#!/usr/bin/env bash
set -euo pipefail

# Generates a self-signed TLS cert for this example's Pomerium instance,
# covering dashboard.localhost and authenticate.localhost. Pomerium always
# terminates TLS (see README.md for why this example doesn't disable it), so
# something has to hand it a cert — a real deployment would use Let's
# Encrypt/autocert or an operator-supplied cert instead.
#
# Run once before `docker compose up`. Browsers will show a one-time
# untrusted-certificate warning for this cert; that's expected for a local demo.

cd "$(dirname "${BASH_SOURCE[0]}")"

openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes \
  -keyout key.pem -out cert.pem \
  -subj "/CN=dashboard.localhost" \
  -addext "subjectAltName=DNS:dashboard.localhost,DNS:authenticate.localhost"

echo "Wrote $(pwd)/cert.pem and $(pwd)/key.pem"
