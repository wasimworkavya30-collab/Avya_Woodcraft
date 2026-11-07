# Deploying the app

The app is a three-tier Node service: React build served by Express, data in a SQLite file.
That means it needs a host that runs a long-lived Node process **and** keeps a disk between
restarts. Serverless/edge platforms (Vercel functions, Cloudflare Workers, Netlify functions)
cannot run it as-is: they have no writable file system and no `node:sqlite`.

Geolocation on a real phone also needs **HTTPS**, so the host must serve a TLS URL.

## Option A — Render (fastest path to a public URL)

The repo ships `render.yaml`, so Render can create the service, disk and env vars for you.

1. Push this repository to GitHub (already done on `main`).
2. In Render: **New → Blueprint**, pick `wasimworkavya30-collab/Avya_Woodcraft`, branch `main`.
3. Render reads `render.yaml` and asks for `ADMIN_PASSWORD`. Set a strong password.
4. Apply. The service builds (`npm ci && npm run build`) and starts (`npm start`).
5. Your URL is `https://avya-attendance.onrender.com` (name can be changed). Health check:
   `https://<your-url>/api/health`.

`DATABASE_FILE=/data/avya.db` sits on the mounted disk, so employees, punches and device
pairing survive restarts and redeploys.

## Option B — any Docker host (Railway, Fly.io, Koyeb, a VPS)

```bash
docker build -t avya-attendance .
docker run -d -p 4000:4000 -v avya-data:/data \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e ADMIN_PASSWORD="choose-a-strong-password" \
  -e WORKSHOP_LAT=17.3850 -e WORKSHOP_LNG=78.4867 -e GEOFENCE_METRES=150 \
  avya-attendance
```

On Railway/Fly/Koyeb: connect the repo, it detects the `Dockerfile`, then attach a volume
mounted at `/data` and set the same env vars. Put TLS in front (these hosts do it for you,
or use a reverse proxy such as Caddy/Nginx with Let's Encrypt).

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | Hosts usually inject their own port. |
| `JWT_SECRET` | dev string | **Set this in production.** Long random value. |
| `DATABASE_FILE` | `data/avya.db` | Point at the mounted disk, e.g. `/data/avya.db`. |
| `ADMIN_EMAIL` | `admin@avyawoodcraft.in` | Created on first boot when the DB is empty. |
| `ADMIN_PASSWORD` | `Avya@2026` | **Change it.** |
| `WORKSHOP_LAT` / `WORKSHOP_LNG` | `17.3850` / `78.4867` | The workshop gate centre. |
| `GEOFENCE_METRES` | `150` | Punch radius around the workshop. |
| `SEED_DEMO` | `true` | Sample employees and November records on first boot. Set `false` for real use. |

## Testing the punch gate on a real phone

1. Open the HTTPS URL on the phone — no `http://` or LAN IP, geolocation is blocked there.
2. Sign in as the admin, open **Devices**, press **Generate pairing code**.
3. On the phone sign in as the employee (`AW-101` … `AW-116`, PIN `1234`), open **Today**,
   enter the 6-digit code under *Pair this phone*. Only one phone is authorized at a time;
   pairing a new one revokes the old one.
4. Allow the location permission prompt, take a selfie, then **Check in**.
5. If you are not standing at the workshop coordinates, the punch is rejected with the
   distance shown. Set `WORKSHOP_LAT`/`WORKSHOP_LNG` to your actual site, or tick
   **Practice mode** to send a 42 m location and demo the flow from a desk.
6. Every rejected attempt (unregistered phone, outside the fence) is logged under
   Devices → *Blocked attempts*.

## Data, reset and backup

- **Data & backup** in the admin console exports the whole database as JSON and can restore
  or reset it.
- Fresh demo data: `npm run seed` (local) or restart with an empty `DATABASE_FILE`.
- SQLite keeps its write-ahead log next to the database file — back up the whole `/data`
  directory, not just `avya.db`.
