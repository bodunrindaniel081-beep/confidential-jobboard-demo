# Confidential Job Board — role-based redaction demo

A small Next.js + Supabase demo showing **employer contact details redacted at the database level**, not just hidden in the UI.

## Live demo

https://confidential-jobboard-demo.vercel.app

On the sign-in page, click **Admin**, **Employer** or **Recruiter** to fill in a demo account, then click **Sign in**.

## Roles

| Role | Sees jobs | Sees company name & contact |
|---|---|---|
| Admin | All | All |
| Employer | Own only | Own only |
| Recruiter | All | **Never** |

## How the redaction works

Each job is split across two tables:

- `jobs` holds the sanitized info (title, location, description).
- `job_private` holds the company name and contact email.

Row Level Security on `job_private` only allows the owning employer and the admin to read it. Recruiters have no read policy, so Supabase returns **zero rows** to them, even if someone calls the API directly. See `supabase/schema.sql`.

## Try it

1. Sign in as the **Employer** and post a role.
2. Sign out, then sign in as the **Recruiter**: the role shows, but company and contact are redacted.
3. Sign out, then sign in as the **Admin**: everything is visible.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # add your Supabase URL and anon key
npm run dev
```

Stack: Next.js 14 (App Router), Supabase (Postgres, Auth, Row Level Security), deployed on Vercel.
