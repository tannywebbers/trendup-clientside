import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface ModeratorPermissions {
  pages: string[];
  can_manage_chat: boolean;
  can_review_submissions: boolean;
  can_manage_users: boolean;
  can_credit_users: boolean;
  is_suspended: boolean;
}

export function useModeratorPermissions() {
  const { user, userRole } = useAuth();
  const [permissions, setPermissions] = useState<ModeratorPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && userRole === 'moderator') {
      fetchPermissions();
    } else if (user && userRole === 'admin') {
      // Admins have full access
      setPermissions({
        pages: ['all'],
        can_manage_chat: true,
        can_review_submissions: true,
        can_manage_users: true,
        can_credit_users: true,
        is_suspended: false,
      });
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [user, userRole]);

  const fetchPermissions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("moderator_permissions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setPermissions({
          pages: data.pages || [],
          can_manage_chat: data.can_manage_chat,
          can_review_submissions: data.can_review_submissions,
          can_manage_users: data.can_manage_users,
          can_credit_users: false, // Moderators can never credit users by default
          is_suspended: data.is_suspended,
        });
      }
    } catch (err) {
      console.error("Error fetching moderator permissions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const hasPageAccess = (pageKey: string): boolean => {
    if (!permissions) return false;
    if (userRole === 'admin') return true;
    if (permissions.is_suspended) return false;
    return permissions.pages.includes(pageKey) || permissions.pages.includes('all');
  };

  const canAccessRoute = (route: string): boolean => {
    if (!permissions) return false;
    if (userRole === 'admin') return true;
    if (permissions.is_suspended) return false;
    
    // Map routes to page keys
    const routeToPageMap: Record<string, string> = {
      '/baki/stage/admin': 'dashboard',
      '/baki/stage/admin/activities': 'activities',
      '/baki/stage/admin/submissions': 'submissions',
      '/baki/stage/admin/analytics': 'analytics',
      '/baki/stage/admin/raid': 'raid',
      '/baki/stage/admin/leaderboard': 'leaderboard',
      '/baki/stage/admin/users': 'users',
      '/baki/stage/admin/live-chats': 'live-chats',
      '/baki/stage/admin/moderators': 'moderators', // admin only
      '/baki/stage/admin/communications': 'communications',
      '/baki/stage/admin/ai-config': 'ai-config',
      '/baki/stage/admin/prompts': 'prompts',
      '/baki/stage/admin/visual-editor': 'visual-editor',
      '/baki/stage/admin/landing': 'landing',
      '/baki/stage/admin/app-settings': 'app-settings',
      '/baki/stage/admin/email': 'email',
      '/baki/stage/admin/ads': 'ads',
      '/baki/stage/admin/2fa': '2fa', // Always accessible
      '/baki/stage/admin/settings': 'settings',
    };

    // Settings hub and its sub-pages are always accessible
    if (route === '/baki/stage/admin/settings' || route.startsWith('/baki/stage/admin/settings/')) {
      return true;
    }

    // User detail screen follows the users page permission
    if (route.startsWith('/baki/stage/admin/users/')) {
      return hasPageAccess('users');
    }

    // Communications sub-pages follow the communications page permission
    if (route.startsWith('/baki/stage/admin/communications')) {
      return hasPageAccess('communications');
    }

    const pageKey = routeToPageMap[route];
    
    // 2FA and settings are always accessible
    if (pageKey === '2fa' || pageKey === 'settings') return true;
    
    // Moderators page is admin only
    if (pageKey === 'moderators') return false;
    
    return hasPageAccess(pageKey);
  };

  return {
    permissions,
    isLoading,
    hasPageAccess,
    canAccessRoute,
    canCreditUsers: userRole === 'admin' || (permissions?.can_credit_users ?? false),
  };
}
