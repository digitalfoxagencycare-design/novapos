# Deployment

Written for a solo founder deploying this alone. Costs are indicative for a small
single-outlet or few-outlet setup as of 2026 and will drift.

---

## What you need to run

| | Requirement | Notes |
|---|---|---|
| **API** | Node 20+, 512MB RAM minimum, 1GB comfortable | One process. See scaling below. |
| **Database** | PostgreSQL 16+ | The only stateful component. Back it up. |
| **POS / KDS / Admin** | Static file hosting | Plain built assets. Any CDN or bucket. |
| **Redis** | Optional | Only needed to run more than one API instance. See scaling. |

There is no message broker, no separate worker, and no object storage. That is
deliberate — every additional moving part is something you would be paged about.

---

## Hosting options

| Option | Roughly | Suits |
|---|---|---|
| **A VPS** (Hetzner, DigitalOcean, a domestic Indian provider) | $6–12/mo | One or a few outlets. Simplest thing that works. Postgres on the same box. |
| **Railway / Render / Fly.io** | $15–30/mo | Managed deploys and backups without learning systemd. |
| **Managed Postgres + a small app host** | $25–60/mo | When you would rather someone else own the backups. |

**Recommendation for a first customer:** a single VPS running the API and Postgres, with the
static apps on any CDN. It is cheaper than a managed database and gives you one machine to
understand. Move Postgres to a managed service when you have enough customers that an hour of
downtime costs more than the price difference.

Latency matters more than it looks: a till in Bengaluru talking to a server in Virginia adds
~250ms to every action a cashier takes. Host in the region you sell to.

---

## First deploy

### 1. Database and roles

```bash
createdb novapos

# Edit the passwords in this file first — it ships with placeholders.
psql novapos -f apps/api/drizzle/manual/roles.sql
psql novapos -c "ALTER ROLE novapos_admin BYPASSRLS;"
```

Two roles, and the difference is the security boundary: `novapos_app` has RLS enforced and
serves all traffic; `novapos_admin` bypasses it and is used only for migrations and the few
cross-tenant paths. See `docs/database.md`.

### 2. Environment

```bash
cp apps/api/.env.example apps/api/.env
```

Fill in:

```bash
DATABASE_URL="postgresql://novapos_app:PASSWORD@host:5432/novapos"
DATABASE_ADMIN_URL="postgresql://novapos_admin:PASSWORD@host:5432/novapos"
JWT_SECRET="$(openssl rand -base64 48)"
NODE_ENV=production
CORS_ORIGINS="https://pos.yourdomain.com,https://admin.yourdomain.com"
```

The API **refuses to boot** if `JWT_SECRET` is missing, still the placeholder, or under 32
characters; if `DATABASE_URL` is unset; or if `CORS_ORIGINS` is unset in production. That is on
purpose — a POS that starts happily with a forgeable token secret is worse than one that will
not start.

> **`DATABASE_URL` must not point at a superuser.** A superuser bypasses row-level security
> unconditionally, which silently disables tenant isolation while everything looks healthy. In
> production the API detects this and refuses to start. Do not work around it.

### 3. Migrate and build

```bash
pnpm install --frozen-lockfile
pnpm build:packages
pnpm --filter @novapos/api db:migrate
pnpm --filter @novapos/api build
pnpm --filter @novapos/pos build      # dist/ contains index.html and kds.html
pnpm --filter @novapos/admin build
```

The migration runner applies the schema, re-applies RLS policies idempotently, then **verifies
coverage and exits non-zero** if any tenant-scoped table lacks a policy. A failed migration is
a failed deploy; do not proceed past it.

### 4. Run

```bash
node apps/api/dist/main.js
```

Behind systemd:

