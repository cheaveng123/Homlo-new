# Homlo backend environment configuration

The Homlo runtime requires these project secrets. They are configured through the secure project settings rather than committed to the repository.

| Variable | Scope | Purpose |
|---|---|---|
| `SUPABASE_URL` | Server | Supabase project URL used by the infrastructure adapter. |
| `SUPABASE_ANON_KEY` | Client-safe configuration only | Supabase Publishable key or legacy Anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Administrative Supabase access for storage and server-side authentication verification. |
| `SUPABASE_DB_URL` | Server only | Transactional Postgres connection used by the database adapter. |

Do not prefix server-only variables with `EXPO_PUBLIC_`. The Expo client communicates with Homlo server procedures and never imports a Supabase client directly.
