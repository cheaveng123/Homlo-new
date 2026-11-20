// Minimal types for the `compression` Express middleware (no bundled types,
// and @types/compression is not installed). Only what server/_core uses.
declare module "compression" {
  import type { RequestHandler, Request, Response } from "express";
  type CompressionOptions = {
    threshold?: number | string;
    level?: number;
    filter?: (req: Request, res: Response) => boolean;
  };
  type CompressionFactory = ((options?: CompressionOptions) => RequestHandler) & {
    filter: (req: Request, res: Response) => boolean;
  };
  const compression: CompressionFactory;
  export default compression;
}
