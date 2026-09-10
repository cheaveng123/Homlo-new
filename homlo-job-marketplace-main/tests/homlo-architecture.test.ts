import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const migrationRoot = join(projectRoot, "backend", "database", "migrations");

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const children = await Promise.all(entries.map(async (entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : entry.name.endsWith(".ts") ? [join(directory, entry.name)] : []));
  return children.flat();
}

function relativeToRoot(file: string): string {
  return file.replace(projectRoot, "").replaceAll("\\", "/");
}

describe("Homlo portable backend architecture", () => {
  it("keeps the eight immutable migration files in dependency order", async () => {
    const migrations = (await readdir(migrationRoot)).filter((name) => /^00[1-8]_.*\.sql$/.test(name)).sort();
    expect(migrations).toEqual([
      "001_core_identity.sql", "002_categories_jobs.sql", "003_applications.sql", "004_messaging.sql",
      "005_saved_jobs_notifications.sql", "006_reviews.sql", "007_boosts_payments.sql", "008_moderation_audit.sql",
    ]);
  });

  it("contains Supabase client usage only inside the designated adapter", async () => {
    const files = await sourceFiles(join(projectRoot, "backend"));
    const imports = await Promise.all(files.map(async (file) => ({ file, content: await readFile(file, "utf8") })));
    const supabaseClientImports = imports.filter(({ content }) => content.includes("@supabase/supabase-js"));
    expect(supabaseClientImports.map(({ file }) => relativeToRoot(file))).toEqual(["/backend/infrastructure/database/SupabaseAdapter.ts"]);
  });

  it("keeps storage URLs behind the storage adapter boundary", async () => {
    const files = await sourceFiles(join(projectRoot, "backend"));
    const sources = await Promise.all(files.map(async (file) => ({ file, content: await readFile(file, "utf8") })));
    const directStorageOperations = sources.filter(({ content }) => content.includes(".storage.from("));
    expect(directStorageOperations.map(({ file }) => relativeToRoot(file))).toEqual(["/backend/infrastructure/database/SupabaseAdapter.ts"]);
  });
});
