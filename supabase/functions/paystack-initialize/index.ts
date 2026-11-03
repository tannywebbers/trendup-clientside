import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to log errors to database
async function logError(supabase: any, errorType: string, errorMessage: string, errorDetails: any = {}) {
  try {
    await supabase.from('error_logs').insert({
      function_name: 'paystack-initialize',
      error_type: errorType,
      error_message: errorMessage,
      error_details: errorDetails,
      created_at: new Date().toISOString()
    });
  } catch (logErr) {
    console.error('Failed to log error to database:', logErr);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Create Supabase client for logging (before main try/catch)
  let supabaseClient: any = null;
  
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    }
  } catch (err) {
    console.error("Failed to create Supabase client for logging:", err);
  }

  try {
    console.log("=== PAYSTACK INITIALIZE STARTING ===");
    console.log("Timestamp:", new Date().toISOString());
    
    // Step 1: Check environment variables
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    const APP_URL = Deno.env.get("APP_URL") || "http://localhost:5173";
    
    console.log("Environment check:");
    console.log("- PAYSTACK_SECRET_KEY exists:", !!PAYSTACK_SECRET_KEY);
    console.log("- PAYSTACK_SECRET_KEY length:", PAYSTACK_SECRET_KEY?.length || 0);
    console.log("- PAYSTACK_SECRET_KEY starts with 'sk_':", PAYSTACK_SECRET_KEY?.startsWith('sk_') || false);
    console.log("- APP_URL:", APP_URL);
    
    if (!PAYSTACK_SECRET_KEY) {
      const errorMsg = "PAYSTACK_SECRET_KEY environment variable is not set in Supabase Dashboard";
      console.error("❌ CRITICAL ERROR:", errorMsg);
      console.error("👉 FIX: Go to Supabase Dashboard > Edge Functions > paystack-initialize > Settings");
      console.error("👉 ADD: PAYSTACK_SECRET_KEY = your_paystack_secret_key");
      
      if (supabaseClient) {
        await logError(supabaseClient, 'MISSING_ENV_VAR', errorMsg, {
          missing_var: 'PAYSTACK_SECRET_KEY',
          app_url: APP_URL
        });
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Payment system not configured. Please contact support.",
          details: "PAYSTACK_SECRET_KEY is missing"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log("Request body received:", {
        hasEmail: !!requestBody.email,
        hasAmount: !!requestBody.amount,
        hasPoints: !!requestBody.points,
        hasUserId: !!requestBody.userId,
        amount: requestBody.amount,
        points: requestBody.points
      });
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError);
      
      if (supabaseClient) {
        await logError(supabaseClient, 'INVALID_REQUEST', 'Failed to parse JSON body', {
          error: parseError instanceof Error ? parseError.message : String(parseError)
        });
      }
      
      return new Response(
        JSON.stringify({ error: "Invalid request format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, amount, points, userId } = requestBody;

    // Step 3: Validate required fields
    const missingFields = [];
    if (!email) missingFields.push('email');
    if (!amount) missingFields.push('amount');
    if (!points) missingFields.push('points');
    if (!userId) missingFields.push('userId');
    
    if (missingFields.length > 0) {
      console.error("❌ Missing required fields:", missingFields);
      
      if (supabaseClient) {
        await logError(supabaseClient, 'VALIDATION_ERROR', 'Missing required fields', {
          missing_fields: missingFields,
          received_data: { email: !!email, amount, points, userId: !!userId }
        });
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Missing required payment information",
          missing_fields: missingFields
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      console.error("❌ Invalid amount:", amount, "Type:", typeof amount);
      
      if (supabaseClient) {
        await logError(supabaseClient, 'VALIDATION_ERROR', 'Invalid amount', {
          amount,
          amount_type: typeof amount
        });
      }
      
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 5: Build callback URL
    const callbackUrl = `${APP_URL}/payment-callback`;
    console.log("Callback URL:", callbackUrl);

    // Step 6: Prepare Paystack request
    const paystackPayload = {
      email,
      amount,
      callback_url: callbackUrl,
      metadata: {
        user_id: userId,
        points: points.toString(),
        cancel_action: `${APP_URL}/dashboard`,
        custom_fields: [
          {
            display_name: "Streak Points Purchase",
            variable_name: "tikpoints",
            value: points.toString()
          }
        ]
      },
      channels: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"]
    };
    
    console.log("Paystack payload:", JSON.stringify(paystackPayload, null, 2));

    // Step 7: Call Paystack API
    console.log("Calling Paystack API...");
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    console.log("Paystack response status:", paystackResponse.status);
    
    const paystackData = await paystackResponse.json();
    console.log("Paystack response body:", JSON.stringify(paystackData, null, 2));

    // Step 8: Check Paystack response
    if (!paystackData.status) {
      console.error("❌ Paystack initialization failed");
      console.error("Paystack error message:", paystackData.message);
      console.error("Full Paystack response:", paystackData);
      
      if (supabaseClient) {
        await logError(supabaseClient, 'PAYSTACK_ERROR', paystackData.message || 'Payment initialization failed', {
          paystack_response: paystackData,
          request_data: { email, amount, points, userId }
        });
      }
      
      return new Response(
        JSON.stringify({ 
          error: paystackData.message || "Payment initialization failed",
          details: paystackData
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 9: Success
    console.log("✅ Payment initialized successfully");
    console.log("Reference:", paystackData.data.reference);
    console.log("Authorization URL:", paystackData.data.authorization_url);
    console.log("=== PAYSTACK INITIALIZE COMPLETED ===");

    return new Response(
      JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("=== UNEXPECTED ERROR ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    console.error("=========================");
    
    if (supabaseClient) {
      await logError(supabaseClient, 'UNCAUGHT_ERROR', error instanceof Error ? error.message : String(error), {
        error_type: error?.constructor?.name,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
    
    return new Response(
      JSON.stringify({ 
        error: "An error occurred while initializing payment. Please try again.",
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
