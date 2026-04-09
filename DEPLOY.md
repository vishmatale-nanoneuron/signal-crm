# Signal CRM — Deployment Guide

Complete setup: Supabase → Railway (backend) → Cloudflare Pages (frontend)

---

## 1. Supabase Database

1. Go to [supabase.com](https://supabase.com) → New project
2. Note your project credentials:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **Anon key**: Settings → API
   - **Service role key**: Settings → API
   - **Direct DB URL**: Settings → Database → Connection string → URI (port **5432**)
   - **Pooler URL** (optional): port **6543** — use if Railway hits connection limits

3. Open **SQL Editor** → paste entire contents of `database_schema.sql` → Run

4. Verify in Table Editor: `profiles`, `web_signals`, `watchlist_accounts`, `deals`, `leads`, `compliance_saves` tables exist

---

## 2. Railway — Backend

### Create project

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select repo: `vishmatale-nanoneuron/signal-crm`
3. Set **Root Directory**: `backend`
4. Railway auto-detects Nixpacks + `requirements.txt`

### Environment variables

Set these in Railway → Variables:

```
DATABASE_URL=postgresql+asyncpg://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_KEY=<service-role-key>
JWT_SECRET=<generate: openssl rand -hex 32>
JWT_ALGORITHM=HS256
CORS_ORIGINS=https://signal.nanoneuron.ai,https://signal-crm.pages.dev
ANTHROPIC_API_KEY=<your-claude-api-key>
OPENAI_API_KEY=<your-openai-key>
RAZORPAY_KEY_ID=<razorpay-key>
RAZORPAY_KEY_SECRET=<razorpay-secret>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-gmail>
SMTP_PASS=<app-password>
FROM_EMAIL=noreply@nanoneuron.ai
```

> **Note**: Use port `6543` (pgbouncer) for Railway to avoid connection limits. The backend auto-detects this and disables prepared statements.

### Deploy

Railway deploys automatically on push. The `railway.toml` and `Procfile` are already configured:
- Start: `gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 2 --bind 0.0.0.0:$PORT`
- Health check: `GET /api/health`

### Note your Railway URL

It will be something like: `https://signal-crm-production.up.railway.app`

---

## 3. Cloudflare Pages — Frontend

### Create project

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) → Create a project → Connect to Git
2. Select repo: `vishmatale-nanoneuron/signal-crm`
3. Settings:
   - **Root directory**: `frontend`
   - **Framework preset**: Next.js (Static HTML Export)
   - **Build command**: `npm run build`
   - **Build output directory**: `out`

### Environment variables (Cloudflare Pages → Settings → Environment variables)

```
NEXT_PUBLIC_API_URL=https://signal-crm-production.up.railway.app
NEXT_PUBLIC_APP_NAME=Signal CRM
NEXT_PUBLIC_SITE_URL=https://signal.nanoneuron.ai
NEXT_PUBLIC_RAZORPAY_KEY=<razorpay-key-id>
NODE_VERSION=20
```

> Set these for **Production** environment.

### Deploy

Push to `main` branch → Cloudflare Pages builds and deploys automatically.

---

## 4. Custom Domain — signal.nanoneuron.ai

### In Cloudflare Pages

1. Pages project → Custom domains → Add custom domain
2. Enter: `signal.nanoneuron.ai`
3. Cloudflare will show you a CNAME record to add

### In your DNS (Cloudflare DNS for nanoneuron.ai)

If nanoneuron.ai is already on Cloudflare:
1. DNS → Add record
2. Type: `CNAME`
3. Name: `signal`
4. Target: `<your-pages-project>.pages.dev`
5. Proxy: **Proxied** (orange cloud)

SSL is automatic via Cloudflare.

---

## 5. Post-Deploy Checklist

- [ ] `GET https://signal-crm-production.up.railway.app/api/health` returns `{"status":"ok"}`
- [ ] `https://signal.nanoneuron.ai` loads the landing page
- [ ] Register a new account → dashboard shows demo signals
- [ ] Settings page → update profile → password change works
- [ ] Watchlist → add a company → scan runs
- [ ] AI analysis returns (check Railway logs for Claude/OpenAI calls)

---

## 6. Supabase RLS — Verify

In Supabase SQL Editor:

```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables should show `rowsecurity = true`.

---

## 7. Generate JWT Secret

```bash
openssl rand -hex 32
```

Use this value for `JWT_SECRET` in Railway.

---

## 8. AI Keys Priority

Signal CRM uses a fallback chain:
1. **Claude** (`claude-sonnet-4-6`) — set `ANTHROPIC_API_KEY`
2. **OpenAI** (`gpt-4o-mini`) — set `OPENAI_API_KEY`
3. **Rule-based** — works with no API keys (limited but functional)

For production, set at least `ANTHROPIC_API_KEY`.

---

## Quick Reference

| Service | URL |
|---------|-----|
| Backend API | `https://signal-crm-production.up.railway.app` |
| API Docs | `https://signal-crm-production.up.railway.app/docs` |
| Health | `https://signal-crm-production.up.railway.app/api/health` |
| Frontend | `https://signal.nanoneuron.ai` |
| Supabase | `https://app.supabase.com/project/<ref>` |
| Railway | `https://railway.app/project/<id>` |
| Cloudflare | `https://dash.cloudflare.com` |
