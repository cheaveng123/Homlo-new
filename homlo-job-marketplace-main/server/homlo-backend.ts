import { SupabaseAuthAdapter } from "../backend/infrastructure/auth/SupabaseAuthAdapter";
import { SupabaseAdapter } from "../backend/infrastructure/database/SupabaseAdapter";
import type { PaymentProviderAdapter } from "../backend/infrastructure/payments/PaymentProviderAdapter";
import { SupabaseStorageAdapter } from "../backend/infrastructure/storage/SupabaseStorageAdapter";
import { ApplicationService } from "../backend/services/ApplicationService";
import { JobService } from "../backend/services/JobService";
import { MessagingService } from "../backend/services/MessagingService";
import { NotificationService } from "../backend/services/NotificationService";
import { PaymentService } from "../backend/services/PaymentService";
import { AuditLogService, ReportService } from "../backend/services/ReportAuditService";
import { ReviewService } from "../backend/services/ReviewService";
import { UserService } from "../backend/services/UserService";

export type HomloBackendConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseDatabaseUrl: string;
  storageBucket?: string;
};

export type HomloBackend = ReturnType<typeof createHomloBackend>;

/**
 * Server composition root. Route handlers receive this dependency graph and
 * never import a Supabase client or construct a provider URL directly.
 */
export function createHomloBackend(
  config: HomloBackendConfig,
  paymentProviders: Record<string, PaymentProviderAdapter> = {},
) {
  if (!config.supabaseUrl.startsWith("https://")) throw new Error("SUPABASE_URL must be a secure HTTPS project URL");
  if (!config.supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required on the server");
  if (!config.supabaseDatabaseUrl.startsWith("postgres")) throw new Error("SUPABASE_DB_URL must be a Postgres connection URI");

  const database = new SupabaseAdapter({
    url: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
    databaseUrl: config.supabaseDatabaseUrl,
  });
  const storage = new SupabaseStorageAdapter(database, config.storageBucket ?? "homlo-media");

  return {
    database,
    auth: new SupabaseAuthAdapter(database),
    users: new UserService(database),
    jobs: new JobService(database, storage),
    applications: new ApplicationService(database),
    messaging: new MessagingService(database),
    notifications: new NotificationService(database),
    reviews: new ReviewService(database),
    payments: new PaymentService(database, paymentProviders),
    reports: new ReportService(database),
    auditLogs: new AuditLogService(database),
  };
}
