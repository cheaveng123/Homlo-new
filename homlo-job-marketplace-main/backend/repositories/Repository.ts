import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";

/** Base class shared by portable SQL repository implementations. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- documents the model type for subclasses
export abstract class Repository<Model> {
  protected constructor(protected readonly database: DatabaseAdapter) {}
  abstract readonly modelName: string;
}
