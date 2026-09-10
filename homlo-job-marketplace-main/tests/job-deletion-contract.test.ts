import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const project = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("employer job deletion contract", () => {
  it("permanently deletes only the authenticated employer's job and reserves the RPC for service role", () => {
    const migration = project("backend/database/migrations/014_employer_job_deletion.sql");

    expect(migration).toContain("create or replace function public.homlo_delete_job");
    expect(migration).toMatch(/delete from jobs[\s\S]*where id = p_job_id[\s\S]*and employer_id = p_employer_id/i);
    expect(migration).toContain("Only the listing employer can delete this job");
    expect(migration).toContain("revoke all on function public.homlo_delete_job(uuid, uuid) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.homlo_delete_job(uuid, uuid) to service_role");
  });

  it("exposes deletion only through the server-verified gateway and Supabase-protected employer route", () => {
    const gateway = project("supabase/functions/homlo-service-gateway/index.ts");
    const router = project("server/routers.ts");

    expect(gateway).toContain('action === "employer.delete-job"');
    expect(gateway).toContain('"homlo_delete_job"');
    expect(router).toContain("deleteJob: supabaseProtectedProcedure");
    expect(router).toContain('"employer.delete-job"');
  });
});
