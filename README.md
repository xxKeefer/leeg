# App Template

Full-stack app template with Vue frontend, Hono backend, PostgreSQL, and container-based deployment to GHCR.

## Create a New Project

1. Click **Use this template** on the GitHub repo page
2. Clone your new repo:

```bash
git clone git@github.com:YOUR_USER/YOUR_APP.git
cd YOUR_APP
```

3. Update `name` in the root `package.json`, `frontend/package.json`, and `backend/package.json`
4. Update `IMAGE_PREFIX` in `.github/workflows/ci.yml` to match your new repo

## Local Development

### Prerequisites

- Node.js 22+
- pnpm (enabled via corepack)
- PostgreSQL 16+ (or use the compose stack)

### Setup

```bash
corepack enable pnpm
pnpm install
```

### Environment

Copy the example env file and adjust as needed:

```bash
cp .env.example .env
```

Default values in `.env.example`:

| Variable       | Default                                             | Purpose                            |
| -------------- | --------------------------------------------------- | ---------------------------------- |
| `PORT`         | `3000`                                              | Backend listen port                |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/app` | PostgreSQL connection string       |
| `JWT_SECRET`   | `change-me-in-production`                           | JWT signing secret                 |
| `FE_PORT`      | `5173`                                              | Host port for frontend container   |
| `BE_PORT`      | `3000`                                              | Host port for backend container    |
| `DB_PORT`      | `5432`                                              | Host port for PostgreSQL container |
| `DB_USER`      | `postgres`                                          | PostgreSQL user                    |
| `DB_PASSWORD`  | `postgres`                                          | PostgreSQL password                |
| `DB_NAME`      | `app`                                               | PostgreSQL database name           |

### Run

```bash
# Start both frontend and backend in dev mode
pnpm dev

# Or individually
pnpm dev:frontend
pnpm dev:backend
```

### Database Migrations

Migrations live in `backend/drizzle/`. To run them:

```bash
cd backend
pnpm drizzle-kit migrate
```

## Deployment

### Server Directory Layout

Each app gets its own directory under the `deploy` user's home:

```
/home/deploy/
  apps/
    YOUR_APP/
      compose.yaml    # production compose file (uses GHCR images)
      .env            # production env vars (ports, secrets, db creds)
    another-app/
      compose.yaml
      .env
```

Create the directory for a new app:

```bash
ssh deploy@YOUR_SERVER
mkdir -p ~/apps/YOUR_APP
```

All `docker compose` commands for this app run from `~/apps/YOUR_APP/`.

### Pull Images from GHCR

On every push to `main`, CI builds and pushes container images to GHCR. On your server:

```bash
# Authenticate to GHCR (one-time)
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_USER --password-stdin

# Pull the latest images
docker pull ghcr.io/YOUR_USER/YOUR_APP/frontend:latest
docker pull ghcr.io/YOUR_USER/YOUR_APP/backend:latest
```

### Run with Compose

Create `~/apps/YOUR_APP/compose.yaml` with GHCR images instead of local builds:

```yaml
services:
  frontend:
    image: ghcr.io/YOUR_USER/YOUR_APP/frontend:latest
    ports:
      - "${FE_PORT:-8080}:80"
    depends_on:
      - backend

  backend:
    image: ghcr.io/YOUR_USER/YOUR_APP/backend:latest
    ports:
      - "${BE_PORT:-3001}:3000"
    environment:
      DATABASE_URL: "postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@db:5432/${DB_NAME:-app}"
      JWT_SECRET: "${JWT_SECRET}"
      PORT: "3000"
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    ports:
      - "${DB_PORT:-5433}:5432"
    environment:
      POSTGRES_USER: "${DB_USER:-postgres}"
      POSTGRES_PASSWORD: "${DB_PASSWORD:-postgres}"
      POSTGRES_DB: "${DB_NAME:-app}"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

```bash
cd ~/apps/YOUR_APP

# Create .env with production values
cat > .env << 'EOF'
FE_PORT=8080
BE_PORT=3001
DB_PORT=5433
DB_USER=myapp
DB_PASSWORD=STRONG_PASSWORD_HERE
DB_NAME=myapp
JWT_SECRET=STRONG_SECRET_HERE
EOF

docker compose up -d
```

## Port Configuration

Each app instance on the server needs unique host ports. The container-internal ports stay the same -- only the host-side mappings change.

| App       | `FE_PORT` | `BE_PORT` | `DB_PORT` |
| --------- | --------- | --------- | --------- |
| app-one   | 8080      | 3001      | 5433      |
| app-two   | 8081      | 3002      | 5434      |
| app-three | 8082      | 3003      | 5435      |

Set these in each app's `.env` file (e.g. `~/apps/app-one/.env`, `~/apps/app-two/.env`).

## Nginx Site Config

Add a site config for each app's subdomain. Replace `YOUR_APP` and port values:

```nginx
# /etc/nginx/sites-available/YOUR_APP.example.com
server {
    listen 80;
    server_name YOUR_APP.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/YOUR_APP.example.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## TLS with Certbot

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx
```

### Obtain a Certificate

```bash
sudo certbot --nginx -d YOUR_APP.example.com
```

Certbot will modify the Nginx config to add TLS and set up a redirect from HTTP to HTTPS. Auto-renewal is configured by default via a systemd timer.

### Verify Auto-Renewal

```bash
sudo certbot renew --dry-run
```

### Manual Renewal (if needed)

```bash
sudo certbot renew
```

## DNS

For each new subdomain, add an A record pointing to your server's IP:

| Type | Name       | Value            | TTL |
| ---- | ---------- | ---------------- | --- |
| A    | `YOUR_APP` | `YOUR_SERVER_IP` | 300 |

If using a wildcard:

| Type | Name | Value            | TTL |
| ---- | ---- | ---------------- | --- |
| A    | `*`  | `YOUR_SERVER_IP` | 300 |

Wait for DNS propagation before running certbot. Verify with:

```bash
dig YOUR_APP.example.com +short
```
