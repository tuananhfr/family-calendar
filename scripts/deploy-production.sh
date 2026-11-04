#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# Validate before building or changing the database. Never replace production .env files/keys.
node scripts/check-production-config.mjs
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run build
npm --prefix frontend run build
(cd backend && npm run migration:run)
sudo systemctl restart family-calendar-api family-calendar-worker family-calendar-frontend

# Allow the API and worker to start before checking the public HTTPS deployment.
for attempt in 1 2 3 4 5 6; do
  if node scripts/check-deployment.mjs; then
    exit 0
  fi
  if [[ "$attempt" != 6 ]]; then sleep 5; fi
done
echo 'Deployment verification failed. Inspect systemd/nginx logs before installing on phones.' >&2
exit 1
