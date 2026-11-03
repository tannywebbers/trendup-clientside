import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// Rate limiting: max 5 attempts per IP per 15 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
  if (entry.count >= MAX_ATTEMPTS) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await req.json();
    const { email, password, action } = body;
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

    // ============================================================
    // ACTION: log_success
    // Called by the admin panel AFTER a successful admin login + 2FA.
    // ============================================================
    if (action === "log_success") {
      await supabase.from("admin_login_attempts").insert({
        email,
        is_successful: true,
        attempt_type: body.with2FA ? "2fa_login" : "password",
        ip_address: ip,
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // check_user_role action has been REMOVED.
    //
    // The regular Login.tsx no longer calls this edge function at all.
    // It signs in via supabase.auth.signInWithPassword() first, then
    // checks user_roles directly with an authenticated session.
    // That approach is faster, can't cold-start-fail, and doesn't
    // expose credentials to an edge function unnecessarily.
    // ============================================================

    // ============================================================
    // ADMIN LOGIN FLOW (no action specified, or action === "admin_login")
    // This is called exclusively by the admin login panel.
    // ============================================================

    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, error: "Email and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RATE LIMITING
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      await supabase.from("admin_login_attempts").insert({
        email,
        is_successful: false,
        attempt_type: "rate_limited",
        ip_address: ip,
      });
      return new Response(JSON.stringify({ success: false, rateLimited: true, error: "Too many attempts. Please wait 15 minutes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AUTHENTICATE
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      await supabase.from("admin_login_attempts").insert({
        email,
        is_successful: false,
        attempt_type: "password",
        ip_address: ip,
      });
      return new Response(JSON.stringify({ success: false, error: "Invalid credentials" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    await supabase.auth.signOut(); // We only validated credentials — don't keep a server-side session.

    // ROLE CHECK — both "admin" and "moderator" are admin-panel-only.
    // If neither role is found, this is a regular user — block them here.
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "moderator"])
      .maybeSingle();

    if (!roleData) {
      await supabase.from("admin_login_attempts").insert({
        email,
        is_successful: false,
        attempt_type: "unauthorized_role",
        ip_address: ip,
      });
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2FA CHECK
    const { data: totpData } = await supabase
      .from("admin_totp_secrets")
      .select("is_verified, locked_until")
      .eq("user_id", userId)
      .maybeSingle();

    // If TOTP is locked, reject immediately
    if (totpData?.locked_until && new Date(totpData.locked_until) > new Date()) {
      return new Response(JSON.stringify({ success: false, error: "Account temporarily locked due to failed 2FA attempts." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      requires2FA: !!totpData?.is_verified,
      userId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("admin-login edge function error:", error);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
