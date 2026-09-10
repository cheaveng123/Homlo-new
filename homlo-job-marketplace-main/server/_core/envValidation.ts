type Issue = { variable: string; problem: string };

const ERROR_HEADING = "Homlo environment configuration is invalid.";

function describeSupabaseUrl(raw: string | undefined): { ok: true; value: string } | { ok: false; problem: string } {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, problem: "value is missing or empty" };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, problem: "value is not a parseable URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, problem: "URL must use the https scheme" };
  }
  if (!parsed.hostname.endsWith(".supabase.co")) {
    return { ok: false, problem: "URL host must be a *.supabase.co project host" };
  }
  return { ok: true, value: raw.replace(/\/+$/, "") };
}

function describeSupabaseServiceRoleKey(raw: string | undefined): { ok: true } | { ok: false; problem: string } {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, problem: "value is missing or empty" };
  }
  if (raw.length < 20) {
    return { ok: false, problem: "value is shorter than the expected service-role key length" };
  }
  return { ok: true };
}

function describeSupabaseDatabaseUrl(raw: string | undefined): { ok: true } | { ok: false; problem: string } {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, problem: "value is missing or empty" };
  }
  if (!/^postgres(?:ql)?:\/\//i.test(raw)) {
    return { ok: false, problem: "URL must start with postgres:// or postgresql://" };
  }
  const shapeOk = /^postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@[^/:?\s]+(?::\d+)?\/[^?\s]+(?:\?[^#\s]*)?$/i.test(raw);
  if (!shapeOk) {
    return { ok: false, problem: "URL is not a valid PostgreSQL connection string (expected user:password@host:port/database)" };
  }
  return { ok: true };
}

function formatIssues(issues: Issue[]): string {
  const lines = issues.map((issue) => `  - ${issue.variable}: ${issue.problem}`);
  return [`${ERROR_HEADING}`, ...lines, "Refer to backend/ENVIRONMENT.md for the required variables."].join("\n");
}

export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env): {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseDbUrl: string;
} {
  const issues: Issue[] = [];

  const urlResult = describeSupabaseUrl(env.SUPABASE_URL);
  if (!urlResult.ok) {
    issues.push({ variable: "SUPABASE_URL", problem: urlResult.problem });
  }

  const keyResult = describeSupabaseServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY);
  if (!keyResult.ok) {
    issues.push({ variable: "SUPABASE_SERVICE_ROLE_KEY", problem: keyResult.problem });
  }

  const dbResult = describeSupabaseDatabaseUrl(env.SUPABASE_DB_URL);
  if (!dbResult.ok) {
    issues.push({ variable: "SUPABASE_DB_URL", problem: dbResult.problem });
  }

  if (issues.length > 0) {
    throw new Error(formatIssues(issues));
  }

  return {
    supabaseUrl: (urlResult as { ok: true; value: string }).value,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY as string,
    supabaseDbUrl: env.SUPABASE_DB_URL as string,
  };
}
