import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "backend/database/migrations/050_sync_live_messaging_schema.sql"),
  "utf8",
);

describe("050_sync_live_messaging_schema.sql contract", () => {
  it("is wrapped in a transaction", () => {
    expect(migration).toContain("begin;");
    expect(migration).toContain("commit;");
  });

  it("adds messages.application_id with if not exists", () => {
    expect(migration).toContain(
      "alter table public.messages\n  add column if not exists application_id uuid",
    );
    expect(migration).toContain(
      "references public.applications(id) on delete set null",
    );
    expect(migration).toContain(
      "create index if not exists idx_messages_application_id",
    );
  });

  it("adds conversations.user_low and user_high with if not exists", () => {
    expect(migration).toContain(
      "alter table public.conversations\n  add column if not exists user_low uuid",
    );
    expect(migration).toContain(
      "alter table public.conversations\n  add column if not exists user_high uuid",
    );
  });

  it("adds a unique index on the non-deleted pair with if not exists", () => {
    expect(migration).toContain(
      "create unique index if not exists conversations_pair_unique",
    );
    expect(migration).toContain("and deleted_at is null");
  });

  it("backfills user_low / user_high for exactly-two-member conversations", () => {
    expect(migration).toContain("update public.conversations c");
    expect(migration).toContain("set user_low = pc.user_low,");
    expect(migration).toContain("user_high = pc.user_high");
    expect(migration).toContain("least(cm.user_id, cm2.user_id)");
    expect(migration).toContain("greatest(cm.user_id, cm2.user_id)");
    expect(migration).toContain("c.user_low is null or c.user_high is null");
  });

  it("backfills messages.application_id only where null", () => {
    expect(migration).toContain("update public.messages m");
    expect(migration).toContain("set application_id = c.application_id");
    expect(migration).toContain("where c.id = m.conversation_id");
    expect(migration).toContain("and m.application_id is null");
  });

  it("get_or_create looks up by pair among non-deleted conversations", () => {
    expect(migration).toContain("where c.user_low = v_user_low");
    expect(migration).toContain("and c.user_high = v_user_high");
    expect(migration).toContain("and c.deleted_at is null");
    expect(migration).toContain("order by c.last_message_at desc nulls last");
    expect(migration).toContain("limit 1");
    expect(migration).toContain("pg_advisory_xact_lock(");
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
    expect(migration).toContain("security definer");
  });

  it("get_or_create does not overwrite application_id on reuse", () => {
    // Reuse path only selects the existing conversation, preserving
    // last_message_at (inbox ordering unchanged).
    const reuseSlice = migration.slice(
      migration.indexOf("if v_existing_id is not null then"),
      migration.indexOf("end if;\n\n  insert into conversations"),
    );
    expect(reuseSlice).toContain("select * into v_conversation");
    expect(reuseSlice).not.toContain("last_message_at");
    expect(reuseSlice).not.toContain("application_id =");
  });

  it("send_message keeps the same signature", () => {
    expect(migration).toContain(
      "create or replace function public.homlo_send_message(\n  p_conversation_id uuid,\n  p_sender_id uuid,\n  p_message text\n)",
    );
    expect(migration).toContain("returns messages");
    expect(migration).toContain("security definer");
  });

  it("send_message writes messages.application_id from the conversation", () => {
    expect(migration).toContain("v_conversation.application_id");
  });

  it("does not redefine homlo_list_messages or homlo_list_conversations", () => {
    expect(migration).not.toContain("homlo_list_messages");
    expect(migration).not.toContain("homlo_list_conversations");
  });

  it("does not delete or drop rows / tables / functions", () => {
    const body = migration.replace(/--[^\n]*/g, "");
    expect(body).not.toMatch(/\bdelete\b\s+from/i);
    expect(body).not.toMatch(/\bdrop\b\s+(table|index|function|column|constraint)/i);
  });

  it("does not touch uq_conversations_application", () => {
    expect(migration).not.toContain("uq_conversations_application");
  });

  it("re-asserts grants for the two redefined functions", () => {
    expect(migration).toContain(
      "grant execute on function public.homlo_get_or_create_conversation(uuid, uuid) to service_role",
    );
    expect(migration).toContain(
      "grant execute on function public.homlo_send_message(uuid, uuid, text) to service_role",
    );
  });
});
