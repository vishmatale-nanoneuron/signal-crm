# Signal CRM — Deployment Guide

**Database: Supabase** | **Backend: Render** | **Frontend: Cloudflare Pages**

---

## Step 1 — Supabase (Database)

1. Go to **supabase.com** → New project → name `signal-crm`, region **South Asia (Mumbai)**
2. Copy these from **Settings → API** and **Settings → Database**:
   - Project URL: `https://<ref>.supabase.co`
   - Anon key
   - Service role key
   - Connection string (URI, port **6543** pooler — for Render free tier)

3. **SQL Editor** → paste `database_schema.sql` → Run

4. Check Table Editor: `profiles`, `web_signals`, `watchlist_accounts`, `deals`, `leads`, `compliance_saves` all present

---

## Step 2 — Render (Backend)

### Create Web Service

1. **render.com** → New → Web Service → Connect GitHub
2. Select repo: `vishmatale-nanoneuron/signal-crm`
3. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 2 --bind 0.0.0.0:$PORT --timeout 120 --graceful-timeout 60 --access-logfile - --error-logfile -`
   - **Plan**: Free

### Environment Variables (Render → Environment)

Set these manually in Render dashboard:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres` |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | from Supabase Settings → API |
| `SUPABASE_SERVICE_KEY` | from Supabase Settings → API |
| `JWT_SECRET` | run `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | your Claude API key |
| `RAZORPAY_KEY_SECRET` | your Razorpay secret |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASSWORD` | Gmail app password |
| `RAZORPAY_KEY_ID` | your Razorpay key ID (rzp_live_...) |
| `OWNER_EMAIL` | your email (for CEO dashboard access) |

> `sync: false` keys in render.yaml are not committed to git — set them in Render dashboard only.

### Note your Render URL

After deploy: `https://signal-crm-api.onrender.com`

Test: `https://signal-crm-api.onrender.com/api/health` → `{"status":"ok"}`

---

## Step 3 — Cloudflare Pages (Frontend)

### Create Project

1. **pages.cloudflare.com** → Create a project → Connect to Git
2. Select repo: `vishmatale-nanoneuron/signal-crm`
3. Configure:
   - **Root directory**: `frontend`
   - **Framework preset**: None (or Next.js Static)
   - **Build command**: `npm run build`
   - **Build output directory**: `out`

### Environment Variables

Set in Cloudflare Pages → Settings → Environment variables → Production:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://signal-crm-api.onrender.com` |
| `NEXT_PUBLIC_APP_NAME` | `Signal CRM` |
| `NEXT_PUBLIC_SITE_URL` | `https://signal.nanoneuron.ai` |
| `NEXT_PUBLIC_RAZORPAY_KEY` | `rzp_test_SXSbotImCIeKSM` |
| `NODE_VERSION` | `20` |

### Deploy

Push to `main` → Cloudflare auto-builds. First build takes ~3 min.

---

## Step 4 — Custom Domain

### In Cloudflare Pages

Pages project → Custom domains → Add `signal.nanoneuron.ai`

### In Cloudflare DNS (nanoneuron.ai zone)

Add record:
- Type: `CNAME`
- Name: `signal`
- Target: `<your-pages-project>.pages.dev`
- Proxy: **Proxied** (orange cloud)

SSL is automatic.

---

## Step 5 — Post-Deploy Checklist

- [ ] `https://signal-crm-api.onrender.com/api/health` → `{"status":"ok"}`
- [ ] `https://signal.nanoneuron.ai` loads landing page
- [ ] Register new account → dashboard shows demo signals
- [ ] Watchlist → scan a company → signals appear
- [ ] Settings → update profile → success toast
- [ ] Settings → change password → works
- [ ] Check Render logs → Claude AI calls appearing

---

## Step 6 — Supabase RLS Check

In Supabase SQL Editor:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
All tables should show `rowsecurity = true`.

---

## Render Free Tier Notes

- Service **sleeps after 15 min** of inactivity → first request takes ~30s (cold start)
- To avoid: upgrade to Render Starter ($7/mo) for always-on
- Alternatively add a UptimeRobot ping every 10 min to keep it warm

---

## Quick Reference

| Service | URL |
|---------|-----|
| Backend API | `https://signal-crm-api.onrender.com` |
| API Docs (Swagger) | `https://signal-crm-api.onrender.com/docs` |
| Health | `https://signal-crm-api.onrender.com/api/health` |
| Frontend | `https://signal.nanoneuron.ai` |
| Supabase | `https://app.supabase.com` |
| Render | `https://dashboard.render.com` |
| Cloudflare | `https://dash.cloudflare.com` |

## Generate JWT Secret

```bash
openssl rand -hex 32
```
