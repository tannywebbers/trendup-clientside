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
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, [...chunk]);
  }
  return btoa(binary);
}

// Validate and clean base64 image data
function validateAndCleanBase64(data: string): { isValid: boolean; base64: string; mimeType: string } {
  try {
    let base64Data = data;
    let mimeType = "image/jpeg";

    // Handle data URL format
    if (data.startsWith('data:')) {
      const match = data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        // Try to extract base64 part anyway
        const parts = data.split(',');
        if (parts.length > 1) {
          base64Data = parts[1];
        } else {
          return { isValid: false, base64: '', mimeType: '' };
        }
      }
    }

    // Remove any whitespace
    base64Data = base64Data.replace(/\s/g, '');

    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(base64Data)) {
      return { isValid: false, base64: '', mimeType: '' };
    }

    // Check minimum length (valid image should be at least a few KB)
    if (base64Data.length < 1000) {
      return { isValid: false, base64: '', mimeType: '' };
    }

    return { isValid: true, base64: base64Data, mimeType };
  } catch (error) {
    console.error("Base64 validation error:", error);
    return { isValid: false, base64: '', mimeType: '' };
  }
}

// Fetch and convert URL to base64
async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow'
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch URL: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    
    // Validate size
    if (arrayBuffer.byteLength < 1000) {
      console.error("Fetched image is too small");
      return null;
    }

    const base64 = arrayBufferToBase64(arrayBuffer);
    return { base64, mimeType: contentType.split(';')[0] };
  } catch (error) {
    console.error("URL to base64 error:", error);
    return null;
  }
}

// Prepare screenshots for AI verification
async function prepareScreenshots(screenshots: string[]): Promise<Array<{ base64: string; mimeType: string }>> {
  const prepared: Array<{ base64: string; mimeType: string }> = [];

  for (const screenshot of screenshots) {
    if (screenshot.startsWith('http')) {
      const result = await urlToBase64(screenshot);
      if (result) {
        prepared.push(result);
      }
    } else {
      const validation = validateAndCleanBase64(screenshot);
      if (validation.isValid) {
        prepared.push({ base64: validation.base64, mimeType: validation.mimeType });
      } else {
        console.warn("Invalid base64 screenshot, skipping");
      }
    }
  }

  return prepared;
}

// Verify with Google Gemini API
async function verifyWithGemini(screenshots: Array<{ base64: string; mimeType: string }>, verificationPrompt: string) {
  console.log("Verifying with Google Gemini API...");
  
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const parts: any[] = [{ text: verificationPrompt }];

  for (const { base64, mimeType } of screenshots) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64
      }
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// Fallback: Rule-based verification (pattern matching without AI)
function verifyWithRules(
  taskType: string, 
  screenshots: Array<{ base64: string; mimeType: string }>,
  _advertiserName?: string
): any {
  console.log("Falling back to rule-based verification...");
  
  // Rule-based verification cannot analyze image content,
  // so we flag for manual review with some basic checks
  
  const result = {
    status: "needs_review",
    confidence_score: 50,
    failed_reason: null as string | null,
    detected_actions: {
      liked: false,
      saved: false,
      commented: false,
      followed: false
    },
    verification_method: "rule_based",
    manual_review_reason: "AI verification unavailable - submitted for manual review"
  };

  // Basic validation: Check if we have valid screenshots
  if (screenshots.length === 0) {
    result.status = "rejected";
    result.confidence_score = 0;
    result.failed_reason = "No valid screenshots provided";
    return result;
  }

  // Check screenshot sizes (valid screenshots should be substantial)
  const hasValidSizes = screenshots.every(s => s.base64.length > 10000);
  if (!hasValidSizes) {
    result.status = "rejected";
    result.confidence_score = 0;
    result.failed_reason = "Screenshots appear to be too small or corrupted";
    return result;
  }

  // For simple tasks, give benefit of doubt with manual review
  if (taskType === "like" || taskType === "save") {
    result.confidence_score = 60;
    result.manual_review_reason = "Simple task - needs visual verification";
  } else if (taskType === "comment") {
    result.confidence_score = 55;
    result.manual_review_reason = "Comment task - needs visual verification of comment text";
  } else if (taskType === "follow") {
    result.confidence_score = 55;
    result.manual_review_reason = "Follow task - needs visual verification of following status";
  } else {
    result.confidence_score = 50;
    result.manual_review_reason = "Combo task - needs comprehensive visual verification";
  }

  return result;
}

