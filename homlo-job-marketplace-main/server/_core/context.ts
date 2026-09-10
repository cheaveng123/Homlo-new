import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getHomloDirectService, type HomloSessionUser } from "../homlo-direct-service";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  homloUser: HomloSessionUser | null;
  supabaseAccessToken: string | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let homloUser: HomloSessionUser | null = null;
  let supabaseAccessToken: string | null = null;

  try {
    const directService = getHomloDirectService();
    supabaseAccessToken = directService.getAccessToken(opts.req);
    if (supabaseAccessToken) homloUser = await directService.resolveSession(supabaseAccessToken);
  } catch {
    homloUser = null;
    supabaseAccessToken = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user: null,
    homloUser,
    supabaseAccessToken,
  };
}
