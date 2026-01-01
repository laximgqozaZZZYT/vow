vow - backend

This folder contains a minimal Express + Prisma backend for the VOW frontend.

Quick start (dev):

1. cd backend
2. npm install
3. cp .env.example .env
3. npx prisma generate
4. npx prisma migrate dev --name init
5. npm run dev

Notes:
- Local dev uses MySQL via `docker-compose.yml`. Credentials/ports are configured via `.env` (see `.env.example`).
- The Prisma schema uses Json fields for flexible structures such as timings/outdates/reminders to allow future schema changes without immediate migrations.
- API endpoints (HTTP)
  - GET /goals
  - GET /goals/:id
  - POST /goals
  - PATCH /goals/:id
  - DELETE /goals/:id
  - GET /habits
  - GET /habits/:id
  - POST /habits
  - PATCH /habits/:id
  - DELETE /habits/:id
  - GET /activities
  - POST /activities
  - PATCH /activities/:id
  - DELETE /activities/:id
  - GET /prefs
  - POST /prefs

Schema evolution guidance:
- Use Json fields for frequently-changing nested objects (timings/outdates/reminders). This allows instant front-end changes without schema migrations.
- For structural changes to core columns, add new optional columns and backfill using a migration script. Keep old fields for backward compatibility and deprecate over several releases.
- Use DB migrations (Prisma Migrate) and keep a changelog for the API versions.

