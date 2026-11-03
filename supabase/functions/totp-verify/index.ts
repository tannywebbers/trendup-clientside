import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const MAX_ATTEMPTS = 3;
const LOCKOUT_HOURS = 6;

// Rate limiting for 2FA verification
const verifyRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 10;

function checkVerifyRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = verifyRateLimitMap.get(userId);
  
  if (!entry || now > entry.resetAt) {
    verifyRateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (entry.count >= MAX_VERIFY_ATTEMPTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

// RFC 4648 Base32 decoding
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Uint8Array {
  const cleanInput = input.toUpperCase().replace(/=+$/, "");
  const output: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of cleanInput) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }

  return new Uint8Array(output);
}

// HMAC-SHA1 implementation for TOTP
async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const keyBuffer = new ArrayBuffer(key.length);
  new Uint8Array(keyBuffer).set(key);
  
  const messageBuffer = new ArrayBuffer(message.length);
  new Uint8Array(messageBuffer).set(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageBuffer);
  return new Uint8Array(signature);
}

// Verify TOTP with window tolerance
async function verifyTOTP(secret: string, token: string, window = 1): Promise<boolean> {
  const key = base32Decode(secret);
  
  for (let i = -window; i <= window; i++) {
    const timeStep = 30;
    const time = Math.floor(Date.now() / 1000 / timeStep) + i;
    
    // Convert time to 8-byte buffer (big endian)
    const timeBuffer = new Uint8Array(8);
    let t = time;
    for (let j = 7; j >= 0; j--) {
      timeBuffer[j] = t & 0xff;
      t = Math.floor(t / 256);
    }

    const hmac = await hmacSha1(key, timeBuffer);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    ) % 1000000;

    if (code.toString().padStart(6, "0") === token) {
      return true;
    }
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { user_id, code, action } = await req.json();

    // Handle lockout check
    if (action === "check_lockout") {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "User ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: totpData } = await supabase
        .from("admin_totp_secrets")
        .select("locked_until, failed_attempts")
        .eq("user_id", user_id)
        .maybeSingle();

      if (totpData?.locked_until) {
        const lockedUntil = new Date(totpData.locked_until);
        if (lockedUntil > new Date()) {
          return new Response(
            JSON.stringify({ 
              locked: true, 
              locked_until: totpData.locked_until,
              failed_attempts: totpData.failed_attempts
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ 
          locked: false, 
          failed_attempts: totpData?.failed_attempts || 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user_id || !code) {
      return new Response(
        JSON.stringify({ error: "User ID and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit check
    if (!checkVerifyRateLimit(user_id)) {
      return new Response(
        JSON.stringify({ 
          error: "Too many verification attempts. Please wait.", 
          success: false,
          rateLimited: true
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get stored secret
    const { data: totpData, error: fetchError } = await supabase
      .from("admin_totp_secrets")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (fetchError || !totpData) {
      return new Response(
        JSON.stringify({ error: "TOTP not set up for this user", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check lockout
    if (totpData.locked_until) {
      const lockedUntil = new Date(totpData.locked_until);
      if (lockedUntil > new Date()) {
        return new Response(
          JSON.stringify({ 
            error: "Account locked", 
            locked: true, 
            locked_until: totpData.locked_until,
            success: false 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Reset lockout if expired
        await supabase
          .from("admin_totp_secrets")
          .update({ locked_until: null, failed_attempts: 0 })
          .eq("user_id", user_id);
      }
    }

    // Normalize code input
    const normalizedCode = code.toUpperCase().replace(/\s/g, "");
    
    // Check if it's a backup code (8 chars)
    if (normalizedCode.length === 8 && totpData.backup_codes?.includes(normalizedCode)) {
      // Remove used backup code
      const newCodes = totpData.backup_codes.filter((c: string) => c !== normalizedCode);
      
      // Handle disable action with backup code
      if (action === "disable") {
        await supabase
          .from("admin_totp_secrets")
          .delete()
          .eq("user_id", user_id);
          
        return new Response(
          JSON.stringify({ success: true, backup_code_used: true, action: "disable" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Reset failed attempts for successful backup code
      await supabase
        .from("admin_totp_secrets")
        .update({ backup_codes: newCodes, failed_attempts: 0, locked_until: null })
        .eq("user_id", user_id);

      return new Response(
        JSON.stringify({ success: true, backup_code_used: true, remaining_codes: newCodes.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify TOTP code (6 digits)
    const isValid = normalizedCode.length === 6 && await verifyTOTP(totpData.secret_encrypted, normalizedCode);

    if (!isValid) {
      // Increment failed attempts
      const newFailedAttempts = (totpData.failed_attempts || 0) + 1;
      
      if (newFailedAttempts >= MAX_ATTEMPTS) {
        // Lock account
        const lockUntil = new Date();
        lockUntil.setHours(lockUntil.getHours() + LOCKOUT_HOURS);
        
        await supabase
          .from("admin_totp_secrets")
          .update({ failed_attempts: newFailedAttempts, locked_until: lockUntil.toISOString() })
          .eq("user_id", user_id);

        // Log the lockout
        await supabase.from("admin_login_attempts").insert({
          email: "unknown",
          user_id: user_id,
          is_successful: false,
          attempt_type: "2fa_lockout",
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
        });

        return new Response(
          JSON.stringify({ 
            error: "Account locked due to too many failed attempts", 
            success: false,
            locked: true,
            locked_until: lockUntil.toISOString(),
            failed_attempts: newFailedAttempts
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("admin_totp_secrets")
        .update({ failed_attempts: newFailedAttempts })
        .eq("user_id", user_id);

      // Log failed 2FA attempt
      await supabase.from("admin_login_attempts").insert({
        email: "unknown",
        user_id: user_id,
        is_successful: false,
        attempt_type: "2fa_failed",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
      });

      return new Response(
        JSON.stringify({ 
          error: "Invalid code", 
          success: false,
          failed_attempts: newFailedAttempts,
          remaining_attempts: MAX_ATTEMPTS - newFailedAttempts
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success - reset failed attempts
    const updateData: Record<string, unknown> = { failed_attempts: 0, locked_until: null };
    
    // If this is initial verification, mark as verified
    if (action === "verify-setup" && !totpData.is_verified) {
      updateData.is_verified = true;
    }
    
    // Handle disable action with TOTP code
    if (action === "disable") {
      await supabase
        .from("admin_totp_secrets")
        .delete()
        .eq("user_id", user_id);
        
      return new Response(
        JSON.stringify({ success: true, action: "disable" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("admin_totp_secrets")
      .update(updateData)
      .eq("user_id", user_id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
