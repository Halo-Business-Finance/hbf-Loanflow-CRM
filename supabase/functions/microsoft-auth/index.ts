import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SecureLogger } from '../_shared/secure-logger.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/rate-limit.ts';

const logger = new SecureLogger('microsoft-auth');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

interface MicrosoftUserProfile {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handle OAuth callback (GET request with code parameter)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'microsoft_auth_error', error: '${error}' }, '*');
                window.close();
              </script>
              <p>Authentication failed. You can close this window.</p>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html', ...corsHeaders }
        });
      }

      if (!code || !state) {
        return new Response('Missing code or state parameter', { status: 400 });
      }

      // Exchange code for tokens
      const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!;
      const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!;
      const tenantId = Deno.env.get('MICROSOFT_TENANT_ID') || 'organizations';
      const redirectUri = `${supabaseUrl}/functions/v1/microsoft-auth`;

      const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.error('Token exchange error', new Error(errorText));
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'microsoft_auth_error', error: 'Failed to exchange code' }, '*');
                window.close();
              </script>
              <p>Authentication failed. You can close this window.</p>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html', ...corsHeaders }
        });
      }

      const tokens: MicrosoftTokenResponse = await tokenResponse.json();

      // Get user profile
      const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });

      if (!profileResponse.ok) {
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'microsoft_auth_error', error: 'Failed to get profile' }, '*');
                window.close();
              </script>
              <p>Authentication failed. You can close this window.</p>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html', ...corsHeaders }
        });
      }

      const profile: MicrosoftUserProfile = await profileResponse.json();
      const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

      // Store tokens using the user_id from state
      const { error: dbError } = await supabase
        .from('email_accounts')
        .upsert({
          user_id: state,
          email_address: profile.mail || profile.userPrincipalName,
          display_name: profile.displayName,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt.toISOString(),
          is_active: true,
        }, {
          onConflict: 'user_id,email_address',
        });

      if (dbError) {
        logger.error('Database error', dbError);
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'microsoft_auth_error', error: 'Database error' }, '*');
                window.close();
              </script>
              <p>Failed to save account. You can close this window.</p>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html', ...corsHeaders }
        });
      }

      return new Response(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'microsoft_auth_success', 
                email: '${profile.mail || profile.userPrincipalName}',
                name: '${profile.displayName}'
              }, '*');
              window.close();
            </script>
            <p>Email account connected successfully! You can close this window.</p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html', ...corsHeaders }
      });
    }

    // Handle POST requests (JSON API)
    // Parse body once and reuse throughout
    const body = await req.json();
    const { action, code, state, to, subject, body: emailBody, cc, bcc, recipientEmail, recipientName } = body;
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    logger.logAction(action, { userId: user.id });

    // Apply rate limiting based on action type
    let rateLimitConfig = RATE_LIMITS.AUTH_LOGIN;
    if (action === 'exchange_code') {
      rateLimitConfig = RATE_LIMITS.AUTH_EXCHANGE_CODE;
    } else if (action === 'send_email') {
      rateLimitConfig = RATE_LIMITS.SEND_EMAIL;
    } else if (action === 'send_password_reset') {
      rateLimitConfig = RATE_LIMITS.SEND_PASSWORD_RESET;
    }

    const rateLimitResult = await checkRateLimit(supabase, user.id, rateLimitConfig);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for Microsoft auth operation', { userId: user.id, action });
      return new Response(
        JSON.stringify({ error: rateLimitResult.error }),
        { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    switch (action) {
      case 'get_auth_url': {
        const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!;
        const tenantId = Deno.env.get('MICROSOFT_TENANT_ID') || 'organizations';
        const redirectUri = `${supabaseUrl}/functions/v1/microsoft-auth`;
        const scope = 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access';
        
        const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
          `client_id=${clientId}&` +
          `response_type=code&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `scope=${encodeURIComponent(scope)}&` +
          `state=${user.id}&` +
          `response_mode=query&` +
          `prompt=consent`;

        return new Response(JSON.stringify({ auth_url: authUrl }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      case 'exchange_code': {
        const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!;
        const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!;
        const tenantId = Deno.env.get('MICROSOFT_TENANT_ID') || 'organizations';
        const redirectUri = `${supabaseUrl}/functions/v1/microsoft-auth`;

        // Exchange code for tokens
        const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          logger.error('Token exchange error', new Error(errorText));
          throw new Error('Failed to exchange code for tokens');
        }

        const tokens: MicrosoftTokenResponse = await tokenResponse.json();

        // Get user profile from Microsoft Graph
        const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        });

        if (!profileResponse.ok) {
          throw new Error('Failed to get user profile');
        }

        const profile: MicrosoftUserProfile = await profileResponse.json();

        // Calculate expiry time
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

        // Store or update email account in database
        const { error: dbError } = await supabase
          .from('email_accounts')
          .upsert({
            user_id: user.id,
            email_address: profile.mail || profile.userPrincipalName,
            display_name: profile.displayName,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expiresAt.toISOString(),
            is_active: true,
          }, {
            onConflict: 'user_id',
          });

        if (dbError) {
          logger.error('Database error', dbError);
          throw dbError;
        }

        return new Response(JSON.stringify({ 
          success: true,
          profile: {
            email: profile.mail || profile.userPrincipalName,
            name: profile.displayName,
          }
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      case 'send_email': {
        // to, subject, emailBody (as body), cc, bcc already extracted from body above

        // Get active email account
        const { data: emailAccount, error: accountError } = await supabase
          .from('email_accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (accountError || !emailAccount) {
          throw new Error('No active email account found');
        }

        // Check if token needs refresh
        const now = new Date();
        const expiresAt = new Date(emailAccount.expires_at);
        
        let accessToken = emailAccount.access_token;
        
        if (now >= expiresAt) {
          // Refresh token logic would go here
          logger.info('Token expired, refresh needed');
        }

        // Send email via Microsoft Graph
        const emailData = {
          message: {
            subject: subject,
            body: {
              contentType: 'HTML',
              content: emailBody,
            },
            toRecipients: to.map((email: string) => ({
              emailAddress: { address: email }
            })),
            ...(cc && cc.length > 0 && {
              ccRecipients: cc.map((email: string) => ({
                emailAddress: { address: email }
              }))
            }),
            ...(bcc && bcc.length > 0 && {
              bccRecipients: bcc.map((email: string) => ({
                emailAddress: { address: email }
              }))
            }),
          }
        };

        const sendResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailData),
        });

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          logger.error('Send email error', new Error(errorText));
          throw new Error('Failed to send email');
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      case 'send_password_reset': {
        // recipientEmail and recipientName already extracted from body above

        // Get active email account for the admin user
        const { data: emailAccount, error: accountError } = await supabase
          .from('email_accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (accountError || !emailAccount) {
          throw new Error('No active email account found. Please connect Microsoft 365 first.');
        }

        // Check if token needs refresh
        const now = new Date();
        const expiresAt = new Date(emailAccount.expires_at);
        
        let accessToken = emailAccount.access_token;
        
        if (now >= expiresAt) {
          throw new Error('Email token expired. Please reconnect Microsoft 365.');
        }

        // Generate password reset link using Supabase Auth
        const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: recipientEmail,
        });

        if (resetError || !resetData.properties?.action_link) {
          logger.error('Error generating reset link', resetError);
          throw new Error('Failed to generate password reset link');
        }

        const resetLink = resetData.properties.action_link;

        // Create HTML email content
        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
                .content { background: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2>Password Reset Request</h2>
                  <p>LoanFlow CRM</p>
                </div>
                <div class="content">
                  <p>Hello ${recipientName || 'there'},</p>
                  <p>A password reset has been requested for your account. Click the button below to reset your password:</p>
                  <div style="text-align: center;">
                    <a href="${resetLink}" class="button">Reset Password</a>
                  </div>
                  <div class="warning">
                    <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request this password reset, please ignore this email or contact your administrator.
                  </div>
                  <p>If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="word-break: break-all; color: #667eea;">${resetLink}</p>
                </div>
                <div class="footer">
                  <p>This email was sent from LoanFlow CRM</p>
                  <p>Do not share this link with anyone</p>
                </div>
              </div>
            </body>
          </html>
        `;

        // Send email via Microsoft Graph
        const emailData = {
          message: {
            subject: 'Password Reset Request - LoanFlow CRM',
            body: {
              contentType: 'HTML',
              content: htmlContent,
            },
            toRecipients: [{
              emailAddress: { address: recipientEmail }
            }],
          }
        };

        const sendResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailData),
        });

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          logger.error('Send password reset email error', new Error(errorText));
          throw new Error('Failed to send password reset email');
        }

        return new Response(JSON.stringify({ success: true, message: 'Password reset email sent successfully' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      default:
        throw new Error('Invalid action');
    }

  } catch (error: any) {
    logger.error('Error in microsoft-auth function', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});