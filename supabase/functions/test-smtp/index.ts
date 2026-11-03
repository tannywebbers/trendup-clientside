import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string; // This is the Brevo API key
  from_email: string;
  from_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, smtpConfig } = await req.json() as {
      to: string;
      smtpConfig: SMTPConfig;
    };

    if (!to) {
      return new Response(
        JSON.stringify({ error: "Email address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate config - for Brevo HTTP API we need the API key (password field)
    if (!smtpConfig?.password || !smtpConfig?.from_email) {
      return new Response(
        JSON.stringify({
          error: "Incomplete configuration. Please provide Brevo API Key and From Email.",
          details: {
            api_key: !!smtpConfig?.password,
            from_email: !!smtpConfig?.from_email
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending email via Brevo HTTP API to: ${to}`);

    // Build HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ec4899, #8b5cf6); padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .success-icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
          .success-text { color: #10b981; font-size: 24px; text-align: center; margin-bottom: 20px; font-weight: 600; }
          .details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .details ul { list-style: none; padding: 0; margin: 0; }
          .details li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .details li:last-child { border-bottom: none; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; padding: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ${smtpConfig.from_name || 'TrendUp'}</h1>
          </div>
          <div class="content">
            <div class="success-icon">✅</div>
            <p class="success-text">Email Configuration Working!</p>
            <p>Great news! Your email configuration is set up correctly. You can now send emails from your application.</p>
            
            <div class="details">
              <h3 style="margin-top: 0;">Test Details:</h3>
              <ul>
                <li><strong>Recipient:</strong> ${to}</li>
                <li><strong>Sent at:</strong> ${new Date().toLocaleString()}</li>
                <li><strong>Provider:</strong> Brevo (Sendinblue)</li>
                <li><strong>Method:</strong> HTTP API v3</li>
              </ul>
            </div>
            
            <p>You can now use email features in your application like:</p>
            <ul>
              <li>✉️ Email verification for new users</li>
              <li>🔐 Password reset emails</li>
              <li>🔔 Notification emails</li>
              <li>📢 Marketing campaigns</li>
            </ul>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${smtpConfig.from_name || 'TrendUp'}. All rights reserved.</p>
            <p style="color: #999; font-size: 10px;">Sent via Brevo Transactional Email API</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Use Brevo's HTTP API v3 for sending transactional emails
    // The SMTP key/password is used as the API key
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": smtpConfig.password,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: smtpConfig.from_name || "TrendUp",
          email: smtpConfig.from_email,
        },
        to: [
          {
            email: to,
            name: to.split("@")[0],
          },
        ],
        subject: `${smtpConfig.from_name || 'TrendUp'} - Test Email`,
        htmlContent: htmlContent,
        textContent: `Your ${smtpConfig.from_name || 'TrendUp'} email configuration is working correctly! Sent to: ${to} at ${new Date().toISOString()}`,
      }),
    });

    const brevoData = await brevoResponse.json();
    
    console.log("Brevo API response status:", brevoResponse.status);
    console.log("Brevo API response:", JSON.stringify(brevoData));

    if (!brevoResponse.ok) {
      console.error("Brevo API error:", brevoData);
      
      // Parse common Brevo errors
      let errorMessage = "Failed to send email via Brevo";
      if (brevoData.code === "unauthorized" || brevoData.code === "invalid_api_key") {
        errorMessage = "Invalid Brevo API Key. Please check your SMTP key in Brevo dashboard.";
      } else if (brevoData.message?.includes("sender")) {
        errorMessage = "Sender email not verified. Please verify your domain in Brevo dashboard.";
      } else if (brevoData.message) {
        errorMessage = brevoData.message;
      }
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
          code: brevoData.code,
          details: "Go to Brevo Dashboard → Settings → Senders & IP to verify your sender email."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully via Brevo HTTP API");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Test email sent successfully to ${to}`,
        messageId: brevoData.messageId,
        provider: "Brevo HTTP API"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Request error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to send test email",
        details: "Please verify your Brevo API key is correct."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
