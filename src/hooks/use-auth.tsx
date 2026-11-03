import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  tiktok_username: string;
  country: string | null;
  avatar_url: string | null;
  tik_points: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isModerator: boolean;
  userRole: 'admin' | 'moderator' | 'user' | null;
  isLoading: boolean;
  signUp: (email: string, password: string, metadata: { first_name: string; last_name: string; tiktok_username: string; country?: string | null; referral_code?: string }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'moderator' | 'user' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
    return data as Profile | null;
  };

  const checkUserRole = async (userId: string): Promise<{ isAdmin: boolean; isModerator: boolean; role: 'admin' | 'moderator' | 'user' | null }> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      console.error("Error checking user role:", error);
      return { isAdmin: false, isModerator: false, role: null };
    }
    
    const roles = data?.map(r => r.role) || [];
    // Staff roles mirror TrendUp: owner/administrator = admin-level, everything else staff
    const isAdmin = roles.some(r => ['admin', 'owner', 'administrator'].includes(r));
    const isModerator = roles.some(r => ['moderator', 'support', 'finance', 'admin', 'owner', 'administrator'].includes(r));
    
    let role: 'admin' | 'moderator' | 'user' | null = null;
    if (isAdmin) role = 'admin';
    else if (isModerator) role = 'moderator';
    else if (data && data.length > 0) role = 'user';
    
    return { isAdmin, isModerator, role };
  };

  /**
   * Repair missing profile - fallback when trigger doesn't run
   */
  const repairMissingProfile = useCallback(async (currentUser: User): Promise<Profile | null> => {
    console.log("[Auth] Attempting to repair missing profile for:", currentUser.id);
    
    try {
      // Try RPC function first (using type assertion since function may not be in types yet)
      const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)("ensure_profile_exists", {
        _email: currentUser.email,
        _first_name: currentUser.user_metadata?.first_name || null,
        _last_name: currentUser.user_metadata?.last_name || null,
        _tiktok_username: currentUser.user_metadata?.tiktok_username || null,
        _country: currentUser.user_metadata?.country || null,
      });

      if (!rpcError) {
        const result = rpcResult as { success: boolean };
        if (result?.success) {
          console.log("[Auth] Profile repaired via RPC");
          // Fetch the newly created profile
          const newProfile = await fetchProfile(currentUser.id);
          return newProfile;
        }
      }

      // Fallback: Direct insert
      console.log("[Auth] RPC failed, trying direct insert...");
      const referralCode = currentUser.id.replace(/-/g, "").substring(0, 8).toUpperCase();
      const tiktokUsername = currentUser.user_metadata?.tiktok_username || 
        `user_${currentUser.id.replace(/-/g, "").substring(0, 10)}`;

      const { error: insertError } = await supabase
        .from("profiles")
        .insert({
          user_id: currentUser.id,
          email: currentUser.email || "no-email@placeholder.local",
          first_name: currentUser.user_metadata?.first_name || null,
          last_name: currentUser.user_metadata?.last_name || null,
          tiktok_username: tiktokUsername,
          country: currentUser.user_metadata?.country || null,
          avatar_url: "🦊",
          referral_code: referralCode,
          tik_points: 0,
        });

      if (insertError && insertError.code !== "23505") {
        console.error("[Auth] Direct insert failed:", insertError);
        return null;
      }

      // Create user role if needed
      await supabase
        .from("user_roles")
        .insert({ user_id: currentUser.id, role: "user" })
        .single();

      console.log("[Auth] Profile created via direct insert");
      return await fetchProfile(currentUser.id);
    } catch (err) {
      console.error("[Auth] Profile repair failed:", err);
      return null;
    }
  }, []);

  const refreshProfile = async () => {
    if (user) {
      let profileData = await fetchProfile(user.id);
      
      // If no profile, try to repair it
      if (!profileData) {
        profileData = await repairMissingProfile(user);
      }
      
      setProfile(profileData);
    }
  };

  const handleAuthChange = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);

    if (currentSession?.user) {
      // Fetch profile
      let profileData = await fetchProfile(currentSession.user.id);
      
      // If no profile exists, try to repair it
      if (!profileData) {
        console.log("[Auth] No profile found, attempting repair...");
        profileData = await repairMissingProfile(currentSession.user);
      }
      
      setProfile(profileData);
      
      // Check roles
      const roleStatus = await checkUserRole(currentSession.user.id);
      setIsAdmin(roleStatus.isAdmin || roleStatus.isModerator);
      setIsModerator(roleStatus.isModerator);
      setUserRole(roleStatus.role);
    } else {
      setProfile(null);
      setIsAdmin(false);
      setIsModerator(false);
      setUserRole(null);
    }
    
    setIsLoading(false);
  }, [repairMissingProfile]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Use setTimeout to avoid potential deadlocks
        setTimeout(() => handleAuthChange(session), 0);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthChange(session);
    });

    return () => subscription.unsubscribe();
  }, [handleAuthChange]);

  const signUp = async (
    email: string, 
    password: string, 
    metadata: { first_name: string; last_name: string; tiktok_username: string; country?: string | null; referral_code?: string }
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata,
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: error.message,
      });
      return { error };
    }

    // If user was created, ensure profile exists
    if (data.user) {
      // Small delay to allow trigger to run
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let profileData = await fetchProfile(data.user.id);
      if (!profileData) {
        console.log("[Auth] Profile not created by trigger, repairing...");
        profileData = await repairMissingProfile(data.user);
      }
      setProfile(profileData);
    }

    toast({
      title: "Account created!",
      description: "Welcome to TrendUp! You can now start growing.",
    });

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: error.message,
      });
      return { error };
    }

    // Ensure profile exists after login
    if (data.user) {
      let profileData = await fetchProfile(data.user.id);
      if (!profileData) {
        console.log("[Auth] Profile missing after login, repairing...");
        profileData = await repairMissingProfile(data.user);
      }
      setProfile(profileData);
    }

    toast({
      title: "Welcome back!",
      description: "You have successfully signed in.",
    });

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setIsModerator(false);
    setUserRole(null);
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isAdmin,
      isModerator,
      userRole,
      isLoading,
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
