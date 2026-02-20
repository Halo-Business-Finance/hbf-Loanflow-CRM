/**
 * IBM Cloud Database Client
 *
 * The frontend never connects to IBM Cloud Databases for PostgreSQL directly.
 * All queries go through IBM Cloud Functions (Code Engine) endpoints — the same
 * pattern Supabase uses with its PostgREST layer.
 *
 * This adapter wraps those HTTP calls to match the Supabase client shape so
 * migration is a drop-in swap:
 *
 *   Before: supabase.from('leads').select('*')
 *   After:  ibmDb.from('leads').select('*')
 */

import { IBM_CONFIG } from './ibm-config';
import { ibmAuth } from './ibm-auth';

type FilterValue = string | number | boolean | null;

interface QueryBuilder<T = Record<string, unknown>> {
  select: (columns?: string) => QueryBuilder<T>;
  insert: (data: Partial<T> | Partial<T>[]) => QueryBuilder<T>;
  update: (data: Partial<T>) => QueryBuilder<T>;
  delete: () => QueryBuilder<T>;
  upsert: (data: Partial<T> | Partial<T>[], options?: { onConflict?: string }) => QueryBuilder<T>;
  eq: (column: string, value: FilterValue) => QueryBuilder<T>;
  neq: (column: string, value: FilterValue) => QueryBuilder<T>;
  gt: (column: string, value: FilterValue) => QueryBuilder<T>;
  gte: (column: string, value: FilterValue) => QueryBuilder<T>;
  lt: (column: string, value: FilterValue) => QueryBuilder<T>;
  lte: (column: string, value: FilterValue) => QueryBuilder<T>;
  like: (column: string, value: string) => QueryBuilder<T>;
  ilike: (column: string, value: string) => QueryBuilder<T>;
  in: (column: string, values: FilterValue[]) => QueryBuilder<T>;
  is: (column: string, value: null | boolean) => QueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
  range: (from: number, to: number) => QueryBuilder<T>;
  single: () => Promise<{ data: T | null; error: Error | null }>;
  maybeSingle: () => Promise<{ data: T | null; error: Error | null }>;
  then: <R>(onfulfilled: (value: { data: T[] | null; error: Error | null; count?: number }) => R) => Promise<R>;
}

interface QueryState {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  columns: string;
  data?: unknown;
  upsertOptions?: { onConflict?: string };
  filters: Array<{ type: string; column: string; value: unknown }>;
  orderBy?: { column: string; ascending: boolean };
  limitCount?: number;
  rangeFrom?: number;
  rangeTo?: number;
}

class IBMQueryBuilder<T = Record<string, unknown>> implements QueryBuilder<T> {
  private state: QueryState;

  constructor(state: QueryState) {
    this.state = { ...state };
  }

  select(columns = '*'): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({ ...this.state, operation: 'select', columns });
  }

  insert(data: Partial<T> | Partial<T>[]): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({ ...this.state, operation: 'insert', data });
  }

  update(data: Partial<T>): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({ ...this.state, operation: 'update', data });
  }

  delete(): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({ ...this.state, operation: 'delete' });
  }

  upsert(data: Partial<T> | Partial<T>[], options?: { onConflict?: string }): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({ ...this.state, operation: 'upsert', data, upsertOptions: options });
  }

  eq(column: string, value: FilterValue): IBMQueryBuilder<T> {
    return this.addFilter('eq', column, value);
  }

  neq(column: string, value: FilterValue): IBMQueryBuilder<T> {
    return this.addFilter('neq', column, value);
  }

  gt(column: string, value: FilterValue): IBMQueryBuilder<T> {
    return this.addFilter('gt', column, value);
  }

  gte(column: string, value: FilterValue): IBMQueryBuilder<T> {
    return this.addFilter('gte', column, value);
  }

  lt(column: string, value: FilterValue): IBMQueryBuilder<T> {
    return this.addFilter('lt', column, value);
  }

  lte(column: string, value: FilterValue): IBMQueryBuilder<T> {
    return this.addFilter('lte', column, value);
  }

  like(column: string, value: string): IBMQueryBuilder<T> {
    return this.addFilter('like', column, value);
  }

  ilike(column: string, value: string): IBMQueryBuilder<T> {
    return this.addFilter('ilike', column, value);
  }

  in(column: string, values: FilterValue[]): IBMQueryBuilder<T> {
    return this.addFilter('in', column, values);
  }

  is(column: string, value: null | boolean): IBMQueryBuilder<T> {
    return this.addFilter('is', column, value);
  }

  order(column: string, options: { ascending?: boolean } = {}): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({
      ...this.state,
      orderBy: { column, ascending: options.ascending !== false },
    });
  }

  limit(count: number): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({ ...this.state, limitCount: count });
  }

  range(from: number, to: number): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({ ...this.state, rangeFrom: from, rangeTo: to });
  }

  async single(): Promise<{ data: T | null; error: Error | null }> {
    const result = await this.execute();
    const rows = result.data as T[] | null;
    if (!rows || rows.length === 0) {
      return { data: null, error: new Error('No rows returned') };
    }
    return { data: rows[0], error: null };
  }

  async maybeSingle(): Promise<{ data: T | null; error: Error | null }> {
    const result = await this.execute();
    const rows = result.data as T[] | null;
    return { data: rows?.[0] ?? null, error: result.error };
  }

  then<R>(
    onfulfilled: (value: { data: T[] | null; error: Error | null; count?: number }) => R
  ): Promise<R> {
    return this.execute().then(onfulfilled);
  }

  private addFilter(type: string, column: string, value: unknown): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({
      ...this.state,
      filters: [...this.state.filters, { type, column, value }],
    });
  }

  private async execute(): Promise<{ data: T[] | null; error: Error | null; count?: number }> {
    try {
      const session = await ibmAuth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.accessToken) {
        headers['Authorization'] = `Bearer ${session.accessToken}`;
      }
      if (IBM_CONFIG.database.apiKey) {
        headers['x-api-key'] = IBM_CONFIG.database.apiKey;
      }

      const baseUrl = IBM_CONFIG.database.functionsBaseUrl;
      const response = await fetch(`${baseUrl}/api/v1/db-gateway`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          table: this.state.table,
          operation: this.state.operation,
          columns: this.state.columns,
          data: this.state.data,
          filters: this.state.filters,
          orderBy: this.state.orderBy,
          limit: this.state.limitCount,
          range: this.state.rangeFrom !== undefined
            ? { from: this.state.rangeFrom, to: this.state.rangeTo }
            : undefined,
          upsertOptions: this.state.upsertOptions,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        return { data: null, error: new Error(errBody.message || response.statusText) };
      }

      const result = await response.json();
      return { data: result.data, error: null, count: result.count };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

class IBMDatabaseClient {
  from<T = Record<string, unknown>>(table: string): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({
      table,
      operation: 'select',
      columns: '*',
      filters: [],
    });
  }

  async rpc<T = unknown>(
    fn: string,
    params?: Record<string, unknown>
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      const session = await ibmAuth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.accessToken) {
        headers['Authorization'] = `Bearer ${session.accessToken}`;
      }
      if (IBM_CONFIG.database.apiKey) {
        headers['x-api-key'] = IBM_CONFIG.database.apiKey;
      }

      const response = await fetch(`${IBM_CONFIG.database.functionsBaseUrl}/api/v1/rpc/${fn}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params ?? {}),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        return { data: null, error: new Error(errBody.message || response.statusText) };
      }

      const result = await response.json();
      return { data: result as T, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

export const ibmDb = new IBMDatabaseClient();
