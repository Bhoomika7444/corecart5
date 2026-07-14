# Deploying CoreCart

The app is a single Express server that serves both the API (`/api/v1/*`) and
the built React frontend. You can deploy it two ways.

---

## Option 1 — All-in-one on Render (simplest, no CORS at all)

One service serves the frontend **and** the API from the same origin, so the
browser never makes a cross-origin request and CORS can't fail.

**Render → New → Web Service**

| Setting | Value |
| --- | --- |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Environment | `NODE_ENV=production` |

Environment variables (Render dashboard):

- `NODE_ENV=production`
- `GEMINI_API_KEY` — optional (AI text/images). Omit to use free fallbacks.
- `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME` — optional, for a
  Neon/Postgres database (otherwise data lives in `db.json`).
- **Do not set `PORT`** — Render injects it and the server now reads it.

Visit the Render URL. No `VITE_API_BASE_URL`, no `ALLOWED_ORIGINS` needed
because everything is one origin.

---

## Option 2 — Split: frontend on Vercel + backend on Render

### A. Backend on Render

| Setting | Value |
| --- | --- |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |

Environment variables:

- `NODE_ENV=production`
- `ALLOWED_ORIGINS` = your Vercel URL(s), comma-separated and **exact** (scheme
  + host, no trailing slash), e.g. `https://my-store.vercel.app`
- `GEMINI_API_KEY` — optional. `SQL_*` — optional.
- Do not set `PORT`.

Note the backend URL, e.g. `https://corecart-backend.onrender.com`.

### B. Frontend on Vercel

Vercel auto-detects `vercel.json` (Vite build, SPA rewrites). Set one env var
(Production + Preview):

- `VITE_API_BASE_URL` = your Render backend URL (no trailing slash).

Because this is a Vite build-time variable, **redeploy after setting it.**

### Why this fixes the "CORS error"

The frontend calls the API with root-relative paths like `/api/v1/stores`.
In a split deploy those would hit Vercel (which has no backend) and fail.
`VITE_API_BASE_URL` rewrites every `/api/...` call to the Render backend, and
`ALLOWED_ORIGINS` makes the backend return the CORS headers that authorize your
Vercel origin. Set both and the two talk cleanly.

---

## Environment variable reference

| Variable | Where | Required | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | backend | prod only | `production` enables static serving |
| `PORT` | backend | auto | Injected by Render; local defaults to 3000 |
| `ALLOWED_ORIGINS` | backend | split only | Comma-separated allowed frontend origins for CORS |
| `GEMINI_API_KEY` | backend | optional | Real AI text/image generation |
| `SQL_HOST` / `SQL_USER` / `SQL_PASSWORD` / `SQL_DB_NAME` | backend | optional | Postgres/Neon persistence |
| `VITE_API_BASE_URL` | frontend | split only | Backend URL the frontend calls |

## Local development

```bash
npm install
npm run dev   # http://localhost:3000  (frontend + API together)
```

No environment variables are required locally.
