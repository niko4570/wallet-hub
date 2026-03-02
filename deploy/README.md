# Deploy / Local Docker

This folder contains helper artifacts to run the API and a local Postgres using Docker.

Prereqs

- Docker and docker-compose installed

Quick local run (development/demo)

1. Copy the example envs or set environment variables. For quick local demo the compose file uses a sample `DATABASE_URL`.

2. Build and start services:

```bash
cd deploy
docker compose up --build
```

3. Run Prisma migrations (from project root):

```bash
# Build the builder image and run migrate using the builder stage
docker build -f apps/api/Dockerfile --target builder -t wallethub-api-builder:latest .

docker run --rm \
  -e DATABASE_URL="postgres://wallethub:example@host.docker.internal:5432/wallethub" \
  wallethub-api-builder:latest \
  sh -c "pnpm --filter api exec prisma migrate deploy --schema=apps/api/prisma/schema.prisma"
```

Notes

- Replace `host.docker.internal` if running on Linux host without that DNS; use the docker-network service name (`db`) when executing inside containers.
- For production, push the final image to a registry and run behind a reverse proxy / load balancer. Keep secrets out of repo and use a secrets manager.

Required environment variables (examples):

- `DATABASE_URL` (postgres connection)
- `EXPO_PUBLIC_API_URL` (public API base for mobile)
- `EXPO_PUBLIC_HELIUS_API_KEY` and other 3rd-party keys
- `JWT_SECRET` (if used)
