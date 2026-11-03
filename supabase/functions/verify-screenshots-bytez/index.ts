import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to convert ArrayBuffer to base64 without stack overflow
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192; // Process in chunks to avoid stack overflow
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, [...chunk]);
  }
  return btoa(binary);
}

// Verify with Bytez API (using correct Bytez endpoint)
async function verifyWithBytez(screenshots: string[], verificationPrompt: string) {
  console.log("Verifying with Bytez API...");
  
  const BYTEZ_API_KEY = Deno.env.get("BYTEZ_API_KEY");
  if (!BYTEZ_API_KEY) {
    throw new Error("BYTEZ_API_KEY is not configured");
  }

  // Prepare images for Bytez (need base64 data)
  const imageBase64List: string[] = [];

  for (const screenshot of screenshots) {
    if (screenshot.startsWith('data:')) {
      // Already base64 - extract the base64 part
      const base64Part = screenshot.split(',')[1] || screenshot;
      imageBase64List.push(base64Part);
    } else if (screenshot.startsWith('http')) {
      // URL - fetch and convert to base64
      try {
        const imageResponse = await fetch(screenshot);
        const imageBlob = await imageResponse.arrayBuffer();
        const base64 = arrayBufferToBase64(imageBlob);
        imageBase64List.push(base64);
      } catch (err) {
        console.error("Error fetching screenshot:", err);
      }
    }
  }

  if (imageBase64List.length === 0) {
    throw new Error("No valid screenshots to verify");
  }

  // Use Bytez API with correct format for multimodal/vision
  // For chat models with images, use the messages format with base64 images embedded
  // Format the prompt with image descriptions since Bytez chat models expect text content
  
  // First, describe that we're sending images for analysis
  const imageDescription = imageBase64List.length === 1 
    ? "I am providing 1 screenshot image for analysis."
    : `I am providing ${imageBase64List.length} screenshot images for analysis.`;
  
  // Construct message with images as base64 in a format Bytez supports
  // Using the correct Bytez multimodal format with base64 field
  const response = await fetch("https://api.bytez.com/models/v2/google/gemini-2.5-flash", {
    method: "POST",
    headers: {
      "Authorization": BYTEZ_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // For vision/multimodal, Bytez expects base64 images in the body
      base64: imageBase64List[0], // Primary image
      text: `${imageDescription}\n\n${verificationPrompt}`,
      // Additional params
      params: {
        max_length: 2000,
        temperature: 0.1
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Bytez API error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 401) {
      throw new Error("Bytez API key is invalid or expired");
    }
    throw new Error(`Bytez API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("Bytez API response:", JSON.stringify(data).substring(0, 500));
  // Bytez returns output in different formats - handle both
  return data.output || data.choices?.[0]?.message?.content || data.result;
}

// Generate a unique comment for a user based on video description
async function generateUniqueComment(
  videoDescription: string, 
  keywords: string[] | null,
  userId: string
): Promise<string> {
  const BYTEZ_API_KEY = Deno.env.get("BYTEZ_API_KEY");
  if (!BYTEZ_API_KEY) {
    return generateDeterministicComment(videoDescription, keywords, userId);
  }

  const prompt = `Generate a short, authentic TikTok comment (1-2 sentences, max 100 characters) for this video:
  
Video Description: "${videoDescription}"
${keywords?.length ? `Keywords to consider: ${keywords.join(", ")}` : ""}

Requirements:
- Sound natural and human-like
- Be positive and engaging
- No emojis or hashtags
- Unique and specific to the content
- Between 20-80 characters

Respond with ONLY the comment text, nothing else.`;

  try {
    const response = await fetch("https://api.bytez.com/models/v2/google/gemini-2.5-flash", {
      method: "POST",
      headers: {
        "Authorization": BYTEZ_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        stream: false,
        params: {
          max_length: 200,
          temperature: 0.8
        }
      }),
    });

    if (!response.ok) {
      return generateDeterministicComment(videoDescription, keywords, userId);
    }

    const data = await response.json();
    const comment = (data.output || data.result || "")?.trim();
    return comment || generateDeterministicComment(videoDescription, keywords, userId);
  } catch {
    return generateDeterministicComment(videoDescription, keywords, userId);
  }
}

// Fallback deterministic comment generation
function generateDeterministicComment(
  videoDescription: string,
  keywords: string[] | null,
  userId: string
): string {
  const commentTemplates = [
    "This is exactly what I needed to see today!",
    "Love this content, keep it up!",
    "So inspiring, thank you for sharing!",
    "This made my day, great work!",
    "Amazing content, can't stop watching!",
    "This is fire, definitely sharing!",
    "Perfectly captured the vibe!",
    "You always deliver quality content!",
    "This hit different, love it!",
    "Needed to see this, great timing!",
  ];
  
  const hash = userId.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
  const index = Math.abs(hash) % commentTemplates.length;
  return commentTemplates[index];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const requestBody = await req.json();
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Handle comment generation request
    if (requestBody.action === "generate_comment") {
      const { adId, userId } = requestBody;
      
      // Check if comment already generated
      const { data: existingComment } = await supabase
        .from("generated_comments")
        .select("comment_text")
        .eq("ad_id", adId)
        .eq("user_id", userId)
        .single();
      
      if (existingComment) {
        return new Response(
          JSON.stringify({ comment: existingComment.comment_text }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Get ad details
      const { data: ad } = await supabase
        .from("ads")
        .select("video_description, comment_keywords")
        .eq("id", adId)
        .single();
      
      const comment = await generateUniqueComment(
        ad?.video_description || "TikTok video",
        ad?.comment_keywords,
        userId
      );
      
      // Store the generated comment
      await supabase
        .from("generated_comments")
        .insert({
          ad_id: adId,
          user_id: userId,
          comment_text: comment
        });
      
      return new Response(
        JSON.stringify({ comment }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Main screenshot verification flow
    const { adId, userId, taskType, tiktokName, tiktokUsername, screenshots, expectedComment, advertiserDisplayName } = requestBody;

    console.log("Verifying task with Bytez:", { adId, taskType, tiktokName, tiktokUsername, expectedComment, advertiserDisplayName, screenshotCount: screenshots?.length });

    if (!screenshots || screenshots.length === 0) {
      return new Response(
        JSON.stringify({ approved: false, reason: "No screenshots provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate/reused screenshots
    const { data: existingSubmissions } = await supabase
      .from("task_submissions")
      .select("screenshot_urls")
      .eq("user_id", userId)
      .neq("ad_id", adId);
    
    const usedScreenshots = new Set(
      existingSubmissions?.flatMap(s => s.screenshot_urls || []) || []
    );
    
    const reusedScreenshot = screenshots.find((s: string) => usedScreenshots.has(s));
    if (reusedScreenshot) {
      return new Response(
        JSON.stringify({ 
          approved: false, 
          reason: "Screenshot has been used in a previous submission",
          status: "rejected"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing APPROVED submission for same ad
    const { data: existingApproved } = await supabase
      .from("task_submissions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("ad_id", adId)
      .eq("status", "approved")
      .single();
    
    if (existingApproved) {
      return new Response(
        JSON.stringify({ 
          approved: false, 
          reason: "You have already completed this task",
          status: "rejected"
        }),
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

    // Fetch admin-configured prompt for this task type
    const { data: promptData } = await supabase
      .from("ai_prompts")
      .select("prompt_content, confidence_threshold")
      .eq("task_type", taskType)
      .eq("is_active", true)
      .single();

    const confidenceThreshold = promptData?.confidence_threshold || 70;
    const displayName = tiktokName || tiktokUsername;

    // Get advertiser's display name if not provided
    let advertiserName = advertiserDisplayName;
    if (!advertiserName) {
      const { data: ad } = await supabase
        .from("ads")
        .select("creator_id")
        .eq("id", adId)
        .single();
      
      if (ad?.creator_id) {
        const { data: advertiserProfile } = await supabase
          .from("profiles")
          .select("tiktok_username")
          .eq("user_id", ad.creator_id)
          .single();
        
        advertiserName = advertiserProfile?.tiktok_username || null;
      }
    }

    // Determine required actions based on task type
    const requiredActions: Record<string, string[]> = {
      like: ["liked"],
      comment: ["commented"],
      save: ["saved"],
      follow: ["followed"],
      combo_mini: ["liked", "commented", "saved"],
      combo_large: ["liked", "commented", "saved", "followed"]
    };

    const actionsToVerify = requiredActions[taskType] || ["liked"];
    const customPrompt = promptData?.prompt_content || "";

    // Build verification prompt based on task type
    let verificationPrompt = "";

    if (taskType === "comment") {
      verificationPrompt = `You are a TikTok screenshot verification AI. Your job is to verify that a specific comment was posted on a SPECIFIC video.

TASK: Verify COMMENT action
USER'S TIKTOK DISPLAY NAME: "${displayName}"
USER'S TIKTOK USERNAME: "@${tiktokUsername}"
EXPECTED COMMENT TEXT: "${expectedComment || 'Any comment from this user'}"
${advertiserName ? `ADVERTISER'S DISPLAY NAME: "${advertiserName}" - This name MUST appear somewhere in the screenshot (as the video creator/poster)` : ''}

${customPrompt}

CRITICAL VERIFICATION STEPS:
1. ${advertiserName ? `FIRST: Verify that the screenshot shows content from "${advertiserName}" - look for their name as the video poster/creator` : 'Identify the video being commented on'}
2. Look for the comment section in the screenshot
3. Find a comment posted by "${displayName}" OR "@${tiktokUsername}"
4. If expected comment is provided, check if the text matches or is very similar to: "${expectedComment}"

${advertiserName ? `
ANTI-FRAUD CHECK:
- The advertiser's name "${advertiserName}" MUST be visible in the screenshot as the content creator
- If you cannot find "${advertiserName}" in the screenshot, REJECT with reason "Wrong video - advertiser name not found"
` : ''}

MATCHING RULES FOR COMMENTS:
- Exact match = 100% confidence
- Minor differences (capitalization, punctuation, small typos) = 90% confidence
- Same meaning but different wording = 70% confidence
- No match found = 0% confidence

Respond ONLY with valid JSON:
{
  "status": "approved" | "rejected" | "manual_review",
  "confidence_score": 0-100,
  "failed_reason": "reason if rejected, null if approved",
  "detected_actions": {
    "liked": false,
    "saved": false,
    "commented": true/false,
    "followed": false
  },
  "found_username": "the username found in comments or null",
  "found_comment_text": "the exact comment text found or null",
  "comment_match_percentage": 0-100,
  "advertiser_name_found": true/false,
  "fraud_indicators": []
}`;
    } else if (taskType === "like") {
      verificationPrompt = `You are a TikTok screenshot verification AI.

TASK: Verify LIKE action on a SPECIFIC video
${advertiserName ? `ADVERTISER'S DISPLAY NAME: "${advertiserName}" - This name MUST appear somewhere in the screenshot as the video creator` : ''}

${customPrompt}

CRITICAL VERIFICATION STEPS:
1. ${advertiserName ? `FIRST: Verify that the screenshot shows content from "${advertiserName}" - their name must be visible as the video poster/creator` : 'Identify the video'}
2. Check that the heart/like icon is RED or PINK (filled state)
3. A white or outlined heart means NOT liked

${advertiserName ? `
ANTI-FRAUD CHECK:
- The advertiser's name "${advertiserName}" MUST be visible in the screenshot
- If you cannot find "${advertiserName}" as the video creator, REJECT with reason "Wrong video - advertiser name not found"
` : ''}

Respond ONLY with valid JSON:
{
  "status": "approved" | "rejected" | "manual_review",
  "confidence_score": 0-100,
  "failed_reason": "reason if rejected, null if approved",
  "detected_actions": {
    "liked": true/false,
    "saved": false,
    "commented": false,
    "followed": false
  },
  "heart_color": "red" | "white" | "unknown",
  "advertiser_name_found": true/false,
  "fraud_indicators": []
}`;
    } else if (taskType === "save") {
      verificationPrompt = `You are a TikTok screenshot verification AI.

TASK: Verify SAVE action on a SPECIFIC video
${advertiserName ? `ADVERTISER'S DISPLAY NAME: "${advertiserName}" - This name MUST appear somewhere in the screenshot as the video creator` : ''}

${customPrompt}

CRITICAL VERIFICATION STEPS:
1. ${advertiserName ? `FIRST: Verify that the screenshot shows content from "${advertiserName}" - their name must be visible as the video poster/creator` : 'Identify the video'}
2. Check that the bookmark/save icon is YELLOW or GOLD (filled state)
3. A white or outlined bookmark means NOT saved

${advertiserName ? `
ANTI-FRAUD CHECK:
- The advertiser's name "${advertiserName}" MUST be visible in the screenshot
- If you cannot find "${advertiserName}" as the video creator, REJECT with reason "Wrong video - advertiser name not found"
` : ''}

Respond ONLY with valid JSON:
{
  "status": "approved" | "rejected" | "manual_review",
  "confidence_score": 0-100,
  "failed_reason": "reason if rejected, null if approved",
  "detected_actions": {
    "liked": false,
    "saved": true/false,
    "commented": false,
    "followed": false
  },
  "bookmark_color": "yellow" | "white" | "unknown",
  "advertiser_name_found": true/false,
  "fraud_indicators": []
}`;
    } else {
      // Combo tasks
      verificationPrompt = `You are a TikTok screenshot verification AI.

TASK: Verify ${taskType.toUpperCase()} action(s) on a SPECIFIC video
REQUIRED ACTIONS: ${actionsToVerify.join(", ")}
USER'S TIKTOK NAME: "${displayName}"
${advertiserName ? `ADVERTISER'S DISPLAY NAME: "${advertiserName}" - This name MUST appear in the screenshots as the video/profile creator` : ''}

${customPrompt}

CRITICAL VERIFICATION STEPS:
1. ${advertiserName ? `FIRST: Verify that at least one screenshot shows content from "${advertiserName}"` : 'Identify the content'}

VERIFICATION CRITERIA:
${actionsToVerify.includes("liked") ? "- LIKE: Heart icon MUST be RED/PINK (filled)" : ""}
${actionsToVerify.includes("saved") ? "- SAVE: Bookmark icon MUST be YELLOW/GOLD (filled)" : ""}
${actionsToVerify.includes("commented") ? `- COMMENT: Find a comment from "${displayName}"${expectedComment ? `. Expected: "${expectedComment}"` : ""}` : ""}
${actionsToVerify.includes("followed") ? '- FOLLOW: Button must show "Following" state' : ""}

${advertiserName ? `
ANTI-FRAUD CHECK:
- The advertiser's name "${advertiserName}" MUST be visible in at least one screenshot
- If you cannot find "${advertiserName}", REJECT with reason "Wrong video/profile - advertiser name not found"
` : ''}

Check all provided screenshots for these actions.

Respond ONLY with valid JSON:
{
  "status": "approved" | "rejected" | "manual_review",
  "confidence_score": 0-100,
  "failed_reason": "reason if rejected, null if approved",
  "detected_actions": {
    "liked": true/false,
    "saved": true/false,
    "commented": true/false,
    "followed": true/false
  },
  "advertiser_name_found": true/false,
  "fraud_indicators": []
}`;
    }

    // Use Bytez for verification
    let aiContent: string | undefined;
    const maxScreenshots = taskType === "combo_large" ? 4 : 3;

    try {
      aiContent = await verifyWithBytez(screenshots.slice(0, maxScreenshots), verificationPrompt);
      console.log("Bytez AI response:", aiContent);
    } catch (aiError) {
      console.error("Bytez API error:", aiError);
      // If AI fails, flag for manual review
      const { data: ad } = await supabase
        .from("ads")
        .select("points_per_task")
        .eq("id", adId)
        .single();

      await supabase
        .from("task_submissions")
        .insert({
          ad_id: adId,
          user_id: userId,
          screenshot_urls: screenshots,
          status: "needs_review",
          ai_analysis: {
            error: aiError instanceof Error ? aiError.message : "AI verification failed",
            provider: "bytez",
            timestamp: new Date().toISOString()
          }
        });

      return new Response(
        JSON.stringify({
          verified: true,
          needsReview: true,
          status: "needs_review",
          reason: "AI verification unavailable - submitted for manual review",
          points: ad?.points_per_task || 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse AI response
    let aiResult: any = null;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = aiContent || "";
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiResult = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, aiContent);
      // Submit for manual review if we can't parse
      const { data: ad } = await supabase
        .from("ads")
        .select("points_per_task")
        .eq("id", adId)
        .single();

      await supabase
        .from("task_submissions")
        .insert({
          ad_id: adId,
          user_id: userId,
          screenshot_urls: screenshots,
          status: "needs_review",
          ai_analysis: {
            raw_response: aiContent,
            parse_error: true,
            provider: "bytez",
            timestamp: new Date().toISOString()
          }
        });

      return new Response(
        JSON.stringify({
          verified: true,
          needsReview: true,
          status: "needs_review",
          reason: "AI response unclear - submitted for manual review",
          points: ad?.points_per_task || 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if all required actions are detected
    const detectedActions = aiResult.detected_actions || {};
    const missingActions = actionsToVerify.filter(action => !detectedActions[action]);
    
    // Get points for this ad
    const { data: ad } = await supabase
      .from("ads")
      .select("points_per_task, completed_count, required_completions")
      .eq("id", adId)
      .single();

    const points = ad?.points_per_task || 0;
    const confidenceScore = aiResult.confidence_score || 0;

    // Determine final status
    let finalStatus: "approved" | "rejected" | "needs_review" = aiResult.status;
    let reason = aiResult.failed_reason;

    // Override to rejected if advertiser name not found (anti-fraud)
    if (aiResult.advertiser_name_found === false && advertiserName) {
      finalStatus = "rejected";
      reason = "Wrong video/profile - advertiser name not found";
    }

    // Override based on missing actions
    if (missingActions.length > 0 && finalStatus !== "rejected") {
      if (confidenceScore < confidenceThreshold) {
        finalStatus = "needs_review";
        reason = `Could not confirm: ${missingActions.join(", ")}. Confidence: ${confidenceScore}%`;
      } else {
        finalStatus = "rejected";
        reason = `Missing required action(s): ${missingActions.join(", ")}`;
      }
    }

    // Store submission
    await supabase
      .from("task_submissions")
      .insert({
        ad_id: adId,
        user_id: userId,
        screenshot_urls: screenshots,
        status: finalStatus,
        points_awarded: finalStatus === "approved" ? points : null,
        ai_analysis: {
          ...aiResult,
          provider: "bytez",
          timestamp: new Date().toISOString()
        }
      });

    // If approved, award points and update ad completion count
    if (finalStatus === "approved") {
      // Update user's points
      const { data: profile } = await supabase
        .from("profiles")
        .select("tik_points")
        .eq("user_id", userId)
        .single();

      await supabase
        .from("profiles")
        .update({ tik_points: (profile?.tik_points || 0) + points })
        .eq("user_id", userId);

      // Record transaction
      await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          amount: points,
          type: "earn",
          description: `Task completed: ${taskType}`,
          reference_id: adId
        });

      // Update ad completion count
      await supabase
        .from("ads")
        .update({ 
          completed_count: (ad?.completed_count || 0) + 1,
          is_active: (ad?.completed_count || 0) + 1 < (ad?.required_completions || 1)
        })
        .eq("id", adId);

      // Create notification
      await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type: "task_approved",
          title: "Task Approved!",
          message: `Your ${taskType} task was approved. You earned ${points} points!`,
          reference_id: adId
        });
    }

    return new Response(
      JSON.stringify({
        approved: finalStatus === "approved",
        verified: true,
        needsReview: finalStatus === "needs_review",
        status: finalStatus,
        reason: reason,
        points: finalStatus === "approved" ? points : 0,
        confidence: confidenceScore,
        detected_actions: detectedActions
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({ 
        approved: false, 
        error: error instanceof Error ? error.message : "Verification failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
