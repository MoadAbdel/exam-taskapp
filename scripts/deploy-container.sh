#!/usr/bin/env bash
# Deploie l'environnement CONTENEURISE sur Vercel : l'API tourne dans l'image construite depuis backend/Dockerfile.
# Vercel ne lit que vercel.json : on deploie une copie ou vercel.container.json prend ce nom.
# Prerequis : vercel connecte, VERCEL_ORG_ID et VERCEL_PROJECT_ID du projet exam-taskapp-conteneur.
# Variables du projet : MONGO_URI, JWT_SECRET, NODE_ENV, APP_ENV=conteneur, LOG_TO_FILE=false, PORT=80.
# Usage : bash scripts/deploy-container.sh
set -euo pipefail
: "${VERCEL_ORG_ID:?}" "${VERCEL_PROJECT_ID:?}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT
(cd "$SRC" && tar --exclude=node_modules --exclude=dist --exclude=coverage --exclude=logs --exclude='.env*' \
  -cf - backend frontend vercel.container.json) | tar -xf - -C "$DIR"
mv "$DIR/vercel.container.json" "$DIR/vercel.json"
cd "$DIR"
vercel deploy --prod --yes
bash "$SRC/scripts/smoke-test.sh" https://exam-taskapp-conteneur.vercel.app
