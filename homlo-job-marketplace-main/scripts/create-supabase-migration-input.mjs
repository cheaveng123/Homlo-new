import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const [migrationFile, outputFile] = process.argv.slice(2);

if (!migrationFile || !outputFile) {
  throw new Error("Usage: node scripts/create-supabase-migration-input.mjs <migration-file> <output-json>");
}

const query = await readFile(resolve(migrationFile), "utf8");
const name = basename(migrationFile, ".sql");

await writeFile(
  resolve(outputFile),
  `${JSON.stringify({ project_id: "gwzknvycbzloomxhvslo", name, query }, null, 2)}\n`,
  "utf8",
);
