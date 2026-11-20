-- Adds a database category for each official job field that has none yet, so
-- jobs posted under these fields (Post a job → first question) are saved with
-- a category instead of none. Names are each field's main alias in
-- lib/job-fields.ts, so resolveJobField() maps them back to the right field.
--
-- NOT APPLIED. Review against the live `categories` table before running:
-- this inserts only (name, slug) and assumes any other columns have defaults.
-- Idempotent: rows whose slug already exists are skipped.

insert into categories (name, slug)
select v.name, v.slug
from (values
  ('Retail', 'retail'),
  ('Human Resources', 'human-resources'),
  ('Design', 'design'),
  ('Healthcare', 'healthcare'),
  ('Manufacturing', 'manufacturing'),
  ('Beauty', 'beauty'),
  ('Cleaning', 'cleaning'),
  ('Security', 'security'),
  ('Agriculture', 'agriculture')
) as v(name, slug)
where not exists (select 1 from categories c where c.slug = v.slug);
