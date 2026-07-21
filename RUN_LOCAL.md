# Running RK AI Labs locally

This gets the full site running on your own machine at **http://localhost:3000**.
The Aria chat widget is intentionally disabled (it needs an Emergent key); everything
else — pages, admin dashboard, leads, blog, CMS — works against your local MongoDB.

## Prerequisites
- **Python 3.10+** (`python --version`)
- **Node 18+** (`node --version`) with **Yarn** (`corepack enable` if you don't have it)
- **MongoDB** running locally on the default port `27017` (you confirmed this is installed)

## One-time check: is MongoDB running?
Open a terminal and run `mongosh` (or `mongo`). If it connects, you're good. If not,
start the MongoDB service (Windows: Services → "MongoDB Server" → Start, or run `net start MongoDB`).

## Start it (two terminals)

The easiest way — just double-click these two files in the project folder, in order:

1. **`start-backend.bat`**  → backend on http://localhost:8001
2. **`start-frontend.bat`** → frontend on http://localhost:3000 (opens your browser)

The first run installs dependencies and takes a few minutes. Later runs are fast.

### Or run the commands manually

**Terminal 1 — backend**
```bat
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements-local.txt
uvicorn server:app --port 8001 --reload
```

**Terminal 2 — frontend**
```bat
cd frontend
yarn install
yarn start
```

## Log in as admin
Visit http://localhost:3000/login and use the seeded credentials:
- **Email:** `admin@iamrohankapoor.com`
- **Password:** `Admin@12345`

(Defined in `backend/.env` — change them there if you like, then restart the backend.)
The admin dashboard lives at **/admin**.

## What works vs. what's off locally
- **Works:** all public pages, services PLP/PDP, blog/insights, contact + lead capture
  (leads are saved to your local DB and visible in the admin Leads tab), full admin CRUD, SEO routes.
- **Off (needs keys):** the Aria chat widget (shows a "not configured" notice), lead-notification
  emails (lead still saves), and Cloudinary image uploads in admin. To enable any of these,
  fill the matching values in `backend/.env` and restart the backend.

## Troubleshooting
- **Backend exits immediately / Mongo error:** MongoDB isn't running. See the check above.
- **Frontend can't reach the API:** make sure the backend window is open and shows
  `Uvicorn running on http://0.0.0.0:8001`. The URL the frontend uses is in `frontend/.env`.
- **Port already in use:** change `--port 8001` (and `REACT_APP_BACKEND_URL` in `frontend/.env`)
  or `yarn start` will offer to use another port for the frontend.
- **`pip install` fails on a package:** you can ignore optional ones; the lean
  `requirements-local.txt` only lists what's needed to browse.
