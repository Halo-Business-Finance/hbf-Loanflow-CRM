import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('secure-external-api')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { action, url, options, signature } = await req.json();

    // Verify request signature for security
    if (!signature || !verifySignature(req, signature)) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let response;
    
    switch (action) {
      case 'get_google_maps_key':
        // Return Google Maps API key from environment
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
        // Proxy external API requests securely
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
    logger.error('Error in secure-external-api function', error);
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function verifySignature(req: Request, providedSignature: string): boolean {
  // Simple signature verification - in production, use HMAC with secret key
  const expectedSignature = 'secure-api-call-' + new Date().toDateString();
  return providedSignature === expectedSignature;
}