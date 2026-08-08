# CVZ Stock — Inventory App

A real, standalone web app (Vite + React + Tailwind) for tracking Cavenzi
Furniture Outlet's product stock, movements, and purchase orders, backed by
a Supabase Postgres database.

This is not a Claude.ai artifact — it's a normal web project, so it has no
sandbox restrictions and connects to Supabase directly.

## 1. Install dependencies

```
npm install
```

## 2. Configure Supabase

A `.env` file is already included with this project's real credentials
(`VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` — the publishable key, safe to
expose in frontend code). If you ever point this at a different Supabase
project, copy `.env.example` to `.env` and fill in the new values.

Make sure `supabase-setup.sql` (from earlier) has already been run in that
project's SQL Editor — this app expects the `products`, `movements`, and
`purchase_orders` tables to exist.

## 3. Run it locally

```
npm run dev
```

Open the URL it prints (usually http://localhost:5173).

## 4. Deploy it so it's reachable from anywhere

The simplest option is [Vercel](https://vercel.com):

1. Push this project to a GitHub repo.
2. On vercel.com, "Add New Project" → import that repo.
3. Vercel auto-detects Vite. Before deploying, add the same two environment
   variables from `.env` in Vercel's project settings (Settings →
   Environment Variables).
4. Deploy. You'll get a public `https://your-app.vercel.app` URL.

Netlify works the same way if you prefer it.

## Project structure

- `src/App.jsx` — the whole app (UI + Supabase data layer)
- `src/supabaseClient.js` — Supabase client setup, reads from `.env`
- `src/index.css` — Tailwind + fonts

## Notes

- The `anon`/publishable key + Row Level Security policies from the setup
  SQL mean anyone with this app's code can read/write the database. Fine
  for personal single-user use; if this grows to multiple staff accounts,
  look into Supabase Auth + tighter RLS policies scoped per user.
