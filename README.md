# CHRONO//BREACH V2

Single-file HTML/canvas game with an optional TypeScript/Express cloud API for anonymous pilot profiles, recoverable cloud saves, and global score and Titan Champion leaderboards.

## Local setup

1. Install Node.js 20+ and create a PostgreSQL database.
2. Run `npm --prefix server install`.
3. Copy `server/.env.example` to `server/.env`, then set `DATABASE_URL`, two different random peppers, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `CORS_ORIGINS=http://localhost:8080`.
4. Set `window.CHRONO_API_URL = 'http://localhost:3000'` in `config.js`.
5. Start the API with `npm --prefix server run dev` and serve this directory with any static HTTP server on port 8080.

The game remains fully playable from local storage when the API is unavailable. Cloud writes are stored in a browser outbox and replayed after connectivity returns.

## Render + Neon

1. Create a free Neon Postgres project and copy its pooled connection URL.
2. Create a Render Blueprint from this repository; `render.yaml` configures the free API service under `server/`.
3. Set `DATABASE_URL` to the Neon URL, choose a strong `ADMIN_PASSWORD`, and set `CORS_ORIGINS` to the final Vercel origin. Keep generated secrets stable or existing credentials will be invalidated.
4. Deploy. Startup applies the SQL migrations in `server/drizzle/` before listening, and `/health` verifies database connectivity.

## Vercel

1. Put the deployed Render URL in `config.js`, without a trailing slash.
2. Import this repository into Vercel as a static project. `vercel.json` contains the required static configuration.
3. After Vercel assigns its production URL, ensure that exact origin is present in Render's `CORS_ORIGINS` and redeploy the API.

Never put `DATABASE_URL`, `SESSION_PEPPER`, or `RECOVERY_PEPPER` in `config.js` or Vercel.

## Admin CMS

Open `https://YOUR-SERVICE.onrender.com/admin` and sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`. The Render-hosted console can:

- Search and inspect cloud pilot accounts and recent runs.
- Add or remove credits, Chrono Shards, and Titan Cores with a required reason.
- Change callsigns, unlocked sectors, Titan Core status, suspension, and leaderboard visibility.
- Revoke all active sessions for a pilot.
- Publish, unpublish, and categorize live in-game announcements.
- Review an immutable audit trail of administrator actions.

Admin economy/progression changes increment the profile revision. Stale offline saves are rejected in favor of the administrator-updated cloud profile, preventing grants from being overwritten when a player reconnects.

## Verify

```bash
npm --prefix server test
npm --prefix server audit --omit=dev
```

Set `TEST_DATABASE_URL` to a disposable Postgres database to enable the API integration suite. Without it, database-destructive integration tests are skipped.
