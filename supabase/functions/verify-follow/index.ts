import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify follow using screenshot and AI analysis
async function verifyFollowWithScreenshot(
  screenshotUrl: string,
  advertiserUsername: string,
  performerUsername: string
): Promise<{ isFollowing: boolean; confidence: number; reason: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  // Try providers in order: Lovable AI first, then Gemini, then OpenAI
  const providers = [
    { name: "lovable", key: LOVABLE_API_KEY, endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions", model: "google/gemini-2.5-flash" },
    { name: "gemini", key: GEMINI_API_KEY, endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", model: null },
    { name: "openai", key: OPENAI_API_KEY, endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" }
  ];

  const prompt = `You are a TikTok screenshot verification AI. Analyze this screenshot to verify a FOLLOW action.

TASK: Verify that user "@${performerUsername}" is following "@${advertiserUsername}"

This screenshot should show the performer's TikTok "Following" list with the advertiser's username visible, indicating they are following them.

WHAT TO LOOK FOR:
1. The screenshot shows a TikTok "Following" list/page
2. The advertiser's username "@${advertiserUsername}" appears in the following list
3. Or search results showing "@${advertiserUsername}" with "Following" status

VERIFICATION CRITERIA:
- The advertiser username "@${advertiserUsername}" MUST be visible in the screenshot
- It should appear in a "Following" context (not just mentioned anywhere)
- Look for the exact username or very close match (case-insensitive)

ANTI-FRAUD CHECKS:
- Check if the screenshot looks authentic (real TikTok UI)
- Look for any signs of photo editing or manipulation
- Ensure it's not just a profile page but specifically shows "Following" relationship

Respond ONLY with valid JSON:
{
  "is_following": true/false,
  "confidence": 0-100,
  "advertiser_username_found": true/false,
  "appears_in_following_list": true/false,
  "screenshot_authentic": true/false,
  "reason": "explanation of what you found",
  "fraud_indicators": []
}`;

  for (const provider of providers) {
    if (!provider.key) continue;

    try {
      console.log(`Trying ${provider.name} for follow verification...`);

      let response;
      
      if (provider.name === "gemini") {
        // Gemini-specific API format
        response = await fetch(`${provider.endpoint}?key=${provider.key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: "image/jpeg", data: screenshotUrl.split(",")[1] || "" } }
              ]
            }]
          })
        });

        if (!response.ok) continue;

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const jsonMatch = content?.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return {
            isFollowing: result.is_following === true && result.advertiser_username_found === true,
            confidence: result.confidence || 0,
            reason: result.reason || "Verified via Gemini AI"
          };
        }
      } else {
        // OpenAI / Lovable AI format
        const messages = [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: screenshotUrl } }
          ]
        }];

        response = await fetch(provider.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: provider.model,
            messages,
            max_tokens: 1024
          })
        });

        if (!response.ok) continue;

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        const jsonMatch = content?.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return {
            isFollowing: result.is_following === true && result.advertiser_username_found === true,
            confidence: result.confidence || 0,
            reason: result.reason || `Verified via ${provider.name} AI`
          };
        }
      }
    } catch (error) {
      console.error(`${provider.name} error:`, error);
      continue;
    }
  }

  return {
    isFollowing: false,
    confidence: 0,
    reason: "No AI provider available for verification"
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { action, ...params } = await req.json();

    // Screenshot-based follow verification
    if (action === "verify_follow_screenshot") {
      const { adId, userId, advertiserUsername, performerUsername, screenshot } = params;
      
      console.log(`Verifying follow via screenshot: @${performerUsername} -> @${advertiserUsername}`);
      
      if (!screenshot) {
        return new Response(
          JSON.stringify({ verified: false, reason: "Screenshot is required for follow verification" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user already has an approved submission for this task
      const { data: existingApproved } = await supabase
        .from("task_submissions")
        .select("id")
        .eq("user_id", userId)
        .eq("ad_id", adId)
        .eq("status", "approved")
        .single();
      
      if (existingApproved) {
        return new Response(
          JSON.stringify({ verified: false, reason: "You have already completed this task" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete any previous rejected submissions so user can retry
      await supabase
        .from("task_submissions")
        .delete()
        .eq("user_id", userId)
        .eq("ad_id", adId)
        .eq("status", "rejected");
      
      // Get ad details
      const { data: ad } = await supabase
        .from("ads")
        .select("points_per_task, completed_count, required_completions")
        .eq("id", adId)
        .single();
      
      if (!ad) {
        return new Response(
          JSON.stringify({ verified: false, reason: "Task not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if task is still available
      if (ad.completed_count >= ad.required_completions) {
        return new Response(
          JSON.stringify({ verified: false, reason: "This task is no longer available" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Verify the follow using screenshot + AI
      const checkResult = await verifyFollowWithScreenshot(screenshot, advertiserUsername, performerUsername);
      
      console.log("Follow screenshot verification result:", checkResult);
      
      // Only approve if we have high confidence
      if (checkResult.isFollowing && checkResult.confidence >= 70) {
        // Create submission record
        const { data: submission, error: submissionError } = await supabase
          .from("task_submissions")
          .insert({
            ad_id: adId,
            user_id: userId,
            screenshot_urls: [screenshot.substring(0, 200) + "..."], // Store truncated reference
            status: "approved",
            points_awarded: ad.points_per_task,
            ai_analysis: {
              method: "screenshot_ai",
              result: checkResult,
              verified_at: new Date().toISOString(),
              advertiser_username: advertiserUsername,
              performer_username: performerUsername
            }
          })
          .select()
          .single();
        
        if (submissionError) throw submissionError;
        
        // Store follow verification for delayed re-check
        await supabase
          .from("follow_verifications")
          .insert({
            submission_id: submission.id,
            ad_id: adId,
            user_id: userId,
            advertiser_tiktok_username: advertiserUsername,
            performer_tiktok_username: performerUsername,
            initial_check_passed: true,
            initial_check_at: new Date().toISOString(),
            scheduled_delay_check: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            status: "pending_delay_check"
          });
        
        // Award points
        const { data: profile } = await supabase
          .from("profiles")
          .select("tik_points")
          .eq("user_id", userId)
          .single();
        
        if (profile) {
          await supabase
            .from("profiles")
            .update({ tik_points: profile.tik_points + ad.points_per_task })
            .eq("user_id", userId);
        }
        
        // Update ad completion count
        await supabase
          .from("ads")
          .update({ completed_count: ad.completed_count + 1 })
          .eq("id", adId);
        
        // Create transaction record
        await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            amount: ad.points_per_task,
            type: "task_reward",
            description: "Follow task completed",
            reference_id: submission.id
          });
        
        // Create notification
        await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            type: "task_approved",
            title: "Task Approved!",
            message: `Your follow task was approved! +${ad.points_per_task} Streak Points.`,
            reference_id: adId
          });
        
        return new Response(
          JSON.stringify({ 
            verified: true, 
            points: ad.points_per_task,
            confidence: checkResult.confidence,
            message: `Follow verified! You earned ${ad.points_per_task} Streak Points.`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Medium confidence - needs review
      if (checkResult.confidence >= 40 && checkResult.confidence < 70) {
        await supabase
          .from("task_submissions")
          .insert({
            ad_id: adId,
            user_id: userId,
            screenshot_urls: [screenshot.substring(0, 200) + "..."],
            status: "needs_review",
            ai_analysis: {
              method: "screenshot_ai",
              result: checkResult,
              verified_at: new Date().toISOString(),
              note: "Medium confidence, needs manual review"
            }
          });
        
        return new Response(
          JSON.stringify({ 
            verified: false, 
            needsReview: true,
            reason: `Submitted for manual review. ${checkResult.reason}`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Low confidence - rejected
      return new Response(
        JSON.stringify({ 
          verified: false, 
          confidence: checkResult.confidence,
          reason: checkResult.reason || `Could not verify that you follow @${advertiserUsername}. Please ensure your screenshot clearly shows "@${advertiserUsername}" in your Following list.`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Legacy scrape-based verification (kept for compatibility but not recommended)
    if (action === "verify_follow_scrape") {
      return new Response(
        JSON.stringify({ 
          verified: false, 
          reason: "Scraping verification is no longer supported. Please use screenshot verification."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({ verified: false, reason: error instanceof Error ? error.message : "Verification failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
