import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  console.log("Paystack webhook called");

  if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing environment variables");
    return new Response(
      JSON.stringify({ error: "Server not configured properly" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    console.log("Received webhook, signature:", signature ? "present" : "missing");

    // Verify webhook signature
    if (signature) {
      const hash = createHmac("sha512", PAYSTACK_SECRET_KEY)
        .update(body)
        .digest("hex");

      if (hash !== signature) {
        console.error("Invalid webhook signature");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Signature verified successfully");
    }

    const event = JSON.parse(body);
    console.log("Webhook event:", event.event);

    // Only process successful charges
    if (event.event !== "charge.success") {
      console.log("Ignoring event:", event.event);
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = event.data;
    const { user_id, points } = data.metadata || {};
    const reference = data.reference;
    const amountPaid = data.amount / 100; // Convert from kobo to naira

    console.log("Processing payment:", { user_id, points, reference, amountPaid });

    if (!user_id || !points || !reference) {
      console.error("Missing required metadata:", data.metadata);
      return new Response(
        JSON.stringify({ error: "Missing metadata" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Atomic + idempotent crediting by reference
    const pointsToAdd = parseInt(points);
    if (!Number.isFinite(pointsToAdd) || pointsToAdd <= 0) {
      console.error("Invalid points:", points);
      return new Response(
        JSON.stringify({ error: "Invalid points" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: creditResult, error: creditError } = await supabase.rpc(
      "credit_purchase_points",
      {
        _user_id: user_id,
        _points: pointsToAdd,
        _amount_paid: amountPaid,
        _reference: reference,
      }
    );

    if (creditError) {
      console.error("Error crediting purchase points:", creditError);
      return new Response(
        JSON.stringify({ error: "Failed to process purchase" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("credit_purchase_points result:", creditResult);

    const alreadyProcessed = Boolean((creditResult as any)?.already_processed);

    console.log("Webhook processed successfully!");

    return new Response(
      JSON.stringify({ received: true, success: true, already_processed: alreadyProcessed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
