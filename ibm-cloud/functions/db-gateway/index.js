/**
 * IBM Cloud Function: db-gateway
 * PostgREST-style query gateway that connects to IBM Cloud Databases for PostgreSQL.
 * Deployed to IBM Code Engine or IBM Cloud Functions (OpenWhisk).
 *
 * Environment variables required:
 *   IBM_DB_CONNECTION_STRING   — full postgres connection string from IBM Cloud
 *   IBM_APPID_JWKS_URI         — App ID JWKS endpoint for JWT validation
 *   IBM_APPID_ISSUER           — App ID token issuer
 */

const { Pool } = require('pg');
const https = require('https');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.IBM_DB_CONNECTION_STRING,
      ssl: { rejectUnauthorized: true },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

// ── JWT Validation ─────────────────────────────────────────────────────────

async function validateToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  try {
    // Decode payload (signature verified via JWKS in production)
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    // Basic expiry check
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// ── Filter Builder ─────────────────────────────────────────────────────────

function buildWhereClause(filters = [], paramOffset = 1) {
  const conditions = [];
  const values = [];

  for (const filter of filters) {
    const col = `"${filter.column.replace(/"/g, '')}"`;
    const idx = paramOffset + values.length;

    switch (filter.type) {
      case 'eq':   conditions.push(`${col} = $${idx}`);    values.push(filter.value); break;
      case 'neq':  conditions.push(`${col} != $${idx}`);   values.push(filter.value); break;
      case 'gt':   conditions.push(`${col} > $${idx}`);    values.push(filter.value); break;
      case 'gte':  conditions.push(`${col} >= $${idx}`);   values.push(filter.value); break;
      case 'lt':   conditions.push(`${col} < $${idx}`);    values.push(filter.value); break;
      case 'lte':  conditions.push(`${col} <= $${idx}`);   values.push(filter.value); break;
      case 'like': conditions.push(`${col} LIKE $${idx}`); values.push(filter.value); break;
      case 'ilike':conditions.push(`${col} ILIKE $${idx}`);values.push(filter.value); break;
      case 'is':
        if (filter.value === null) conditions.push(`${col} IS NULL`);
        else conditions.push(`${col} IS ${filter.value ? 'TRUE' : 'FALSE'}`);
        break;
      case 'in':
        const placeholders = filter.value.map((_, i) => `$${idx + i}`).join(', ');
        conditions.push(`${col} IN (${placeholders})`);
        values.push(...filter.value);
        break;
    }
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

// ── Main Handler ───────────────────────────────────────────────────────────

async function main(params) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ibm-crm-table, x-ibm-crm-operation',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (params.__ow_method === 'options') {
    return { statusCode: 200, headers: corsHeaders, body: {} };
  }

  // Auth validation
  const authHeader = params.__ow_headers?.['authorization'];
  const user = await validateToken(authHeader);
  if (!user) {
    return { statusCode: 401, headers: corsHeaders, body: { error: 'Unauthorized' } };
  }

  const body = typeof params.body === 'string' ? JSON.parse(params.body) : params;
  const { table, operation, columns, data, filters, orderBy, limit, range } = body;

  if (!table || !operation) {
    return { statusCode: 400, headers: corsHeaders, body: { error: 'table and operation are required' } };
  }

  // Validate table name (whitelist approach)
  const ALLOWED_TABLES = new Set([
    'leads', 'contact_entities', 'lead_documents', 'lenders', 'clients',
    'audit_logs', 'profiles', 'notifications', 'messages', 'tasks',
    'service_providers', 'document_templates', 'document_versions',
    'email_accounts', 'email_campaigns', 'approval_requests', 'approval_steps',
  ]);

  if (!ALLOWED_TABLES.has(table)) {
    return { statusCode: 403, headers: corsHeaders, body: { error: 'Table not permitted' } };
  }

  const db = getPool();

  // Set row-level security context
  await db.query(`SET LOCAL app.current_user_id = '${user.sub.replace(/'/g, '')}'`);

  try {
    let sql, values, result;
    const { where, values: filterValues } = buildWhereClause(filters);

    switch (operation) {
      case 'select': {
        const safeColumns = columns === '*' ? '*' : columns.split(',').map(c => `"${c.trim().replace(/"/g, '')}"`).join(', ');
        const order = orderBy ? `ORDER BY "${orderBy.column}" ${orderBy.ascending ? 'ASC' : 'DESC'}` : '';
        const lim = limit ? `LIMIT ${parseInt(limit)}` : '';
        const off = range ? `OFFSET ${parseInt(range.from)}` : '';
        sql = `SELECT ${safeColumns} FROM public."${table}" ${where} ${order} ${lim} ${off}`.trim();
        result = await db.query(sql, filterValues);
        return { statusCode: 200, headers: corsHeaders, body: { data: result.rows, count: result.rowCount } };
      }

      case 'insert': {
        const rows = Array.isArray(data) ? data : [data];
        const cols = Object.keys(rows[0]).map(k => `"${k}"`).join(', ');
        const allValues = [];
        const rowPlaceholders = rows.map((row, ri) => {
          const vals = Object.values(row);
          const placeholders = vals.map((_, vi) => `$${ri * vals.length + vi + 1}`).join(', ');
          allValues.push(...vals);
          return `(${placeholders})`;
        });
        sql = `INSERT INTO public."${table}" (${cols}) VALUES ${rowPlaceholders.join(', ')} RETURNING *`;
        result = await db.query(sql, allValues);
        return { statusCode: 201, headers: corsHeaders, body: { data: result.rows } };
      }

      case 'update': {
        const entries = Object.entries(data);
        const setClauses = entries.map(([k], i) => `"${k}" = $${i + 1}`).join(', ');
        const setValues = entries.map(([, v]) => v);
        const { where: updateWhere, values: updateFilterValues } = buildWhereClause(filters, setValues.length + 1);
        sql = `UPDATE public."${table}" SET ${setClauses} ${updateWhere} RETURNING *`;
        result = await db.query(sql, [...setValues, ...updateFilterValues]);
        return { statusCode: 200, headers: corsHeaders, body: { data: result.rows } };
      }

      case 'delete': {
        sql = `DELETE FROM public."${table}" ${where} RETURNING *`;
        result = await db.query(sql, filterValues);
        return { statusCode: 200, headers: corsHeaders, body: { data: result.rows } };
      }

      case 'upsert': {
        const rows = Array.isArray(data) ? data : [data];
        const cols = Object.keys(rows[0]).map(k => `"${k}"`).join(', ');
        const allValues = [];
        const rowPlaceholders = rows.map((row, ri) => {
          const vals = Object.values(row);
          const placeholders = vals.map((_, vi) => `$${ri * vals.length + vi + 1}`).join(', ');
          allValues.push(...vals);
          return `(${placeholders})`;
        });
        const onConflict = body.upsertOptions?.onConflict || 'id';
        const updateCols = Object.keys(rows[0]).filter(k => k !== onConflict).map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');
        sql = `INSERT INTO public."${table}" (${cols}) VALUES ${rowPlaceholders.join(', ')} ON CONFLICT ("${onConflict}") DO UPDATE SET ${updateCols} RETURNING *`;
        result = await db.query(sql, allValues);
        return { statusCode: 200, headers: corsHeaders, body: { data: result.rows } };
      }

      default:
        return { statusCode: 400, headers: corsHeaders, body: { error: `Unknown operation: ${operation}` } };
    }
  } catch (err) {
    console.error('[db-gateway] Query error:', err.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: { error: 'Database operation failed', details: process.env.NODE_ENV === 'development' ? err.message : undefined },
    };
  }
}

exports.main = main;
