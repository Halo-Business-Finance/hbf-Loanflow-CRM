import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('secure-external-api')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Allowlist of permitted external proxy targets
const ALLOWED_PROXY_HOSTS = [
  'maps.googleapis.com',
  'api.ringcentral.com',
];

function isAllowedProxyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROXY_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Require valid JWT — no weak signature fallback
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, url, options } = await req.json();

    let response;
    
    switch (action) {
      case 'get_google_maps_key':
        // Return Google Maps API key from environment (key is restricted by referrer in GCP console)
        const googleMapsKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
        if (!googleMapsKey) {
          return new Response(JSON.stringify({ error: 'Google Maps API key not configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ apiKey: googleMapsKey }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'proxy_request':
        // Validate URL against allowlist before proxying
        if (!url || !isAllowedProxyUrl(url)) {
          return new Response(JSON.stringify({ error: 'URL not in allowed list' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const requestOptions = {
          method: options?.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options?.headers || {})
          },
          ...(options?.body && { body: JSON.stringify(options.body) })
        };

        response = await fetch(url, requestOptions);
        const data = await response.json();
        
        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    logger.error('Error in secure-external-api function', error instanceof Error ? error : new Error(String(error)));
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
