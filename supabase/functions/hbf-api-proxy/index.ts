import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_HBF_API_BASE_URL = "https://hbf-api.23oqh4gja5d5.us-south.codeengine.appdomain.cloud";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { path, method = "GET", body, forwardHeaders } = await req.json();

    if (typeof path !== "string" || !path.startsWith("/api/v1/") || path.includes("..")) {
      return new Response(JSON.stringify({ error: "Invalid proxy path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = (Deno.env.get("HBF_API_BASE_URL") || DEFAULT_HBF_API_BASE_URL).replace(/\/$/, "");
    const backendUrl = `${baseUrl}${path}`;

    const backendHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const internalApiKey =
      Deno.env.get("HBF_API_KEY") ||
      Deno.env.get("CRM_API_KEY") ||
      Deno.env.get("VITE_IBM_FUNCTIONS_API_KEY") ||
      "";

    const forwardedApiKey = forwardHeaders?.["x-api-key"] || forwardHeaders?.["X-API-KEY"];
    console.log(`[hbf-api-proxy] Key len: ${internalApiKey.length}, preview: ${internalApiKey.slice(0, 8)}...${internalApiKey.slice(-4)}, forwarded: ${forwardedApiKey ? 'yes' : 'no'}`);
    if (forwardedApiKey || internalApiKey) {
      backendHeaders["x-api-key"] = forwardedApiKey || internalApiKey;
    }

    const forwardedAuth =
      req.headers.get("authorization") ||
      forwardHeaders?.authorization ||
      forwardHeaders?.Authorization;

    if (forwardedAuth) {
      backendHeaders["Authorization"] = forwardedAuth;
    }

    const shouldSendBody = method !== "GET" && method !== "HEAD";
    const backendResponse = await fetch(backendUrl, {
      method,
      headers: backendHeaders,
      body: shouldSendBody ? JSON.stringify(body ?? {}) : undefined,
    });

    const contentType = backendResponse.headers.get("content-type") || "application/json";
    const raw = await backendResponse.text();

    return new Response(raw, {
      status: backendResponse.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy request failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
