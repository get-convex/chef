# Docker Compose (optional) — Developer helper

This file provides an optional dev environment that brings up:

- Convex backend (`backend`) on port `3210`
- Convex dashboard (`dashboard`) on port `6791`
- Frontend dev server (`chef-dev`) on port `5173`

## Run locally

```bash

# from repo root
docker compose -f docker-compose.dev.yml up --build
# If you're on Windows or macOS and see missed file changes,
# ensure polling is enabled (already set in compose) and try:
# docker compose -f docker-compose.dev.yml up --build --force-recreate
```