import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const project = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("applicant notification delivery contract", () => {
  const base = project("backend/database/migrations/005_saved_jobs_notifications.sql");
  const migration = project("backend/database/migrations/036_auto_close_and_notifications.sql");
  const repair = project("backend/database/migrations/037_fix_notification_title_not_null.sql");

  it("declares title NOT NULL on the notifications table these rows insert into", () => {
    expect(base).toContain("title       text not null");
  });

  it("writes a non-null title whenever an applicant notification row is created", () => {
    for (const sql of [migration, repair]) {
      expect(sql).toContain("insert into notifications (user_id, type, title, body, job_id, application_id)");
      expect(sql).toContain("'Application accepted'");
      expect(sql).toContain("'Application update'");
      expect(sql).toContain("'Job filled'");
    }
  });

  it("still exposes only the three applicant-facing types in the read model", () => {
    expect(migration).toContain("n.type in ('application_accepted', 'application_declined', 'job_filled')");
  });
});