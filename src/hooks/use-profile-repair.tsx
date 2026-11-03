/**
 * Profile Repair Hook
 * 
 * This hook provides a fallback mechanism to create a user profile
 * when the database trigger fails or doesn't run.
 * 
 * WHY THIS EXISTS:
 * - The auth.users trigger may not run if not properly set up
 * - When using external Supabase projects, the trigger needs to be
 *   created manually via the SQL Editor
 * - This provides a client-side fallback to ensure profiles always exist
 */

import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface ProfileRepairResult {
  success: boolean;
  message?: string;
  error?: string;
}

export function useProfileRepair() {
  /**
   * Checks if a profile exists for the given user
   */
  const checkProfileExists = useCallback(async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[ProfileRepair] Error checking profile:", error);
      return false;
    }

    return !!data;
  }, []);

  /**
   * Attempts to repair a missing profile for the current user
   * Uses the ensure_profile_exists RPC function
   */
  const repairProfile = useCallback(async (user: User): Promise<ProfileRepairResult> => {
    try {
      console.log("[ProfileRepair] Attempting to repair profile for user:", user.id);

      // First check if profile already exists
      const exists = await checkProfileExists(user.id);
      if (exists) {
        console.log("[ProfileRepair] Profile already exists");
        return { success: true, message: "Profile already exists" };
      }

      // Try to create profile using RPC function (type assertion for new function)
      const { data, error } = await (supabase.rpc as any)("ensure_profile_exists", {
        _email: user.email,
        _first_name: user.user_metadata?.first_name || null,
        _last_name: user.user_metadata?.last_name || null,
        _tiktok_username: user.user_metadata?.tiktok_username || null,
        _country: user.user_metadata?.country || null,
      });

      if (error) {
        console.error("[ProfileRepair] RPC error:", error);
        
        // Fallback: Try direct insert if RPC fails
        return await directProfileInsert(user);
      }

      const result = data as { success: boolean; message?: string; error?: string };
      
      if (result.success) {
        console.log("[ProfileRepair] Profile repaired successfully via RPC");
        return { success: true, message: result.message };
      } else {
        console.error("[ProfileRepair] RPC returned error:", result.error);
        return await directProfileInsert(user);
      }
    } catch (err) {
      console.error("[ProfileRepair] Unexpected error:", err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unknown error" 
      };
    }
  }, [checkProfileExists]);

  /**
   * Direct profile insert as last resort fallback
   */
  const directProfileInsert = async (user: User): Promise<ProfileRepairResult> => {
    try {
      console.log("[ProfileRepair] Attempting direct insert...");
      
      // Generate a referral code
      const referralCode = user.id.replace(/-/g, "").substring(0, 8).toUpperCase();
      
      // Generate a safe tiktok username
      const tiktokUsername = user.user_metadata?.tiktok_username || 
        `user_${user.id.replace(/-/g, "").substring(0, 10)}`;

      const { error: insertError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          email: user.email || "no-email@placeholder.local",
          first_name: user.user_metadata?.first_name || null,
          last_name: user.user_metadata?.last_name || null,
          tiktok_username: tiktokUsername,
          country: user.user_metadata?.country || null,
          avatar_url: "🦊",
          referral_code: referralCode,
          tik_points: 0,
        });

      if (insertError) {
        // Check if it's a duplicate key error (profile was created by trigger)
        if (insertError.code === "23505") {
          console.log("[ProfileRepair] Profile already exists (race condition)");
          return { success: true, message: "Profile already exists" };
        }
        
        console.error("[ProfileRepair] Direct insert failed:", insertError);
        return { success: false, error: insertError.message };
      }

      // Also try to create user_role
      await supabase
        .from("user_roles")
        .insert({
          user_id: user.id,
          role: "user",
        })
        .single();

      console.log("[ProfileRepair] Direct insert successful");
      return { success: true, message: "Profile created via direct insert" };
    } catch (err) {
      console.error("[ProfileRepair] Direct insert error:", err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unknown error" 
      };
    }
  };

  /**
   * Ensures a profile exists for the given user
   * Checks first, then repairs if needed
   */
  const ensureProfile = useCallback(async (user: User): Promise<ProfileRepairResult> => {
    const exists = await checkProfileExists(user.id);
    
    if (exists) {
      return { success: true, message: "Profile exists" };
    }

    return await repairProfile(user);
  }, [checkProfileExists, repairProfile]);

  return {
    checkProfileExists,
    repairProfile,
    ensureProfile,
  };
}
