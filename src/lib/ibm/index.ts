/**
 * IBM Cloud Unified Client
 *
 * Single import point that mirrors the Supabase client API shape.
 * Swap `import { supabase } from '@/integrations/supabase/client'`
 * with `import { ibmClient as supabase } from '@/lib/ibm/ibm-client'`
 * to route all calls through IBM Cloud services.
 */

export { ibmAuth } from './ibm-auth';
export { ibmDb } from './ibm-database';
export { ibmStorage } from './ibm-storage';
export { IBM_CONFIG, isIBMConfigured } from './ibm-config';
export { ROUTE_MAP, UNMAPPED_TABLES, getRouteConfig } from './ibm-route-map';
export { RPC_ROUTE_MAP, getRpcRouteConfig } from './ibm-rpc-routes';
export type { IBMUser, IBMSession } from './ibm-auth';
export type { UploadResult, ListResult } from './ibm-storage';
export type { RouteConfig } from './ibm-route-map';
export type { RpcRouteConfig } from './ibm-rpc-routes';

import { ibmAuth } from './ibm-auth';
import { ibmDb } from './ibm-database';
import { ibmStorage } from './ibm-storage';

/**
 * Unified IBM client — mirrors the `supabase` client interface
 * so components can be migrated one-by-one:
 *
 *   const { data } = await ibmClient.from('leads').select().eq('user_id', uid)
 *   const session = await ibmClient.auth.getSession()
 */
export const ibmClient = {
  auth: ibmAuth,
  from: ibmDb.from.bind(ibmDb),
  rpc: ibmDb.rpc.bind(ibmDb),
  storage: ibmStorage,
} as const;
