import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";

/** Base class shared by portable SQL repository implementations. */
export abstract class Repository<Model> {
  protected constructor(protected readonly database: DatabaseAdapter) {}
  abstract readonly modelName: string;
}
