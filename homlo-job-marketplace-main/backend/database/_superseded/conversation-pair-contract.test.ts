import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "backend/database/migrations/050_conversation_pair_reuse.sql"),
  "utf8",
);

describe("050_conversation_pair_reuse.sql contract", () => {
  it("adds messages.application_id with if not exists", () => {
    expect(migration).toContain(
      "alter table public.messages\n  add column if not exists application_id uuid",
    );
    expect(migration).toContain("references public.applications(id) on delete set null");
  });

  it("adds an index for messages.application_id with if not exists", () => {
    expect(migration).toContain(
      "create index if not exists idx_messages_application_id",
    );
  });

  it("adds conversations.context_application_id with if not exists", () => {
    expect(migration).toContain(
      "alter table public.conversations\n  add column if not exists context_application_id uuid",
    );
  });

  it("adds conversations.pair_key with if not exists", () => {
    expect(migration).toContain(
      "alter table public.conversations\n  add column if not exists pair_key text",
    );
  });

  it("backfills messages.application_id only where it is null", () => {
    expect(migration).toContain("update public.messages m");
    expect(migration).toContain("set application_id = c.application_id");
    expect(migration).toContain("where c.id = m.conversation_id");
    expect(migration).toContain("and m.application_id is null");
  });

  it("backfills conversations.pair_key for exactly-two-member conversations", () => {
    expect(migration).toContain("update public.conversations c");
    expect(migration).toContain("set pair_key = pc.pair_key");
    expect(migration).toContain("least(cm.user_id::text, cm2.user_id::text)");
    expect(migration).toContain("greatest(cm.user_id::text, cm2.user_id::text)");
    expect(migration).toContain("c.pair_key is null");
  });

  it("get_or_create looks up by pair_key among non-deleted conversations", () => {
    expect(migration).toContain("where c.pair_key = v_pair_key");
    expect(migration).toContain("and c.deleted_at is null");
    expect(migration).toContain("order by c.last_message_at desc nulls last");
    expect(migration).toContain("limit 1");
    expect(migration).toContain("pg_advisory_xact_lock(hashtext(v_pair_key)::bigint)");
  });

  it("get_or_create keeps the same signature and authorization checks", () => {
    expect(migration).toContain(
      "create or replace function public.homlo_get_or_create_conversation(\n  p_actor_id uuid,\n  p_application_id uuid\n)",
    );
    expect(migration).toContain("returns conversations");
    expect(migration).toContain(
      "if p_actor_id not in (v_app.worker_id, v_job.employer_id) then",
    );
    expect(migration).toContain(
      "raise exception 'Only the applicant or the employer can open this conversation'",
    );
    expect(migration).toContain(
      "raise exception 'A user cannot message themself'",
    );
    expect(migration).toContain("security definer");
  });

  it("get_or_create sets context_application_id when reusing", () => {
    expect(migration).toContain("set context_application_id = p_application_id,");
    expect(migration).toContain("last_message_at = now()");
  });

  it("send_message keeps the same signature", () => {
    expect(migration).toContain(
      "create or replace function public.homlo_send_message(\n  p_conversation_id uuid,\n  p_sender_id uuid,\n  p_message text\n)",
    );
    expect(migration).toContain("returns messages");
    expect(migration).toContain("security definer");
  });

  it("send_message writes messages.application_id from context_application_id", () => {
    expect(migration).toContain(
      "coalesce(v_conversation.context_application_id, v_conversation.application_id)",
    );
  });

  it("does not redefine the inbox list or message list functions", () => {
    expect(migration).not.toContain("create or replace function public.homlo_list_messages");
    expect(migration).not.toContain("create or replace function public.homlo_list_conversations");
  });

  it("has no DELETE/DROP statements (ON DELETE SET NULL FK clauses are allowed)", () => {
    const body = migration.replace(/--[^\n]*/g, "");
    expect(body).not.toMatch(/\bdelete\b\s+from/i);
    expect(body).not.toMatch(/\bdrop\b\s+(table|index|function|column|constraint)/i);
  });

  it("leaves the existing per-application uniqueness index intact", () => {
    expect(migration).not.toContain("uq_conversations_application");
  });

  it("is wrapped in a transaction", () => {
    expect(migration).toContain("begin;");
    expect(migration).toContain("commit;");
  });
});
