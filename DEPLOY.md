# Deploying Synferrous

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
   | `DB_NAME` | `rkailabs` |
   | `JWT_SECRET` | any long random string |
   | `ADMIN_EMAIL` | the email you want to log in with |
   | `ADMIN_PASSWORD` | a strong password |
   | `CORS_ORIGINS` | leave as `*` for now; tighten in Step 4 |
   | `SITE_URL` | leave blank for now; fill in Step 4 |
   | `PYTHON_VERSION` | `3.11.9` |
   | `ANTHROPIC_API_KEY` | *(optional)* your Anthropic key to enable Aria chat |
   | `CHAT_MODEL` | `claude-sonnet-4-5-20250929` |

5. **Create Web Service.** Watch the logs — when you see `Application startup complete` and `Seed completed`, it's live.
6. Copy the backend URL Render gives you, e.g. `https://rkailabs-backend.onrender.com`. **Keep it** for Step 3.

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
   | `REACT_APP_BACKEND_URL` | your Render backend URL from Step 2 (e.g. `https://rkailabs-backend.onrender.com`) |

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

## Step 5 — Image storage: Amazon S3 + CloudFront

Images uploaded in the admin go straight from the browser into a **private** S3
bucket and are served through CloudFront. One CloudFormation template creates
everything; you don't build any of it by hand.

> **AWS Free plan warning.** Accounts opened after July 2025 start on a Free
> plan that **closes after 6 months** unless upgraded. If that happens, every
> image on the site disappears. Upgrade to the Paid plan before then — unused
> credits carry over. Real cost for a site this size: a few cents a month for
> storage; CloudFront's first 1 TB/month is permanently free.

### 5a. Create the storage (≈5 minutes)
1. Sign in to the AWS console. Top-right region selector → **Asia Pacific (Mumbai) ap-south-1**.
2. Search **CloudFormation** → **Create stack** → **With new resources (standard)**.
3. **Upload a template file** → choose `infra/media-storage.yaml` from this repo → Next.
4. Stack name: `rk-media`. Leave **BucketName** blank. In **AllowedOrigins**, list every
   site that uploads, comma-separated, no trailing slashes — e.g.
   `https://synferrous.com,https://www.synferrous.com,http://localhost:3000`. Next → Next.
5. Tick **"I acknowledge that AWS CloudFormation might create IAM resources"** → **Submit**.
6. Wait for `CREATE_COMPLETE` (CloudFront takes 3–5 minutes). Open the **Outputs** tab — keep it open.

### 5b. Create the backend's access key
1. Outputs → copy the **UploaderUser** value. Search **IAM** → **Users** → open that user.
2. **Security credentials** tab → **Create access key** → *Application running outside AWS* → Create.
3. Copy the **Access key ID** and **Secret access key**. The secret is shown **once** —
   paste it straight into Render (next step); don't save it in a file, chat, or the repo.

This user can only read, write and delete files under `media/` in this one bucket —
nothing else in your AWS account.

### 5c. Add the settings on Render
Render → `ascendai-backend` → **Environment** → add:

| Key | Value |
|-----|-------|
| `S3_BUCKET` | Outputs → **S3Bucket** |
| `MEDIA_BASE_URL` | Outputs → **MediaBaseUrl** (starts `https://d…cloudfront.net`) |
| `AWS_REGION` | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | from 5b |
| `AWS_SECRET_ACCESS_KEY` | from 5b |

Save. After the redeploy, **Admin → Media → Upload** should work. Uploads are
resized to at most 2400px and converted to WebP in the browser first, which also
strips location data from phone photos.

### Rolling back
Remove `S3_BUCKET` on Render and the backend falls back to Cloudinary (if its keys
are set). Images already uploaded keep working — each one remembers where it lives.

### If an access key ever leaks
IAM → the uploader user → **Security credentials** → deactivate the old key, create a
new one, update Render. The key can only touch the media bucket, which limits the damage.

---

## Step 6 — Connect synferrous.com

Do these **in order** — the frontend build writes canonical URLs from the backend's
`SITE_URL`, so the backend must know the domain before the frontend rebuilds.

### 6a. Point the domain at Vercel
1. Vercel → your project → **Settings → Domains** → add `synferrous.com`, then add
   `www.synferrous.com` and choose **Redirect to synferrous.com**.
2. Vercel shows the DNS records to create. Add exactly those at the registrar where
   you bought synferrous.com (usually an **A** record for the apex and a **CNAME** for `www`).
3. Wait until Vercel shows both domains as **Valid Configuration** (minutes to a few hours).

### 6b. Tell the backend
Render → `ascendai-backend` → **Environment**:

| Key | Value |
|-----|-------|
| `SITE_URL` | `https://synferrous.com` |
| `CORS_ORIGINS` | `https://synferrous.com,https://www.synferrous.com,https://rk-labs.vercel.app` |

Save and let it redeploy. On first boot it also rewrites the old brand name, domain
and email in your stored content (settings, pages, layouts, posts) — once.

### 6c. Rebuild the frontend
Vercel → **Deployments** → latest → **Redeploy**. The build log should end with
`Wrote head metadata for N routes, 404.html and llms.txt`. If it says
*"refusing to write canonical URLs"*, `SITE_URL` isn't set yet — fix 6b first.

### 6d. Email on the new domain
The site, Privacy and Terms pages all publish one address: **info@synferrous.com**.
Make sure it receives mail before launch. Change it any time in Admin → Site
settings → Email; the legal pages are edited under Admin → Pages.

Also set `LEAD_NOTIFICATION_EMAIL=info@synferrous.com` on Render so new leads are
emailed to you. To send those alerts *from* the domain, verify `synferrous.com` in
Resend (it gives you DNS records — keep your mail provider's SPF entry alongside Resend's), then set
`SENDER_EMAIL` on Render, e.g. `alerts@synferrous.com`.

### 6e. Image storage (if you've done Step 5)
CloudFormation → `rk-media` → **Update** → *Use current template* → set
**AllowedOrigins** to `https://synferrous.com,https://www.synferrous.com,http://localhost:3000`.

### 6f. Search engines
In Google Search Console add the `synferrous.com` property and submit
`https://synferrous.com/sitemap.xml`. Optionally, forward `iamrohankapoor.com` to
`https://synferrous.com` (301) at GoDaddy so old links still land.

---

## What's already done for you in the repo
- `backend/requirements.txt` — removed the Emergent-only package (no longer used) and added `anthropic`, so `pip install` succeeds on Render.
- `render.yaml` — an optional Render Blueprint with the start command and env-var slots pre-listed.
- `frontend/vercel.json` — sets `npm install --legacy-peer-deps`, routes each real page to the app, and returns a genuine 404 for unknown URLs (no catch-all). Static assets cache for a year; HTML always revalidates.
- `infra/media-storage.yaml` — the CloudFormation template for Step 5.
- `frontend/package.json` — pinned `ajv@8` so the Vercel build won't hit the error you saw locally.
- `.env` files are gitignored — your secrets won't be pushed to GitHub.

## Common gotchas
- **Backend build fails on a package** → confirm `PYTHON_VERSION=3.11.9` is set.
- **Frontend loads but API calls fail / CORS error** → `CORS_ORIGINS` on Render must exactly match your Vercel URL (no trailing slash).
- **Login works locally but not in prod** → you set `ADMIN_EMAIL`/`ADMIN_PASSWORD` on Render, and the backend seeded them on first boot. Use those exact values.
- **First load is slow** → Render free tier waking from sleep; normal.
