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
import { getRpcRouteConfig } from './ibm-rpc-routes';

// ── Types ──────────────────────────────────────────────────────────────────

type FilterValue = string | number | boolean | null | unknown;

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


function getApiOrigins(): string[] {
  const configuredOrigin = (IBM_CONFIG.database.functionsBaseUrl || '').replace(/\/$/, '');
  const origins = configuredOrigin ? [configuredOrigin] : [];

  if (typeof window !== 'undefined') {
    const sameOrigin = window.location.origin.replace(/\/$/, '');
    if (sameOrigin && !origins.includes(sameOrigin)) {
      origins.push(sameOrigin);
    }
  }

  return origins;
}

// ── Request deduplication & rate-limit backoff ────────────────────────────

const inflightRequests = new Map<string, Promise<Response>>();
let rateLimitBackoffUntil = 0;

function dedupeKey(path: string, init: RequestInit): string {
  return `${init.method || 'GET'}:${path}:${init.body || ''}`;
}

async function fetchWithOriginFallback(path: string, init: RequestInit): Promise<Response> {
  // If we're in a rate-limit backoff window, reject immediately
  if (Date.now() < rateLimitBackoffUntil) {
    throw new Error(`Rate limited — retrying after backoff (${Math.ceil((rateLimitBackoffUntil - Date.now()) / 1000)}s remaining)`);
  }

  // Deduplicate identical in-flight requests
  const key = dedupeKey(path, init);
  const existing = inflightRequests.get(key);
  if (existing) {
    console.info(`[ibmDb] ↩ Deduped ${init.method || 'GET'} ${path}`);
    return existing.then(r => r.clone());
  }

  const promise = _doFetch(path, init).finally(() => {
    inflightRequests.delete(key);
  });
  inflightRequests.set(key, promise);
  return promise;
}

