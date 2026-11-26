/**
 * Public app settings.
 *
 * Only variables whose name starts with PUBLIC_ (from .env or the shell) are
 * visible to the app: `process.env.PUBLIC_API_BASE_URL` is replaced with the
 * value at bundle time. Everything else in .env (server secrets such as
 * SUPABASE_SERVICE_ROLE_KEY) never reaches the app binary.
 *
 * Shell variables win over .env. After changing a value, restart Metro
 * (metro.config.js keys its cache on these values, so it re-bundles).
 */
const fs = require("node:fs");
const path = require("node:path");

const PREFIX = "PUBLIC_";

function loadPublicEnv(projectRoot = path.resolve(__dirname, "..")) {
  const out = {};
  const envPath = path.join(projectRoot, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      if (!line || line.trim().startsWith("#")) continue;
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && m[1].startsWith(PREFIX)) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith(PREFIX) && v !== undefined) out[k] = v;
  }
  return out;
}

/** Babel plugin: inlines process.env.PUBLIC_* (unset ones become undefined). */
function publicEnvPlugin({ types: t }) {
  const values = loadPublicEnv();
  return {
    name: "hirenow-public-env",
    visitor: {
      MemberExpression(p) {
        const { node } = p;
        if (!t.isMemberExpression(node.object)) return;
        const obj = node.object;
        if (!t.isIdentifier(obj.object, { name: "process" }) || !t.isIdentifier(obj.property, { name: "env" })) return;
        const key = node.computed
          ? t.isStringLiteral(node.property) && node.property.value
          : t.isIdentifier(node.property) && node.property.name;
        if (!key || !key.startsWith(PREFIX)) return;
        if (p.parentPath.isAssignmentExpression({ left: node })) return;
        p.replaceWith(key in values ? t.stringLiteral(values[key]) : t.identifier("undefined"));
      },
    },
  };
}

module.exports = publicEnvPlugin;
module.exports.loadPublicEnv = loadPublicEnv;
