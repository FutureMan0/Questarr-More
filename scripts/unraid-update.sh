#!/bin/sh
# Questarr More — auf Unraid: Git aktualisieren, Image neu bauen, Container per Compose neu erstellen.
#
# Nutzung:
#   cd ~/questarr-more
#   sh scripts/unraid-update.sh
#
# Umgebungsvariablen (optional):
#   QUESTARR_REPO     — Pfad zum Git-Checkout (Default: aktuelles Verzeichnis)
#   QUESTARR_COMPOSE  — Compose-Datei (Default: docker-compose.unraid.yml)
#   FORCE_BUILD=1     — Immer bauen, auch ohne neue Commits
#
# Voraussetzung: Container wird mit docker-compose.unraid.yml betrieben (nicht paralleler
# Unraid-Template-Container auf denselben Ports — sonst Port-Konflikt).

set -eu

REPO_DIR="${QUESTARR_REPO:-$(pwd)}"
COMPOSE_REL="${QUESTARR_COMPOSE:-docker-compose.unraid.yml}"

cd "$REPO_DIR"

if ! test -f "$COMPOSE_REL"; then
  echo "Compose-Datei nicht gefunden: $REPO_DIR/$COMPOSE_REL" >&2
  exit 1
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Kein Git-Repository in $REPO_DIR" >&2
  exit 1
fi

git fetch origin
BEFORE=$(git rev-parse HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if git rev-parse --verify "@{u}" >/dev/null 2>&1; then
  git pull --ff-only || git pull
else
  echo "Hinweis: Kein Upstream-Branch gesetzt. Setze z. B.: git branch --set-upstream-to=origin/$BRANCH $BRANCH" >&2
  git pull || true
fi

AFTER=$(git rev-parse HEAD)

if test "$BEFORE" = "$AFTER" && test "${FORCE_BUILD:-0}" != "1"; then
  echo "Bereits aktuell ($AFTER), kein Build."
  exit 0
fi

echo "Stand: $BEFORE -> $AFTER"
docker compose -f "$COMPOSE_REL" build
docker compose -f "$COMPOSE_REL" up -d --force-recreate

echo "Fertig. Container neu gestartet."
