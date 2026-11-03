import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { campaignId } = await req.json();
    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "campaignId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Load campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (campaign.status === "sent" || campaign.status === "sending") {
      return new Response(
        JSON.stringify({ error: "Campaign already sent or in progress" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Load SMTP config (Brevo HTTP API key style)
    const { data: smtpConfig, error: smtpError } = await supabase
      .from("smtp_config")
      .select("*")
      .eq("is_enabled", true)
      .maybeSingle();

    if (smtpError || !smtpConfig?.smtp_password || !smtpConfig?.from_email) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark as sending
    await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId);

    // Resolve recipients
    let query = supabase.from("profiles").select("user_id, email").not("email", "is", null);
    if (campaign.audience === "active") query = query.eq("is_banned", false);
    if (campaign.audience === "verified") query = query.not("email", "is", null); // best-effort verified = has email
    const { data: recipients } = await query;
    const users = (recipients || []).filter((r) => r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));

    const appUrl = Deno.env.get("APP_URL") || "https://tikxaz.lovable.app";
    let sent = 0;
    let failed = 0;

    // Replace template variables per recipient
    const applyVars = (s: string, email: string) =>
      s.replace(/\{\{(\w+)\}\}/g, (_m, k) => {
        if (k === "name") return email.split("@")[0] || "there";
        if (k === "email") return email;
        if (k === "app_name") return "TrendUp";
        return _m;
      });

    for (const user of users) {
      const deliveryId = crypto.randomUUID();
      const idempotencyKey = `campaign:${campaignId}:${user.user_id}`;
      const pixelUrl = `${appUrl}/functions/v1/email-open?id=${deliveryId}`;
      const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

      await supabase.from("email_deliveries").insert({
        id: deliveryId,
        to: user.email,
        subject: applyVars(campaign.subject, user.email),
        template_key: "email_campaign",
        status: "pending",
        idempotency_key: idempotencyKey,
      }).catch(() => {});

      const subject = applyVars(campaign.subject, user.email);
      const html = applyVars(campaign.body_html, user.email) + trackingPixel;

      try {
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "accept": "application/json",
            "api-key": smtpConfig.smtp_password,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: {
              name: smtpConfig.from_name || "TrendUp",
              email: smtpConfig.from_email,
            },
            to: [{ email: user.email }],
            subject,
            htmlContent: html,
          }),
        });

        if (!brevoResponse.ok) {
          failed++;
          const errorText = (await brevoResponse.text()).slice(0, 500);
          await supabase.from("email_deliveries")
            .update({ status: "failed", error: errorText })
            .eq("id", deliveryId).catch(() => {});
        } else {
          sent++;
          await supabase.from("email_deliveries")
            .update({ status: "sent" })
            .eq("id", deliveryId).catch(() => {});
        }
      } catch (_err) {
        failed++;
      }

      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 80));
    }

    await supabase.from("email_campaigns").update({
      status: failed === users.length && users.length > 0 ? "failed" : "sent",
      recipient_count: sent,
      sent_at: new Date().toISOString(),
      last_error: failed > 0 ? `${failed} of ${users.length} emails failed to send` : null,
    }).eq("id", campaignId);

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: users.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in send-bulk-email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});