# Homlo Jobs migrations

The SQL files in this directory are the **single source of truth** for the Homlo marketplace schema. They are numbered and must be applied in lexical order, from `001_core_identity.sql` through `008_moderation_audit.sql`.

Apply an unchanged migration file through the connected Supabase integration. Do not create or alter the production schema manually in the Supabase dashboard. The SQL editor may only be used as the execution surface for a reviewed migration file.

Every future schema change must be a new numbered migration. Existing migrations are immutable once applied to a shared environment.