```ini
[Unit]
Description=NovaPOS API
After=network.target postgresql.service

[Service]
Type=simple
User=novapos
WorkingDirectory=/srv/novapos/apps/api
EnvironmentFile=/srv/novapos/apps/api/.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=5
# A POS restarting mid-service is bad; make it come back fast and quietly.
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 5. Reverse proxy

The KDS holds a WebSocket open for a whole service, so the proxy must not time it out.

```nginx
server {
  server_name api.yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # A kitchen screen's socket is idle between orders. Without this it is
    # dropped every 60s and the screen flickers between "Live" and
    # "Reconnecting" all service.
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }
}
```

Serve the POS and admin as static files with `try_files $uri /index.html` — except that the POS
has two entry points, so `/kds.html` must resolve to `kds.html`, not to `index.html`.

---

## Scaling

**Vertical first, and further than you would expect.** One modest VPS handles a single
restaurant comfortably. The database is the bottleneck long before the Node process is.

**Before running a second API instance, read this.** The WebSocket gateway keeps its rooms in
process memory. With two instances, a kitchen screen connected to instance B will not receive a
ticket fired on instance A — silently. Tickets still print, but the screens are wrong, which is
worse than being obviously broken.

The fix is the standard Socket.IO Redis adapter (`@socket.io/redis-adapter`), roughly an hour's
work, and `REDIS_URL` is already in the environment template for it. **Until that is done, run
exactly one API instance.**

The print queue has the same property: it drains inside the API process. Fine for one instance;
with several, jobs are picked up by whichever gets there first, which is harmless but means a
slow printer occupies an API process. Move it to a dedicated worker when that starts to matter.

### Database sizing

Roughly, per order: one `orders` row, a few `order_lines`, one or two `kots` and their lines,
one `payments`, two or three `print_jobs`, and a handful of `audit_logs`. Call it 4–6KB
including indexes.

A busy restaurant doing 300 orders a day writes about 1.8MB/day, or 650MB a year. A 10GB
database covers a decade for a single outlet. This is a small-data problem; do not
over-provision.

The exception is `print_jobs` and `idempotency_records`, which accumulate and carry no long-term
value. See maintenance.

---

## Backups

**This is the most important thing on the page.** A restaurant's bills are its tax records;
losing them is a legal problem, not just an operational one.

```bash
# Nightly, retained 30 days. Run as novapos_admin.
pg_dump --format=custom --file=/backup/novapos-$(date +\%F).dump "$DATABASE_ADMIN_URL"
find /backup -name 'novapos-*.dump' -mtime +30 -delete
```

Three things people skip and regret:

1. **Copy the backup off the machine.** A backup on the same VPS does not survive the VPS.
2. **Restore one.** An untested backup is a hope, not a backup. Restore into a scratch database
   and run the API against it once, before you have customers.
3. **Know your recovery point.** A nightly dump means you can lose a day of bills. For a real
   restaurant that is probably not acceptable — turn on WAL archiving, or use a managed
   Postgres with point-in-time recovery, before you take on paying customers.

---

## Maintenance

**Purge expired idempotency records.** `IdempotencyService.purgeExpired()` exists but nothing
calls it yet. Until it is scheduled, the table grows by about one row per write forever. A daily
cron calling it is the fix.

**Prune completed print jobs.** They hold a full rendered document each.

```sql
DELETE FROM print_jobs WHERE status = 'DONE' AND completed_at < now() - interval '7 days';
```

**Watch `/health/ready`.** It reports database connectivity and latency. Point any uptime
monitor at it. Rising latency is the earliest warning you will get.

**Read the boot log after every deploy.** This line is the one that matters:

```
Database ready — RLS policies on 31 tables, enforcement ACTIVE (role: novapos_app)
```

If it says `INACTIVE`, tenant isolation is off and you must not serve traffic.

---

## Secrets

- `JWT_SECRET` — rotating it signs everyone out. Do it if you suspect exposure; the cost is one
  round of logins, which is much cheaper than the alternative.
- Payment credentials — per-tenant values belong in tenant settings, not the environment. The
  environment values are platform defaults. A tenant using their own merchant account must
  never have the platform's keys used instead; the registry prefers the tenant's, and skips a
  provider entirely when it is unconfigured.
- Never commit `.env`. It is in `.gitignore`; keep it there.

---

## Upgrades

```bash
git pull
pnpm install --frozen-lockfile
pnpm build:packages
pnpm --filter @novapos/api db:migrate     # fails loudly rather than half-applying
pnpm --filter @novapos/api build
systemctl restart novapos-api
```

Migrations run before the new code starts. If one fails, the old process is still serving and
you have lost nothing — which is why the runner exits non-zero rather than continuing.

Take a backup before any migration that drops or renames a column.
