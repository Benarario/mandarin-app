# Setup — in plain language

This app is really a **website that installs like an app**. Your learning data lives in
the cloud (Supabase), so your progress is identical on your phone, laptop, and any other
computer — you just open the same link and sign in.

You only have to do **one** signup (Supabase) to get going. It takes about 5–10 minutes.
Follow the steps in order. You don't need to understand the code.

---

## What you need first

- This project folder on your computer.
- **Node.js** installed (version 20 or newer). Check by opening a terminal and typing
  `node -v`. If it prints a number like `v24.x`, you're set. If not, install it from
  <https://nodejs.org> (the "LTS" button).

---

## Step 1 — Create a free Supabase project

1. Go to <https://supabase.com> and click **Start your project** → sign in with GitHub or email.
2. Click **New project**.
3. Give it a name (e.g. `mandarin`), pick a **database password** (save it somewhere — you
   won't need it day-to-day), choose the region closest to you, and click **Create new project**.
4. Wait ~2 minutes while it sets up.

## Step 2 — Create the database tables

1. In your Supabase project, open **SQL Editor** (left sidebar) → **New query**.
2. Open the file `supabase/migrations/0001_init.sql` from this project, copy **all** of it,
   paste it into the editor, and click **Run**.
3. You should see "Success. No rows returned." That created all the tables and security rules.

## Step 3 — Copy your keys into the app

1. In Supabase, open **Project Settings** (gear icon) → **API**.
2. You'll see three things you need:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string)
   - **service_role** key (another long string — keep this one secret)
3. In the project folder, make a copy of `.env.local.example` and name the copy `.env.local`.
4. Open `.env.local` in any text editor and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=…your Project URL…
   NEXT_PUBLIC_SUPABASE_ANON_KEY=…your anon public key…
   SUPABASE_SERVICE_ROLE_KEY=…your service_role key…
   ```

   Save the file. (The `service_role` key is only used by the one-time data loader on your
   computer — it never goes to the browser. Never share it or commit it to GitHub.)

## Step 4 — Turn on email sign-in links

1. In Supabase, open **Authentication** → **URL Configuration**.
2. Set **Site URL** to `http://localhost:3000`.
3. Under **Redirect URLs**, add `http://localhost:3000/**` and click save.
   (When you later deploy to the web, add your real address here too.)

Email "magic link" sign-in is on by default, so there's nothing else to switch on.

## Step 5 — Install and load the dictionary

In a terminal, inside the project folder, run these one at a time:

```bash
npm install        # installs the app's building blocks (once)
npm run etl        # downloads CC-CEDICT, HSK lists, frequency, and example sentences,
                   # then loads them into your Supabase database
```

The `npm run etl` step prints how many entries it loaded (around 125,000 dictionary words).
It's safe to run again later — it replaces the data rather than duplicating it.

## Step 6 — Run the app

```bash
npm run dev
```

Open <http://localhost:3000> in your browser. Enter your email, click the magic link we send
you, and you're in. The first time you open **Review**, it builds you a starter deck of the
most common HSK-1 words.

---

## Put it on your phone

While developing, the easiest way to use it on your phone on the same Wi-Fi is the **Network**
address the `npm run dev` command prints (e.g. `http://192.168.1.23:3000`). For a permanent,
installable app, deploy it to the web (next section) and then:

- **iPhone (Safari):** open the site → tap the **Share** button → **Add to Home Screen**.
- **Android (Chrome):** open the site → menu (⋮) → **Install app** / **Add to Home Screen**.

It then opens full-screen like a normal app, and works offline for reviews.

## Optional — put it online with Vercel (free)

1. Create a free account at <https://vercel.com> and connect your GitHub.
2. Push this project to a GitHub repository.
3. In Vercel, **Add New → Project**, pick the repo, and in **Environment Variables** paste the
   same three values from your `.env.local`. Click **Deploy**.
4. Vercel gives you a web address (e.g. `https://your-app.vercel.app`). Add that address (and
   `/**`) to Supabase **Authentication → URL Configuration** so sign-in works there too.

That web address is what you open and install on every device.

---

## Troubleshooting

- **"Supabase isn't configured yet"** on the home page → `.env.local` is missing or the keys
  are blank. Re-check Step 3, then stop the app (Ctrl-C) and run `npm run dev` again.
- **The sign-in link doesn't work** → make sure you did Step 4 (Site URL + Redirect URLs).
- **Reviews are empty / words don't show definitions** → you probably haven't run
  `npm run etl` yet (Step 5), or it didn't finish.