async function _doFetch(path: string, init: RequestInit): Promise<Response> {
  const origins = getApiOrigins();
  let lastError: unknown = null;

  for (const origin of origins) {
    const url = `${origin}${path}`;
    try {
      const resp = await fetch(url, init);
      const ct = resp.headers.get('content-type') || '';
      if (resp.ok && ct.includes('text/html')) {
        console.warn(`[ibmDb] Got HTML response from ${url}, skipping...`);
        lastError = new Error(`HTML response from ${url}`);
        continue;
      }
      console.info(`[ibmDb] ✓ ${init.method || 'GET'} ${url} → ${resp.status}`);
      return resp;
    } catch (error) {
      lastError = error;
      console.warn(`[ibmDb] ✗ Network fetch failed for ${url}:`, (error as Error)?.message);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Network request failed for ${path}`);
}

// ── Query Builder ──────────────────────────────────────────────────────────

class IBMQueryBuilder<T = any> {
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

  /**
   * PostgREST-style OR filter string.
   * Stored as a special filter and sent as `or` query param.
   * Example: `.or('first_name.ilike.%foo%,last_name.ilike.%foo%')`
   */
  or(filterString: string): IBMQueryBuilder<T> {
    return this.addFilter('or', '__or__', filterString);
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
      if (f.type === 'or' && f.column === '__or__') {
        params.set('or', String(f.value));
        continue;
      }
      // eq filter — only for allowed columns
      if (f.type === 'eq' && allowed.has(f.column) && f.value != null) {
        params.set(f.column, String(f.value));
      }
      // in filter — pass as comma-separated list
      if (f.type === 'in' && f.value != null) {
        const values = Array.isArray(f.value) ? f.value.join(',') : String(f.value);
        params.set(`${f.column}__in`, values);
      }
      // Comparison filters
      if (f.type === 'gte' && f.value != null) {
        params.set(`${f.column}__gte`, String(f.value));
      }
      if (f.type === 'gt' && f.value != null) {
        params.set(`${f.column}__gt`, String(f.value));
      }
      if (f.type === 'lte' && f.value != null) {
        params.set(`${f.column}__lte`, String(f.value));
      }
      if (f.type === 'lt' && f.value != null) {
        params.set(`${f.column}__lt`, String(f.value));
      }
      if (f.type === 'neq' && f.value != null) {
        params.set(`${f.column}__neq`, String(f.value));
      }
      if (f.type === 'ilike' && f.value != null) {
        params.set(`${f.column}__ilike`, String(f.value));
      }
      if (f.type === 'like' && f.value != null) {
        params.set(`${f.column}__like`, String(f.value));
      }
      if (f.type === 'is') {
        params.set(`${f.column}__is`, String(f.value));
      }
    }

    if (this.state.limitCount) {
      params.set('limit', String(this.state.limitCount));
    }

    if (this.state.rangeFrom != null && this.state.rangeTo != null) {
      params.set('offset', String(this.state.rangeFrom));
      params.set('limit', String(this.state.rangeTo - this.state.rangeFrom + 1));
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

    const headers = await buildHeaders();

    try {
      switch (this.state.operation) {
        // ── SELECT ──────────────────────────────────────────
        case 'select': {
          const id = this.getIdFilter();

          // GET /:id  — single-resource fetch
          if (id && route.supportsGetById) {
            const resp = await fetchWithOriginFallback(`${route.basePath}/${id}`, { headers });
            if (!resp.ok) return this.handleError(resp);
            const json = await resp.json();
            // Single-resource endpoints return the object directly
            return { data: [json] as T[], error: null, count: 1 };
          }

          // GET / — list with query params
          const qp = this.buildQueryParams(route);
          const qs = qp.toString();
          const path = `${route.basePath}${qs ? `?${qs}` : ''}`;
          const resp = await fetchWithOriginFallback(path, { headers });
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
          const resp = await fetchWithOriginFallback(route.basePath, {
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
          const resp = await fetchWithOriginFallback(`${route.basePath}/${id}`, {
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
          const resp = await fetchWithOriginFallback(`${route.basePath}/${id}`, {
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
  from<T = any>(table: string): IBMQueryBuilder<T> {
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

      const routeConfig = getRpcRouteConfig(fn);

      if (routeConfig) {
        // Use individual REST endpoint
        let path = routeConfig.path;

        if (routeConfig.method === 'GET' && params && routeConfig.paramsIn === 'query') {
          const qp = new URLSearchParams();
          for (const [k, v] of Object.entries(params)) {
            if (v != null) qp.set(k, String(v));
          }
          const qs = qp.toString();
          if (qs) path += `?${qs}`;
        }

        const fetchOpts: RequestInit = { method: routeConfig.method, headers };
        if (routeConfig.method !== 'GET' && params) {
          fetchOpts.body = JSON.stringify(params);
        }

        const response = await fetchWithOriginFallback(path, fetchOpts);
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          return { data: null, error: new Error(errBody.message || errBody.error || response.statusText) };
        }
        const result = await response.json();
        return { data: result as T, error: null };
      }

      // Fallback: generic /rpc/:name for unmapped functions
      console.warn(`[ibmDb.rpc] No dedicated route for "${fn}", using generic /rpc/${fn}`);
      const response = await fetchWithOriginFallback(`/api/v1/rpc/${fn}`, {
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


  /**
   * Edge-function-style invocations routed through hbf-api.
   * Mirrors `supabase.functions.invoke(name, { body })`.
   */
  get functions() {
    const self = this;
    return {
      async invoke(fnName: string, options?: { body?: Record<string, unknown> }) {
        try {
          const headers = await buildHeaders();
          const response = await fetchWithOriginFallback(`/api/v1/functions/${fnName}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(options?.body ?? {}),
          });
          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            return { data: null, error: new Error(errBody.message || errBody.error || response.statusText) };
          }
          const result = await response.json();
          return { data: result, error: null };
        } catch (err) {
          return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
        }
      },
    };
  }
}

export const ibmDb = new IBMDatabaseClient();
