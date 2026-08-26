# Confira-Ai backend

1. Create a Supabase project. In **Project Settings → API**, copy the project URL, anon key, and service-role key.
2. Run [`database/schema.sql`](database/schema.sql) in the Supabase SQL Editor. Its idempotent trigger always uses `auth.users.id` as `profiles.id`, preventing the historical `profiles_pkey` duplicate error.
3. Create private `resumes` and `avatars` buckets in Storage. Never make resumes public.
4. Copy `.env.example` to `.env` and fill only backend variables. Keep the service-role key out of the Vite environment.

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Visit `http://localhost:8001/docs` and `http://localhost:8001/api/health`. Configure Supabase Auth redirect URL as `http://localhost:5173/auth`.
