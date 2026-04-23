# Flight Booking

Full-stack flight booking demo: passengers search flights, pick seats, and pay with Stripe; airline staff manage schedules and bookings; superadmins manage airlines. The backend is a NestJS API with Prisma on PostgreSQL (read/write pools via PgBouncer), Redis, Kafka, Debezium Connect (for CDC), and Elasticsearch for search.

## Stack

| Area | Technology |
|------|------------|
| API | NestJS 11, Swagger UI at `/docs` |
| Database | PostgreSQL 16, Prisma 7 |
| Frontend | React 19, Vite 7, React Router, TanStack Query, Stripe.js |
| Infra (Docker) | Redis, Kafka, Zookeeper, Elasticsearch 8, PgBouncer |

## Features

- **Passengers**: register, log in, search flights, seat selection, Stripe checkout, booking confirmation email (SendGrid when configured).
- **Staff** (`ASSOCIATE`, `SENIOR_ASSOCIATE`): admin dashboard, bookings, flights, routes, and flight detail tooling.
- **Superadmin**: airline management.
- **Search**: Elasticsearch-backed flight search — run the reindex script after seeding or resetting the database.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Docker](https://www.docker.com/) and Docker Compose

## Quick start

1. **Infrastructure** (from the repo root):

   ```bash
   docker compose up -d
   ```

   This starts PostgreSQL (with logical decoding for CDC), PgBouncer on **5433** (write) and **5434** (read), Redis, Kafka, Zookeeper, Debezium Connect on **8083**, and Elasticsearch on **9200**.

2. **Environment**

   ```bash
   cp .env.example .env
   ```

   - Copy the backend-related variables into **`backend/.env`** (same keys as in `.env.example`; URLs should match Docker — write pool `localhost:5433`, read pool `localhost:5434`).
   - Copy the `VITE_*` lines into **`frontend/.env`** (see comments in `.env.example`).

3. **Database** (from `backend/`):

   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   npm run prisma:seed
   npm run prisma:reindex-search
   ```

   Optional: `npm run prisma:seed-airports` for airport data.

4. **Run**

   ```bash
   # Terminal 1 — API (default http://localhost:3001)
   cd backend && npm run start:dev

   # Terminal 2 — SPA (default http://localhost:5173)
   cd frontend && npm install && npm run dev
   ```

5. **Sanity checks**

   - API health: [http://localhost:3001/health](http://localhost:3001/health)
   - OpenAPI: [http://localhost:3001/docs](http://localhost:3001/docs)
   - App: [http://localhost:5173](http://localhost:5173) (CORS allows this Vite dev origin)

## Environment variables

See [`.env.example`](.env.example) for all keys. Use strong, unique values in production (`JWT_SECRET`, Stripe secrets, SendGrid, etc.).

## Optional: Debezium connector

With Docker up, you can register the sample connector (posts to Connect on port 8083):

```bash
bash scripts/register-debezium.sh
```

Connector definition: [`scripts/debezium-connector.json`](scripts/debezium-connector.json).

## Database notes

- **`npx prisma migrate deploy`**: applies existing migrations (good for a fresh clone).
- **`npx prisma migrate dev`**: use when you change `schema.prisma` and need to create a new migration during development.

After `prisma migrate reset` or any operation that wipes or replaces flight/instance data, run **`npm run prisma:reindex-search`** again so search stays in sync.

## Project layout

```
├── backend/              NestJS app (source in backend/src), Prisma schema & migrations
├── frontend/             Vite + React SPA (source in frontend/src)
├── scripts/              Debezium helper (register connector)
├── docker-compose.yml
├── .env.example          Reference for backend + frontend env vars
└── README.md
```

## Scripts (summary)

| Where | Command | Purpose |
|-------|---------|---------|
| `backend` | `npm run start:dev` | API in watch mode |
| `backend` | `npm run build` / `npm run start:prod` | Production build and run |
| `backend` | `npm test` | Unit tests |
| `backend` | `npm run prisma:seed` | Seed database |
| `backend` | `npm run prisma:reindex-search` | Sync Elasticsearch |
| `frontend` | `npm run dev` | Dev server |
| `frontend` | `npm run build` | Production build |
| `frontend` | `npm run preview` | Preview production build locally |

## Payments and webhooks

- Configure Stripe test keys in **`backend/.env`** and **`frontend/.env`** as documented in `.env.example`.
- Webhook endpoint (raw body required — the Nest app enables this for Stripe): **`POST http://localhost:3001/payments/webhook`**
- Set `STRIPE_WEBHOOK_SECRET` to the signing secret from the Stripe CLI or the Dashboard.

## Troubleshooting

- **Search returns nothing**: confirm Elasticsearch is up, then run `npm run prisma:reindex-search` from `backend/`.
- **DB connection errors**: ensure PgBouncer ports **5433**/**5434** match `DATABASE_URL` / `DATABASE_READ_URL` in `backend/.env`.
