#!/bin/sh
set -e

DB_FILE="/app/data/dev.db"
FRESH=false
[ -f "$DB_FILE" ] || FRESH=true

mkdir -p /app/data

echo "Applying database schema..."
npx prisma db push --accept-data-loss

if [ "$FRESH" = true ]; then
  echo "Fresh database — seeding sample data..."
  npm run db:seed
fi

exec "$@"
