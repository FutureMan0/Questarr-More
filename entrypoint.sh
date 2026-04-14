#!/bin/sh
set -e

# PUID / PGID handling (*arr style)
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "---------------------------------------"
echo "  Questarr - Starting container"
echo "  PUID: ${PUID}"
echo "  PGID: ${PGID}"
echo "---------------------------------------"

# Adjust the questarr group GID if it differs from PGID
CURRENT_GID=$(id -g questarr)
if [ "$CURRENT_GID" != "$PGID" ]; then
  echo "Updating questarr group GID from ${CURRENT_GID} to ${PGID}"
  groupmod -o -g "$PGID" questarr
fi

# Adjust the questarr user UID if it differs from PUID
CURRENT_UID=$(id -u questarr)
if [ "$CURRENT_UID" != "$PUID" ]; then
  echo "Updating questarr user UID from ${CURRENT_UID} to ${PUID}"
  usermod -o -u "$PUID" questarr
fi

# Ensure the data directory exists and has proper ownership
mkdir -p /app/data
chown questarr:questarr /app
chown -R questarr:questarr /app/data

# Drop root privileges and run CMD as questarr
exec su-exec questarr "$@"