// Fallback: CompreFace-style face/object detection (if available)
async function verifyWithCompreFace(
  screenshots: Array<{ base64: string; mimeType: string }>,
  taskType: string
): Promise<any | null> {
  const COMPREFACE_API_KEY = Deno.env.get("COMPREFACE_API_KEY");
  const COMPREFACE_URL = Deno.env.get("COMPREFACE_URL");
  
  if (!COMPREFACE_API_KEY || !COMPREFACE_URL) {
    console.log("CompreFace not configured, skipping...");
    return null;
  }

  console.log("Attempting CompreFace verification...");

  try {
    // CompreFace detection endpoint
    const detectionUrl = `${COMPREFACE_URL}/api/v1/detection/detect`;
    
    for (const { base64 } of screenshots) {
      const response = await fetch(detectionUrl, {
        method: "POST",
        headers: {
          "x-api-key": COMPREFACE_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          file: base64,
          det_prob_threshold: 0.8
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log("CompreFace detection result:", JSON.stringify(data).substring(0, 200));
        
        // If we get any detection results, the image is valid
        if (data.result && data.result.length > 0) {
          return {
            status: "needs_review",
            confidence_score: 60,
            verification_method: "compreface",
            detected_objects: data.result.length,
            manual_review_reason: "CompreFace detected valid image content"
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error("CompreFace error:", error);
    return null;
  }
}

// Generate a unique comment for a user
async function generateUniqueComment(
  videoDescription: string, 
  keywords: string[] | null,
  userId: string
): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 50,
          }
        }),
      }
    );

    if (!response.ok) {
      return generateDeterministicComment(videoDescription, keywords, userId);
    }

    const data = await response.json();
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return comment || generateDeterministicComment(videoDescription, keywords, userId);
  } catch {
    return generateDeterministicComment(videoDescription, keywords, userId);
  }
}

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

