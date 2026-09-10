/** Provider-independent database boundary used by every repository and service. */
export type SqlParameter = string | number | boolean | Date | null | Uint8Array | Record<string, unknown>;

export type QueryResult<Row extends Record<string, unknown>> = {
  rows: Row[];
  rowCount: number;
};

export interface DatabaseAdapter {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters?: readonly SqlParameter[],
  ): Promise<QueryResult<Row>>;
  transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T>;
}
