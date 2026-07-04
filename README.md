# WealthTrack — Monthly Expense & Wealth Tracker

A responsive, single-page dashboard for tracking monthly income, expenses, and
remaining balance — with live metrics, an interactive donut chart, a saved
history log, and optional **Supabase cloud sync**.

Amounts are shown in **Pakistani Rupees (PKR / Rs)**.

No build step. Plain HTML + Tailwind (CDN) + Chart.js + Supabase JS.

## Features

- Auto-detects the current month; switch months to back-log or review past data.
- **Fortnightly income** — two paycheck fields (paid twice a month) that sum
  into your monthly total.
- Default categories (Mutual Funds, Food, Outing, Medicine) plus **Add Custom
  Category** — new numeric fields appear instantly.
- Three live metric cards: Total Income, Total Expenses, Remaining Balance.
- Donut chart *"Where is your money going?"* — updates in real time, hides $0
  categories.
- **Save Month's Data** — persists to Supabase (if configured) and always
  mirrors to your browser's local storage.
- **Historical Log** table with Load / Delete per month and **Export CSV**.

## Run it

It's a static site — just open it, or serve the folder:

```bash
# any static server works; e.g. with Python:
python -m http.server 5173
# then visit http://localhost:5173
```

Opening `index.html` directly also works, but a local server is recommended so
the Supabase client and fonts load without file:// restrictions.

Out of the box it runs in **local storage** mode (badge shows amber). Everything
works offline — data lives in your browser.

## Enable Supabase cloud sync (private to your account)

When Supabase is configured, the app is **locked behind a sign-in screen** and
every row is scoped to your user via Row Level Security — your data is private
to your account.

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql).
   This creates the table, per-user ownership, and the RLS policy.
3. In **Project Settings → API**, copy your **Project URL** and **anon public**
   key, and paste them into [`src/config.js`](src/config.js):

   ```js
   window.SUPABASE_CONFIG = {
     url: "https://YOURPROJECT.supabase.co",
     anonKey: "eyJhbGciOi...",
     table: "monthly_records",
   };
   ```

4. Reload. You'll see the **Sign in** screen. Click **Sign up** to create your
   account once (or add yourself under Dashboard → Authentication → Users).
5. **Lock it to just you:** after your account exists, go to
   Dashboard → Authentication → Providers → **Email** and turn **off**
   *"Allow new users to sign up"*. (Optional but handy: turn **off**
   *"Confirm email"* so sign-in works instantly.)

Once signed in, the badge turns green (**Supabase · cloud sync**) and saved
months sync to the cloud, readable after signing in from any device.

> The **anon** key is safe in the browser — RLS makes it useless without a valid
> login, and each user can only ever see their own rows. Never put the
> **service_role** key in `config.js`.

## Deploy on Vercel

Yes — it's a static site, so it deploys with **zero configuration**. A
`vercel.json` is included for clean URLs and sensible caching.

**Option A — dashboard (no CLI):**

1. Push this folder to a GitHub/GitLab repo.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Framework preset: **Other**. Leave Build Command and Output Directory empty
   (it's already static). Click **Deploy**.

**Option B — Vercel CLI:**

```bash
npm i -g vercel
vercel          # preview deploy
vercel --prod   # production deploy
```

### Supabase on Vercel

No environment variables or build step are needed. This is a client-side app,
so the Supabase **anon** key is public by design — safe because Row Level
Security is enabled by `schema.sql`. Just commit your URL + anon key in
`src/config.js` and they ship with the deploy. (Do **not** put your Supabase
*service_role* key here — only the anon key.)

## Project structure

```
index.html            # markup + CDN includes + sign-in gate
src/config.js          # Supabase URL / anon key (edit to enable sync)
src/store.js           # storage layer — Supabase or localStorage + auth
src/auth.js            # sign-in / sign-up gate
src/app.js             # UI logic, live metrics, chart, history
supabase/schema.sql    # table + per-user ownership + RLS policy
vercel.json            # static deploy config (clean URLs + caching)
```
