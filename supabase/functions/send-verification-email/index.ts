import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  email: string;
  type: 'code' | 'link';
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, type = 'code' }: VerificationRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch SMTP config
    const { data: smtpConfig, error: smtpError } = await supabase
      .from("smtp_config")
      .select("*")
      .eq("is_enabled", true)
      .maybeSingle();

    if (smtpError || !smtpConfig) {
      console.error("SMTP config error:", smtpError);
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch email verification settings
    const { data: verificationSettings } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "email_verification")
      .maybeSingle();

    const settings = verificationSettings?.value as { 
      code_expiry_minutes?: number;
      link_expiry_minutes?: number;
    } || {};

    const expiryMinutes = type === 'code' 
      ? (settings.code_expiry_minutes || 10)
      : (settings.link_expiry_minutes || 60);

    // Generate verification code or token
    const code = type === 'code'
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : crypto.randomUUID();

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Store verification record
    const { error: insertError } = await supabase
      .from("email_verifications")
      .insert({
        email,
        code,
        verification_type: type,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing verification:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create verification" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Look up editable template (falls back to built-in HTML)
    const { data: templateRow } = await supabase
      .from("email_templates")
      .select("subject, body_html")
      .eq("key", "email_verification")
      .eq("is_active", true)
      .maybeSingle();

    const appUrl = Deno.env.get("APP_URL") || "https://tikxaz.lovable.app";
    const verificationLink = `${appUrl}/verify?token=${code}&email=${encodeURIComponent(email)}`;

    const expiryLabel = `${expiryMinutes} minutes`;
    const replacements: Record<string, string> = {
      name: email.split("@")[0] || "there",
      app_name: "TrendUp",
      code,
      expires_in: expiryLabel,
      expiresIn: expiryLabel,
    };
    const applyVars = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in replacements ? replacements[k] : m));

    let emailSubject: string;
    let emailHtml: string;

    if (templateRow) {
      emailSubject = applyVars(templateRow.subject);
      emailHtml = applyVars(templateRow.body_html);
    } else if (type === 'code') {
      emailSubject = "Your Verification Code";
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ec4899; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 20px 0; }
            .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Verify Your Email</h2>
            <p>Enter this verification code to complete your registration:</p>
            <div class="code">${code}</div>
            <p>This code expires in ${expiryLabel}.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <div class="footer">
              <p>© ${new Date().getFullYear()} TrendUp. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      emailSubject = "Verify Your Email";
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ec4899, #06b6d4); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
            .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Verify Your Email</h2>
            <p>Click the button below to verify your email address:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" class="button">Verify Email</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationLink}</p>
            <p>This link expires in ${expiryLabel}.</p>
            <div class="footer">
              <p>© ${new Date().getFullYear()} TrendUp. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Send email via HTTP API (Brevo/SendGrid/any API-key SMTP gateway)
    const brevoApiKey = smtpConfig.smtp_password;
    
    if (!brevoApiKey) {
      return new Response(
        JSON.stringify({ error: "Email API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Register delivery for logging + tracking pixel
    const deliveryId = crypto.randomUUID();
    const idempotencyKey = `${email}-${type}-${code}`;
    const pixelUrl = `${appUrl}/functions/v1/email-open?id=${deliveryId}`;
    const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

    await supabase.from("email_deliveries").insert({
      id: deliveryId,
      to: email,
      subject: emailSubject,
      template_key: "email_verification",
      status: "pending",
      idempotency_key: idempotencyKey,
    }).catch(() => {});

    const brevoPayload = {
      sender: {
        name: smtpConfig.from_name || "TrendUp",
        email: smtpConfig.from_email,
      },
      to: [{ email }],
      subject: emailSubject,
      htmlContent: emailHtml + trackingPixel,
    };

    console.log("Sending verification email to:", email);

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(brevoPayload),
    });

    if (!brevoResponse.ok) {
      const errorData = await brevoResponse.text();
      console.error("Brevo API error:", errorData);
      await supabase.from("email_deliveries").update({
        status: "failed",
        error: errorData.slice(0, 500),
      }).eq("id", deliveryId).catch(() => {});
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errorData }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await supabase.from("email_deliveries").update({
      status: "sent",
    }).eq("id", deliveryId).catch(() => {});

    console.log("Verification email sent successfully to:", email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification email sent",
        type,
        expiresIn: expiryMinutes 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in send-verification-email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
