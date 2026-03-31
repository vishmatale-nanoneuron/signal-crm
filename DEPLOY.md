# Signal CRM — Deploy Guide
**Backend → Railway** | **Frontend → Cloudflare Pages** | **Domain → nanoneuron.ai**

---

## STEP 1 — Deploy Backend on Railway

### 1.1 Create Railway project
1. Go to **railway.app** → New Project
2. Select **"Deploy from GitHub repo"**
3. Choose your repo (e.g. `your-github/signal-crm`)
4. Set **Root Directory** = `backend`
5. Railway detects the Dockerfile → click **Deploy**

### 1.2 Add PostgreSQL database
1. In Railway project → click **"+ New"** → **Database** → **PostgreSQL**
2. Railway auto-injects `DATABASE_URL` into your backend service ✅
3. Tables are created automatically on first startup

### 1.3 Set environment variables
In Railway → backend service → **Variables** tab:

| Variable | Value |
|---|---|
| `JWT_SECRET` | Run: `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `EXTRA_CORS_ORIGINS` | Add after Step 2 — your Cloudflare Pages URL |

> `DATABASE_URL` is auto-set by Railway PostgreSQL — do NOT add it manually.

### 1.4 Get your backend URL
After deploy, Railway gives you: `https://signal-crm-production.up.railway.app`

**Custom domain** (optional — api.nanoneuron.ai):
- Railway → backend service → Settings → Domains → Add Custom Domain
- Add CNAME: `api` → `signal-crm-production.up.railway.app` in Cloudflare DNS

---

## STEP 2 — Deploy Frontend on Cloudflare Pages

### 2.1 Connect repo to Cloudflare Pages
1. Go to **Cloudflare Dashboard** → Workers & Pages → Create application → Pages
2. Connect GitHub → select your repo
3. Set build settings:
   - **Framework preset**: Next.js (Static HTML Export)
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
   - **Root directory**: `frontend`

### 2.2 Set environment variables
In Cloudflare Pages → Settings → Environment Variables → Production:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://signal-crm-production.up.railway.app` (your Railway URL) |

### 2.3 Custom domain — nanoneuron.ai
1. Cloudflare Pages → your project → Custom domains → Add
2. Enter `nanoneuron.ai` and `www.nanoneuron.ai`
3. Cloudflare auto-creates DNS records ✅

---

## STEP 3 — Update CORS after both are live

In Railway → backend → Variables:
```
EXTRA_CORS_ORIGINS = https://nanoneuron.ai,https://www.nanoneuron.ai
```

Then redeploy backend (Railway auto-redeploys on env var change).

---

## STEP 4 — Verify deployment

```bash
# Health check
curl https://signal-crm-production.up.railway.app/api/health

# Expected response:
# {"status":"healthy","app":"Signal CRM","version":"2.0.0",...}
```

Then open: **https://nanoneuron.ai** → register → dashboard loads signals ✅

---

## Modules live after deploy

| Module | Route | What it does |
|---|---|---|
| Auth | `/api/auth/` | Register, login, JWT tokens |
| Signals | `/api/signals/` | Web change signals feed |
| Watchlist | `/api/watchlist/` | Track target companies |
| Buyer Map | `/api/buyer-map/` | Suggest titles to contact |
| Compliance | `/api/compliance/` | Country outbound rules |
| Deals | `/api/deals/` | Pipeline tracker |
| Next Actions | `/api/next-actions/` | AI-ranked action queue |
| Leads | `/api/leads/` | Lead management |
| Payment | `/api/payment/` | Razorpay integration |

---

## Pricing (once live)

- **Starter**: ₹8,000/month — 1 user, 25 watchlist accounts
- **Growth**: ₹25,000/month — 5 users, 100 accounts
- **Agency**: ₹75,000/month — unlimited users + white-label
