/**
 * IBM Cloud Database Client — REST Adapter
 *
 * Translates Supabase-style query builder calls into REST requests
 * against hbf-api's specific versioned routes (/api/v1/leads, etc.).
 *
 * Usage is identical to the Supabase client:
 *   ibmDb.from('leads').select('*').eq('status', 'new')
 *
 * Under the hood each operation maps to the correct HTTP verb:
 *   select  → GET  /api/v1/leads?status=new
 *   insert  → POST /api/v1/leads
 *   update  → PUT  /api/v1/leads/:id
 *   delete  → DELETE /api/v1/leads/:id
 */

import { IBM_CONFIG } from './ibm-config';
import { ibmAuth } from './ibm-auth';
import { getRouteConfig, type RouteConfig } from './ibm-route-map';

// ── Types ──────────────────────────────────────────────────────────────────

type FilterValue = string | number | boolean | null;

interface Filter {
  type: string;
  column: string;
  value: unknown;
}

interface QueryState {
  table: string;
  route: RouteConfig | null;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  columns: string;
  data?: unknown;
  filters: Filter[];
  orderBy?: { column: string; ascending: boolean };
  limitCount?: number;
  rangeFrom?: number;
  rangeTo?: number;
}

// ── Shared auth headers builder ────────────────────────────────────────────

async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const session = await ibmAuth.getSession();
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }
  if (IBM_CONFIG.database.apiKey) {
    headers['x-api-key'] = IBM_CONFIG.database.apiKey;
  }
  return headers;
}

// ── Query Builder ──────────────────────────────────────────────────────────

class IBMQueryBuilder<T = Record<string, unknown>> {
  private state: QueryState;

  constructor(state: QueryState) {
    this.state = { ...state };
  }

  // ── Operation setters ─────────────────

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

  upsert(data: Partial<T> | Partial<T>[]): IBMQueryBuilder<T> {
    // Upsert isn't natively supported by REST routes — falls back to insert
    return new IBMQueryBuilder<T>({ ...this.state, operation: 'insert', data });
  }

  // ── Filters ───────────────────────────

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

  not(column: string, operator: string, value: unknown): IBMQueryBuilder<T> {
    return this.addFilter('not', column, { operator, value });
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

  // ── Terminal methods ──────────────────

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
    onfulfilled: (value: { data: T[] | null; error: Error | null; count?: number }) => R,
  ): Promise<R> {
    return this.execute().then(onfulfilled);
  }

  // ── Internal helpers ──────────────────

  private addFilter(type: string, column: string, value: unknown): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({
      ...this.state,
      filters: [...this.state.filters, { type, column, value }],
    });
  }

  /** Extract the `id` value from an `eq('id', ...)` filter, if present. */
  private getIdFilter(): string | null {
    const idFilter = this.state.filters.find((f) => f.column === 'id' && f.type === 'eq');
    return idFilter ? String(idFilter.value) : null;
  }

  /**
   * Build query-string params from filters that the route supports.
   * Filters on columns NOT in the route's filterParams are silently skipped
   * (the server doesn't support arbitrary WHERE clauses via query params).
   */
  private buildQueryParams(route: RouteConfig): URLSearchParams {
    const params = new URLSearchParams();
    const allowed = new Set(route.filterParams ?? []);

    for (const f of this.state.filters) {
      if (f.type === 'eq' && allowed.has(f.column) && f.value != null) {
        params.set(f.column, String(f.value));
      }
    }

    if (this.state.limitCount && allowed.has('limit')) {
      params.set('limit', String(this.state.limitCount));
    }

    return params;
  }

  // ── Execute ───────────────────────────

  private async execute(): Promise<{ data: T[] | null; error: Error | null; count?: number }> {
    const { route, table } = this.state;

    if (!route) {
      return {
        data: null,
        error: new Error(
          `Table "${table}" has no REST route mapped in hbf-api. ` +
            `Add a route to hbf-api or update ibm-route-map.ts.`,
        ),
      };
    }

    const baseUrl = IBM_CONFIG.database.functionsBaseUrl;
    const headers = await buildHeaders();

    try {
      switch (this.state.operation) {
        // ── SELECT ──────────────────────────────────────────
        case 'select': {
          const id = this.getIdFilter();

          // GET /:id  — single-resource fetch
          if (id && route.supportsGetById) {
            const resp = await fetch(`${baseUrl}${route.basePath}/${id}`, { headers });
            if (!resp.ok) return this.handleError(resp);
            const json = await resp.json();
            // Single-resource endpoints return the object directly
            return { data: [json] as T[], error: null, count: 1 };
          }

          // GET / — list with query params
          const qp = this.buildQueryParams(route);
          const qs = qp.toString();
          const url = `${baseUrl}${route.basePath}${qs ? `?${qs}` : ''}`;
          const resp = await fetch(url, { headers });
          if (!resp.ok) return this.handleError(resp);
          const json = await resp.json();

          const rows: T[] =
            route.dataKey === 'root'
              ? (Array.isArray(json) ? json : [json])
              : (json[route.dataKey] ?? []);

          return { data: rows, error: null, count: rows.length };
        }

        // ── INSERT ──────────────────────────────────────────
        case 'insert': {
          const body = Array.isArray(this.state.data) ? this.state.data[0] : this.state.data;
          const resp = await fetch(`${baseUrl}${route.basePath}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });
          if (!resp.ok) return this.handleError(resp);
          const json = await resp.json();
          return { data: [json] as T[], error: null };
        }

        // ── UPDATE ──────────────────────────────────────────
        case 'update': {
          const id = this.getIdFilter();
          if (!id) {
            return { data: null, error: new Error('update requires .eq("id", value)') };
          }
          const resp = await fetch(`${baseUrl}${route.basePath}/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(this.state.data),
          });
          if (!resp.ok) return this.handleError(resp);
          const json = await resp.json();
          return { data: [json] as T[], error: null };
        }

        // ── DELETE ──────────────────────────────────────────
        case 'delete': {
          if (!route.supportsDelete) {
            return { data: null, error: new Error(`DELETE not supported for "${table}"`) };
          }
          const id = this.getIdFilter();
          if (!id) {
            return { data: null, error: new Error('delete requires .eq("id", value)') };
          }
          const resp = await fetch(`${baseUrl}${route.basePath}/${id}`, {
            method: 'DELETE',
            headers,
          });
          if (!resp.ok) return this.handleError(resp);
          const json = await resp.json();
          return { data: json ? [json as T] : [], error: null };
        }

        default:
          return { data: null, error: new Error(`Unsupported operation: ${this.state.operation}`) };
      }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  private async handleError(resp: Response): Promise<{ data: null; error: Error }> {
    const body = await resp.json().catch(() => ({}));
    const msg = body?.error?.message ?? body?.error ?? resp.statusText;
    return { data: null, error: new Error(msg) };
  }
}

// ── Client ─────────────────────────────────────────────────────────────────

class IBMDatabaseClient {
  from<T = Record<string, unknown>>(table: string): IBMQueryBuilder<T> {
    return new IBMQueryBuilder<T>({
      table,
      route: getRouteConfig(table),
      operation: 'select',
      columns: '*',
      filters: [],
    });
  }

  async rpc<T = unknown>(
    fn: string,
    params?: Record<string, unknown>,
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      const headers = await buildHeaders();
      const baseUrl = IBM_CONFIG.database.functionsBaseUrl;
      const response = await fetch(`${baseUrl}/api/v1/rpc/${fn}`, {
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
