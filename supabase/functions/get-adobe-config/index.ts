import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('get-adobe-config')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  logger.logRequest(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    logger.info('Getting Adobe credentials from environment');
    
    // Get Adobe credentials from Supabase secrets
    const adobeClientId = Deno.env.get('ADOBE_CLIENT_ID') || 'dc-pdf-embed-demo'
    const adobeApiKey = Deno.env.get('ADOBE_API_KEY') || null
    const isDemo = adobeClientId === 'dc-pdf-embed-demo'
    
    const configResponse = { 
      clientId: adobeClientId,
      hasApiKey: !!adobeApiKey,
      isDemo: isDemo,
      status: isDemo ? 'demo' : 'licensed',
      features: {
        pdfViewer: true,
        documentEmbed: true,
        apiAccess: !!adobeApiKey,
        advancedFeatures: !isDemo && !!adobeApiKey
      }
    };
    
    logger.info('Returning Adobe config', { isDemo });
    
    return new Response(
      JSON.stringify(configResponse),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    )
  } catch (error) {
    logger.error('Error getting Adobe config', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get Adobe configuration',
        clientId: 'dc-pdf-embed-demo',
        isDemo: true
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    )
  }
})