-- =========================================================
-- 056_user_adult_confirmation.sql
-- Records whether a member has confirmed they are 18 or older,
-- answered from Edit profile ("Age check"). This is a self-declared
-- confirmation, not an identity check.
--
-- Kept separate from `users.age` (055): the age is what they typed
-- at sign-up and can go stale; this is an explicit, dated answer.
-- `is_adult` is null until they answer; the app then falls back to
-- `age >= 18` for the starting choice.
-- =========================================================

alter table users add column if not exists is_adult boolean;
alter table users add column if not exists is_adult_confirmed_at timestamptz;
