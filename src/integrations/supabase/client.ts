/**
 * Legacy Supabase client shim — re-exports the IBM data layer
 * so any remaining imports of `@/integrations/supabase/client` still work.
 */
export { supabase } from '@/lib/ibm';
