# Reports Admin (Next.js + Supabase)

This is a minimal admin frontend for adding and viewing "acts" (date, amount, receiver, act number, PDF, photo)
that connects to your Supabase project.

## Quickstart

1. Create a GitHub repository and push the contents of this folder.
2. Create a new Vercel project (Import from GitHub).
3. Add the following Environment Variables in Vercel (Project Settings -> Environment Variables):
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Deploy.

### Local development

1. Copy `.env.example` to `.env.local` and fill your Supabase credentials.
2. Install dependencies:
   ```
   npm install
   ```
3. Run dev server:
   ```
   npm run dev
   ```
4. Open http://localhost:3000

## Pages

- `/` — Login page (Google OAuth redirect)
- `/add` — Add act (upload files to storage and insert into `acts` table)
- `/acts` — List acts (simple table)

The project expects a Supabase project named `reports` (you have already created the tables/bucket).
Make sure you created a `acts` table and an `acts-files` public bucket.

RLS: Enable Row-Level Security on `acts` and add a policy that allows inserts by authenticated users.
