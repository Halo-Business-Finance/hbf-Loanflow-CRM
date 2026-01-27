import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSecurityHeaders, handleSecureOptions, escapeHtml, validateEmail, sanitizeString } from "../_shared/security-headers.ts";
import { SecureLogger } from "../_shared/secure-logger.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";

const logger = new SecureLogger('send-email');

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  leadName?: string;
  fromName?: string;
  replyTo?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return handleSecureOptions();
  }

  try {
    // Initialize Supabase client for rate limiting
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: getSecurityHeaders({ "Content-Type": "application/json" }) }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: getSecurityHeaders({ "Content-Type": "application/json" }) }
      );
    }

    // Apply rate limiting to prevent email spam
    const rateLimitResult = await checkRateLimit(supabase, user.id, RATE_LIMITS.SEND_EMAIL);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for send email', { userId: user.id });
      return new Response(
        JSON.stringify({ error: rateLimitResult.error }),
        { status: 429, headers: getSecurityHeaders({ "Content-Type": "application/json" }) }
      );
    }

    const { to, subject, body, leadName, fromName, replyTo }: EmailRequest = await req.json();

    // Enhanced input validation
    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        {
          status: 400,
          headers: getSecurityHeaders({ "Content-Type": "application/json" }),
        }
      );
    }

    // Validate email format
    if (!validateEmail(to)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address format" }),
        {
          status: 400,
          headers: getSecurityHeaders({ "Content-Type": "application/json" }),
        }
      );
    }

    // Sanitize and validate inputs
    const sanitizedSubject = sanitizeString(subject, 200);
    const sanitizedBody = sanitizeString(body, 10000);
    const sanitizedLeadName = leadName ? sanitizeString(leadName, 100) : undefined;
    const sanitizedFromName = fromName ? sanitizeString(fromName, 100) : undefined;
    
    if (replyTo && !validateEmail(replyTo)) {
      return new Response(
        JSON.stringify({ error: "Invalid reply-to email address format" }),
        {
          status: 400,
          headers: getSecurityHeaders({ "Content-Type": "application/json" }),
        }
      );
    }

    // Create HTML email content with proper escaping
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(sanitizedSubject)}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>LoanFlow CRM</h2>
              ${sanitizedLeadName ? `<p>Re: ${escapeHtml(sanitizedLeadName)}</p>` : ''}
            </div>
            <div class="content">
              ${escapeHtml(sanitizedBody).replace(/\n/g, '<br>')}
            </div>
            <div class="footer">
              <p>This email was sent from LoanFlow CRM</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: sanitizedFromName ? `${escapeHtml(sanitizedFromName)} <noreply@yourdomain.com>` : "LoanFlow CRM <noreply@yourdomain.com>",
      to: [to],
      subject: sanitizedSubject,
      html: htmlContent,
      replyTo: replyTo || undefined,
    });

    logger.info("Email sent successfully", { emailId: emailResponse.data?.id });

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      message: "Email sent successfully" 
    }), {
      status: 200,
      headers: getSecurityHeaders({ "Content-Type": "application/json" }),
    });

  } catch (error: any) {
    logger.error("Error in send-email function", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: "Failed to send email. Please check your email configuration." 
      }),
      {
        status: 500,
        headers: getSecurityHeaders({ "Content-Type": "application/json" }),
      }
    );
  }
};

serve(handler);