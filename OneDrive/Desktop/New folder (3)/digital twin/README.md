# BlueClean

BlueClean is a real-time environmental pollution monitoring platform.

## Features

- Report incidents in under 30 seconds with location, type, description, and photo
- AI-style severity scoring from 0 to 10
- Real-time map updates for all connected clients using Socket.io
- Heatmap toggle for pollution hotspot visualization
- Live filtering by pollution type, severity, status, and search text
- Status workflow: `reported` -> `verified` -> `cleaning` -> `resolved`
- JWT auth with roles: `citizen`, `authority`, `ngo`, `admin`
- Authority-protected status updates via role checks
- Live feed for chronological monitoring and action tracking

## Stack

- Backend: Node.js, Express, Socket.io, MongoDB (Mongoose)
- Frontend: HTML, CSS, JavaScript, Leaflet

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create env file:

   ```bash
   copy .env.example .env
   ```

3. Update `.env` with your MongoDB connection string and `JWT_SECRET`.

4. Start server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5000`

## Deploy (Render + MongoDB Atlas)

1. Push this repository to GitHub.
2. Create a free MongoDB Atlas cluster and copy connection string.
3. In Render, create a **Blueprint** from this repo (it will read `render.yaml`).
4. Set required env vars in Render:
   - `MONGODB_URI` = your Atlas URI
   - `JWT_SECRET` = long random secret
5. Deploy and open your Render URL.

Notes:
- `PORT` is set by Render automatically — do not hardcode it in the dashboard.
- Health check is available at `/api/health`.

### Deploy failed (build exit 254)

Common causes:

1. **Root Directory is `src`** — If logs show `.../project/src/package.json` and ENOENT, Render is building from the wrong folder. Open **Settings** → **Root Directory** and clear it (leave empty) or set it to `.` so it matches the folder that contains `package.json`. The blueprint sets `rootDir: .` in `render.yaml`; sync the blueprint again after pushing.

2. **Nested repo on GitHub** — If logs mention a path like `OneDrive/.../digital twin/package.json`, your repo includes a Windows-style path. Either set **Root Directory** to that exact path inside the repo, or (recommended) move all project files to the repository root and push again.

3. **Missing env vars** — Add `MONGODB_URI` and `JWT_SECRET` under **Environment** for the web service.

4. **Docker fallback** — Create the service with **Docker** instead of Node and use the included `Dockerfile` if native Node builds keep failing.

## API

- `GET /api/reports` - list reports
- `POST /api/reports` - create report (`multipart/form-data`)
- `PATCH /api/reports/:id/status` - update status
- `GET /api/reports/stats/overview` - dashboard statistics
- `POST /api/auth/register` - register user and get token
- `POST /api/auth/login` - login and get token
- `GET /api/auth/me` - current user profile
- `GET /api/health` - health check
