/**
 * IBM Cloud Service Configuration
 * All values are read from environment variables set at build/deploy time.
 * Replace Supabase env vars with IBM Cloud equivalents in your IBM Cloud deployment.
 */

export const IBM_CONFIG = {
  // IBM App ID (Authentication)
  appId: {
    clientId: import.meta.env.VITE_IBM_APPID_CLIENT_ID || '',
    discoveryEndpoint: import.meta.env.VITE_IBM_APPID_DISCOVERY_ENDPOINT || '',
    redirectUri: typeof window !== 'undefined' ? window.location.origin + '/auth/callback' : '',
  },

  // IBM Cloud Databases for PostgreSQL (via backend proxy)
  database: {
    // These are consumed by IBM Cloud Functions / Code Engine (server-side only)
    // The frontend communicates with IBM Cloud Functions endpoints
    functionsBaseUrl: import.meta.env.VITE_IBM_FUNCTIONS_BASE_URL || 'https://hbf-api.23oqh4gja5d5.us-south.codeengine.appdomain.cloud',
    apiKey: import.meta.env.VITE_IBM_FUNCTIONS_API_KEY || '',
  },

  // IBM Cloud Object Storage
  cos: {
    endpoint: import.meta.env.VITE_IBM_COS_ENDPOINT || '',
    instanceId: import.meta.env.VITE_IBM_COS_INSTANCE_ID || '',
    bucketDocuments: import.meta.env.VITE_IBM_COS_BUCKET_DOCUMENTS || 'crm-documents',
    bucketTemplates: import.meta.env.VITE_IBM_COS_BUCKET_TEMPLATES || 'crm-templates',
  },

  // IBM Event Streams (Kafka) for Realtime
  eventStreams: {
    brokers: (import.meta.env.VITE_IBM_EVENT_STREAMS_BROKERS || '').split(','),
    apiKey: import.meta.env.VITE_IBM_EVENT_STREAMS_API_KEY || '',
  },

  // IBM watsonx.ai
  watsonx: {
    url: import.meta.env.VITE_IBM_WATSONX_URL || '',
    projectId: import.meta.env.VITE_IBM_WATSONX_PROJECT_ID || '',
    apiKey: import.meta.env.VITE_IBM_WATSONX_API_KEY || '',
  },

  // IBM Code Engine (Functions endpoint namespace)
  codeEngine: {
    region: import.meta.env.VITE_IBM_REGION || 'us-south',
    namespace: import.meta.env.VITE_IBM_CE_NAMESPACE || 'crm-functions',
  },
};

export const isIBMConfigured = (): boolean => {
  return !!(
    IBM_CONFIG.appId.clientId &&
    IBM_CONFIG.appId.discoveryEndpoint &&
    IBM_CONFIG.database.functionsBaseUrl
  );
};
