# Campus Marketplace

A peer-to-peer marketplace for students to buy/sell/borrow within their campus.
React + Vite frontend, Node/Express backend, PostgreSQL for data, Auth0 for auth.

## Project structure

```
campus-marketplace/
├── frontend/   React + Vite app (Main / Description / Profile windows)
└── backend/    Node/Express starter API (listings, users, transactions)
```

## ⚠️ Important: two different API contracts in this project

`frontend/src/api/api.js` targets the **comprehensive backend contract**
described in `Campus_Marketplace_Frontend_API.md` (categories, SELL/BORROW
listings, borrowings, purchase requests, transactions, reviews, image
uploads to Supabase Storage, `GET/PATCH /api/users/me`, etc.). That's a real
backend owned/built separately from this starter project.

The `backend/` folder in this repo is the **original simple starter** (plain
listings/users/transactions with mock data) and does **not** yet implement
that full contract. If you have the real backend running, point the
frontend at it via `VITE_API_URL` and ignore `backend/`. If you want
`backend/` rebuilt to match the full guide (borrowings, purchase requests,
image upload, etc.), that's a separate, larger task — just ask.

A few endpoints in the guide are described only conceptually without a
literal path (own listings, a borrowing status endpoint, another user's
public profile) — `api.js` has best-guess paths for these, each flagged
with an `ASSUMED ENDPOINT` comment. Confirm the real paths with whoever
owns the backend.

## 1. Frontend setup

```
cd frontend
npm install
cp .env.example .env   # fill in your Auth0 domain/client id/audience
npm run dev
```

Runs at http://localhost:5173. Requests to `/api/...` are proxied to the
backend in dev (see `vite.config.js`).

## 2. Backend setup (starter version)

```
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, AUTH0_DOMAIN, AUTH0_AUDIENCE
npm run dev
```

Runs at http://localhost:5000. Until you connect PostgreSQL, all routes
return mock data.

## 3. Connect PostgreSQL (starter backend only)

1. Create a Postgres database.
2. Run `backend/db/schema.sql` against it.
3. Set `DATABASE_URL` in `backend/.env`.
4. In each file under `backend/routes/`, swap the mock data sections for
   the commented-out `pool.query(...)` examples above them.

## 4. Connect Auth0

1. Create an **Application** (Single Page App) at https://manage.auth0.com.
   - Allowed Callback URLs / Logout URLs / Web Origins: `http://localhost:5173`
2. Create an **API** in Auth0 with identifier `https://api.campus-marketplace`
   (this must match `VITE_AUTH0_AUDIENCE` / `AUTH0_AUDIENCE` exactly, or
   token verification will fail).
3. Copy the Application's Domain + Client ID into `frontend/.env`.
4. Copy the Domain + API identifier into `backend/.env`.

No custom login/signup forms are needed — Auth0's hosted Universal Login
page handles that. `Navbar.jsx` just calls `loginWithRedirect()` /
`logout()`.

## Styling

All colors/fonts/spacing are CSS variables in `frontend/src/index.css` —
change them there to re-theme the whole site. Every component also has
its own `.css` file with comments for one-off tweaks.