// Build verification prompt based on task type
function buildVerificationPrompt(
  taskType: string,
  displayName: string,
  tiktokUsername: string,
  expectedComment: string | null,
  advertiserName: string | null,
  customPrompt: string,
  actionsToVerify: string[]
): string {
  if (taskType === "comment") {
    return `You are a TikTok screenshot verification AI. Your job is to verify that a specific comment was posted on a SPECIFIC video.

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
    return `You are a TikTok screenshot verification AI.

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
    return `You are a TikTok screenshot verification AI.

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
    return `You are a TikTok screenshot verification AI.

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

    console.log("Verifying task:", { adId, taskType, tiktokName, tiktokUsername, screenshotCount: screenshots?.length });

    if (!screenshots || screenshots.length === 0) {
      return new Response(
        JSON.stringify({ approved: false, reason: "No screenshots provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare and validate screenshots BEFORE processing
    const preparedScreenshots = await prepareScreenshots(screenshots);
    console.log(`Prepared ${preparedScreenshots.length} valid screenshots from ${screenshots.length} submitted`);

    if (preparedScreenshots.length === 0) {
      return new Response(
        JSON.stringify({ 
          approved: false, 
          reason: "No valid screenshots could be processed. Please ensure you upload valid image files (PNG, JPG, etc.)",
          status: "rejected"
        }),
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

    // Check for existing APPROVED submission
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

    // Delete previous rejected submissions
    await supabase
      .from("task_submissions")
      .delete()
      .eq("user_id", userId)
      .eq("ad_id", adId)
      .eq("status", "rejected");

    // Fetch prompt configuration
    const { data: promptData } = await supabase
      .from("ai_prompts")
      .select("prompt_content, confidence_threshold")
      .eq("task_type", taskType)
      .eq("is_active", true)
      .single();

    const confidenceThreshold = promptData?.confidence_threshold || 70;
    const displayName = tiktokName || tiktokUsername;
    const customPrompt = promptData?.prompt_content || "";

    // Get advertiser's display name
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

    // Define required actions
    const requiredActions: Record<string, string[]> = {
      like: ["liked"],
      comment: ["commented"],
      save: ["saved"],
      follow: ["followed"],
      combo_mini: ["liked", "commented", "saved"],
      combo_large: ["liked", "commented", "saved", "followed"]
    };

    const actionsToVerify = requiredActions[taskType] || ["liked"];

    // Build verification prompt
    const verificationPrompt = buildVerificationPrompt(
      taskType,
      displayName,
      tiktokUsername,
      expectedComment,
      advertiserName,
      customPrompt,
      actionsToVerify
    );

    // Try verification with multiple fallbacks
    let verificationResult: any = null;
    let verificationMethod = "unknown";
    const maxScreenshots = taskType === "combo_large" ? 4 : 3;

    // 1. Try Gemini (primary)
    try {
      const aiContent = await verifyWithGemini(
        preparedScreenshots.slice(0, maxScreenshots), 
        verificationPrompt
      );
      console.log("Gemini response:", aiContent?.substring(0, 500));
      
      const jsonMatch = aiContent?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        verificationResult = JSON.parse(jsonMatch[0]);
        verificationMethod = "gemini";
      }
    } catch (geminiError: any) {
      console.error("Gemini verification failed:", geminiError.message);
      
      // 2. Try CompreFace as fallback
      if (geminiError.message !== "RATE_LIMITED") {
        const compreFaceResult = await verifyWithCompreFace(preparedScreenshots, taskType);
        if (compreFaceResult) {
          verificationResult = compreFaceResult;
          verificationMethod = "compreface";
        }
      }
    }

    // 3. Fall back to rule-based if all AI methods fail
    if (!verificationResult) {
      verificationResult = verifyWithRules(taskType, preparedScreenshots, advertiserName);
      verificationMethod = "rule_based";
    }

    // Ensure we have a result object
    if (!verificationResult) {
      verificationResult = {
        status: "needs_review",
        confidence_score: 50,
        failed_reason: null,
        detected_actions: { liked: false, saved: false, commented: false, followed: false }
      };
    }

    console.log(`Verification result (${verificationMethod}):`, JSON.stringify(verificationResult).substring(0, 300));

    // Apply anti-fraud check
    if (advertiserName && verificationResult.advertiser_name_found === false) {
      verificationResult.status = "rejected";
      verificationResult.failed_reason = `Screenshot does not show content from "${advertiserName}". Please ensure you're performing the task on the correct video.`;
      verificationResult.confidence_score = 0;
    }

    // Apply comment matching rules
    if (taskType === "comment" && expectedComment && verificationResult.advertiser_name_found !== false) {
      const foundComment = verificationResult.found_comment_text;
      const matchPercentage = verificationResult.comment_match_percentage || 0;
      
      if (foundComment) {
        const expectedNormalized = expectedComment.toLowerCase().trim().replace(/[^\w\s]/g, '');
        const foundNormalized = foundComment.toLowerCase().trim().replace(/[^\w\s]/g, '');
        
        const isSimilar = expectedNormalized.includes(foundNormalized.substring(0, 20)) || 
                          foundNormalized.includes(expectedNormalized.substring(0, 20)) ||
                          matchPercentage >= 70;
        
        if (isSimilar) {
          verificationResult.detected_actions.commented = true;
          verificationResult.confidence_score = Math.max(verificationResult.confidence_score || 0, 85);
          verificationResult.status = "approved";
        }
      }
    }

    // Validate all required actions
    const allActionsPassed = actionsToVerify.every(
      action => verificationResult.detected_actions?.[action] === true
    );

    if (!allActionsPassed && verificationResult.status === "approved") {
      verificationResult.status = "rejected";
      const failedActions = actionsToVerify.filter(
        action => verificationResult.detected_actions?.[action] !== true
      );
      verificationResult.failed_reason = `Could not verify: ${failedActions.join(", ")}. Please ensure your screenshot clearly shows the completed action.`;
    }

    // Determine final status
    const isApproved = verificationResult.status === "approved" && 
                       verificationResult.confidence_score >= confidenceThreshold &&
                       allActionsPassed;
    
    const needsReview = verificationResult.status === "manual_review" || 
      verificationResult.status === "needs_review" ||
      (verificationResult.confidence_score >= 50 && verificationResult.confidence_score < confidenceThreshold);

    verificationResult.provider = verificationMethod;
    verificationResult.approved = isApproved;
    verificationResult.confidence = verificationResult.confidence_score;

    // Store submission
    const submissionStatus = isApproved ? "approved" : (needsReview ? "needs_review" : "rejected");
    
    await supabase
      .from("task_submissions")
      .insert({
        ad_id: adId,
        user_id: userId,
        screenshot_urls: screenshots,
        status: submissionStatus,
        ai_analysis: {
          ...verificationResult,
          verified_at: new Date().toISOString(),
          task_type: taskType,
          required_actions: actionsToVerify,
          expected_comment: expectedComment,
          advertiser_name: advertiserName,
          verification_method: verificationMethod,
        },
        points_awarded: null,
      });

    // Award points if approved
    if (isApproved) {
      const { data: adData } = await supabase
        .from("ads")
        .select("points_per_task, completed_count")
        .eq("id", adId)
        .single();
      
      const pointsToAward = adData?.points_per_task || 10;

      const { data: profile } = await supabase
        .from("profiles")
        .select("tik_points")
        .eq("user_id", userId)
        .single();
      
      if (profile) {
        await supabase
          .from("profiles")
          .update({ tik_points: profile.tik_points + pointsToAward })
          .eq("user_id", userId);
      }

      await supabase
        .from("task_submissions")
        .update({ points_awarded: pointsToAward })
        .eq("ad_id", adId)
        .eq("user_id", userId);

      if (adData) {
        await supabase
          .from("ads")
          .update({ completed_count: (adData.completed_count || 0) + 1 })
          .eq("id", adId);
      }

      await supabase.from("transactions").insert({
        user_id: userId,
        amount: pointsToAward,
        type: "task_reward",
        description: `Completed ${taskType} task`,
        reference_id: adId,
      });

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "task_approved",
        title: "Task Approved! 🎉",
        message: `Your ${taskType} task was approved! You earned ${pointsToAward} Streak Points.`,
        reference_id: adId,
      });

      verificationResult.pointsAwarded = pointsToAward;
    } else if (submissionStatus === "rejected") {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "task_rejected",
        title: "Task Not Approved",
        message: `Your ${taskType} task was not approved. Reason: ${verificationResult.failed_reason || "Verification failed"}`,
        reference_id: adId,
      });
    } else if (submissionStatus === "needs_review") {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "task_pending",
        title: "Task Under Review",
        message: `Your ${taskType} task has been submitted for manual review. You'll be notified once it's processed.`,
        reference_id: adId,
      });
    }

    return new Response(
      JSON.stringify(verificationResult), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({ 
        approved: false, 
        reason: error instanceof Error ? error.message : "Verification failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
