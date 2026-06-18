# Deploying AscendAI

Your app has three parts that each need a home:

| Part | Where it goes | Why |
|------|---------------|-----|
| Database (MongoDB) | **MongoDB Atlas** (free tier) | Vercel/Render can't host a database |
| Backend (FastAPI) | **Render** (free web service) | A persistent server that holds a DB connection + streams chat |
| Frontend (React) | **Vercel** (free) | Best home for a static React build |

Do them **in this order** — each step needs a URL from the previous one. I've already prepared the repo so the cloud builds succeed (this is the part you couldn't get past locally).

---

## Step 1 — Database: MongoDB Atlas (free)

1. Go to **mongodb.com/cloud/atlas** and create a free account (or sign in).
2. Create a project, then **Build a Database** → choose the **free M0** tier → pick a region near you → **Create**.
3. **Database Access** (left menu) → **Add New Database User**. Give it a username and password (save these). Role: *Read and write to any database*.
4. **Network Access** (left menu) → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`). (Fine to start; you can tighten later.)
5. Back on **Database** → **Connect** → **Drivers** → copy the **connection string**. It looks like:
   `mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
6. Replace `USERNAME` and `PASSWORD` in that string with the user you just made. **Keep this string** — it's your `MONGO_URL`.

> Don't worry about creating collections — the backend seeds itself on first start.

---

## Step 2 — Backend: Render (free)

1. Go to **render.com**, sign up, and connect your GitHub account so Render can see this repo.
2. **New + → Web Service** → pick this repository.
3. Settings:
   - **Root Directory:** `backend`
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Instance type:** Free
4. Expand **Environment Variables** and add these (this is the part that makes or breaks it):

   | Key | Value |
   |-----|-------|
   | `MONGO_URL` | the Atlas string from Step 1 |
   | `DB_NAME` | `ascendai` |
   | `JWT_SECRET` | any long random string |
   | `ADMIN_EMAIL` | the email you want to log in with |
   | `ADMIN_PASSWORD` | a strong password |
   | `CORS_ORIGINS` | leave as `*` for now; tighten in Step 4 |
   | `SITE_URL` | leave blank for now; fill in Step 4 |
   | `PYTHON_VERSION` | `3.11.9` |
   | `ANTHROPIC_API_KEY` | *(optional)* your Anthropic key to enable Aria chat |
   | `CHAT_MODEL` | `claude-sonnet-4-5-20250929` |

5. **Create Web Service.** Watch the logs — when you see `Application startup complete` and `Seed completed`, it's live.
6. Copy the backend URL Render gives you, e.g. `https://ascendai-backend.onrender.com`. **Keep it** for Step 3.

> Test it: open `https://<your-render-url>/api/health` — you should see `{"ok": true}`.
> (Heads-up: Render's free tier sleeps after ~15 min idle, so the first request after a nap takes ~30s to wake.)

---

## Step 3 — Frontend: Vercel (free)

1. In Vercel, import this repo (you're already on that screen).
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Create React App (auto-detected)
   - Leave build/output as default — I've added a `vercel.json` that sets the install command and SPA routing for you.
3. **Environment Variables** — add one:

   | Key | Value |
   |-----|-------|
   | `REACT_APP_BACKEND_URL` | your Render backend URL from Step 2 (e.g. `https://ascendai-backend.onrender.com`) |

4. **Deploy.** When it finishes, Vercel gives you your site URL, e.g. `https://claude-it-website-project.vercel.app`.

---

## Step 4 — Connect the two (CORS)

The backend must trust your real frontend domain, or the browser will block API calls.

1. Back in **Render → your service → Environment**:
   - Set `CORS_ORIGINS` to your Vercel URL (e.g. `https://claude-it-website-project.vercel.app`).
   - Set `SITE_URL` to the same URL.
2. Save — Render redeploys automatically.

Now visit your Vercel URL, go to `/login`, and sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in Step 2. The admin dashboard is at `/admin`.

---

## What's already done for you in the repo
- `backend/requirements.txt` — removed the Emergent-only package (no longer used) and added `anthropic`, so `pip install` succeeds on Render.
- `render.yaml` — an optional Render Blueprint with the start command and env-var slots pre-listed.
- `frontend/vercel.json` — sets `npm install --legacy-peer-deps` and SPA routing (so refreshing `/services` doesn't 404).
- `frontend/package.json` — pinned `ajv@8` so the Vercel build won't hit the error you saw locally.
- `.env` files are gitignored — your secrets won't be pushed to GitHub.

## Common gotchas
- **Backend build fails on a package** → confirm `PYTHON_VERSION=3.11.9` is set.
- **Frontend loads but API calls fail / CORS error** → `CORS_ORIGINS` on Render must exactly match your Vercel URL (no trailing slash).
- **Login works locally but not in prod** → you set `ADMIN_EMAIL`/`ADMIN_PASSWORD` on Render, and the backend seeded them on first boot. Use those exact values.
- **First load is slow** → Render free tier waking from sleep; normal.
