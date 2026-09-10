import { readFile, writeFile } from "node:fs/promises";

const [functionName, sourceFile, outputFile, verifyJwtRaw] = process.argv.slice(2);

if (!functionName || !sourceFile || !outputFile) {
  throw new Error("Usage: node scripts/create-edge-function-input.mjs <function-name> <source-file> <output-json>");
}

const source = await readFile(sourceFile, "utf8");

await writeFile(
  outputFile,
  `${JSON.stringify({
    project_id: "gwzknvycbzloomxhvslo",
    name: functionName,
    verify_jwt: verifyJwtRaw !== "false",
    entrypoint_path: "index.ts",
    files: [{ name: "index.ts", content: source }],
  }, null, 2)}\n`,
  "utf8",
);
