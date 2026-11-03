import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutGrid, 
  Users, 
  Settings,
  BarChart3,
  MessageSquare,
  LogOut,
  Shield,
  Globe,
  Menu,
  Eye,
  Zap,
  Trophy,
  Megaphone,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useModeratorPermissions } from "@/hooks/use-moderator-permissions";
import { Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

const allNavItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/baki/stage/admin", pageKey: "dashboard" },
  { icon: Users, label: "Users", href: "/baki/stage/admin/users", pageKey: "users" },
  { icon: BarChart3, label: "Analytics", href: "/baki/stage/admin/analytics", pageKey: "analytics" },
  { icon: Zap, label: "Raid Manager", href: "/baki/stage/admin/raid", pageKey: "raid" },
  { icon: Trophy, label: "Leaderboards", href: "/baki/stage/admin/leaderboard", pageKey: "leaderboard" },
  { icon: MessageSquare, label: "Live Chats", href: "/baki/stage/admin/live-chats", pageKey: "live-chats" },
  { icon: Megaphone, label: "Communications", href: "/baki/stage/admin/communications", pageKey: "communications" },
  { icon: UserCog, label: "Moderators", href: "/baki/stage/admin/moderators", pageKey: "moderators", adminOnly: true },
  { icon: Eye, label: "Visual Editor", href: "/baki/stage/admin/visual-editor", pageKey: "visual-editor" },
  { icon: Globe, label: "Landing CMS", href: "/baki/stage/admin/landing", pageKey: "landing" },
  { icon: Settings, label: "Settings", href: "/baki/stage/admin/settings", pageKey: "settings", alwaysShow: true },
];

function NavContent({ 
  onItemClick, 
  userRole, 
  hasPageAccess 
}: { 
  onItemClick?: () => void; 
  userRole?: 'admin' | 'moderator' | 'user' | null;
  hasPageAccess: (key: string) => boolean;
}) {
  const location = useLocation();
  
  // Filter items based on role and permissions
  const filteredItems = allNavItems.filter(item => {
    // Admin-only items
    if (item.adminOnly && userRole !== 'admin') return false;
    // Always show certain items (2FA, Settings)
    if (item.alwaysShow) return true;
    // For admins, show all
    if (userRole === 'admin') return true;
    // For moderators, check page access
    return hasPageAccess(item.pageKey);
  });
  
  return (
    <nav className="flex-1 p-4 space-y-1">
      {filteredItems.map((item) => {
        const isActive =
          item.href === "/baki/stage/admin"
            ? location.pathname === item.href
            : location.pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onItemClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, userRole, isLoading } = useAuth();
  const { hasPageAccess, canAccessRoute, isLoading: permissionsLoading } = useModeratorPermissions();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check authentication and 2FA status
  useEffect(() => {
    const verifyAuth = async () => {
      if (isLoading) return;

      // Check if user is not authenticated
      if (!user || !isAdmin) {
        navigate("/baki/stage/admin/login");
        return;
      }

      // Check if there's a pending 2FA (shouldn't be here if pending)
      const pending2FA = sessionStorage.getItem("admin_2fa_pending");
      if (pending2FA) {
        navigate("/baki/stage/admin/verify-2fa");
        return;
      }

      // User is authenticated and no pending 2FA
      setIsVerified(true);
      setCheckingAuth(false);
    };

    verifyAuth();
  }, [user, isAdmin, isLoading, navigate]);

  // Check route access for moderators
  useEffect(() => {
    if (!isLoading && !permissionsLoading && user && isAdmin && userRole === 'moderator' && isVerified) {
      if (!canAccessRoute(location.pathname)) {
        // Redirect to dashboard if no access
        navigate("/baki/stage/admin");
      }
    }
  }, [location.pathname, isLoading, permissionsLoading, user, isAdmin, userRole, canAccessRoute, navigate, isVerified]);

  const handleSignOut = async () => {
    // Clear any pending 2FA state
    sessionStorage.removeItem("admin_2fa_pending");
    
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
    navigate("/baki/stage/admin/login");
  };

  if (isLoading || permissionsLoading || checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isAdmin || !isVerified) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-card flex-col sticky top-0 h-screen z-30 self-start">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="font-semibold text-foreground">Admin Panel</span>
              <p className="text-xs text-muted-foreground capitalize">{userRole || 'Admin'}</p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <NavContent userRole={userRole} hasPageAccess={hasPageAccess} />
        </ScrollArea>

        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between px-4">
            <span className="text-sm text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6">
          {/* Mobile Menu */}
          <div className="lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold">Admin Panel</span>
                      <p className="text-xs text-muted-foreground capitalize">{userRole || 'Admin'}</p>
                    </div>
                  </div>
                </div>
                
                {/* Scrollable nav area */}
                <ScrollArea className="flex-1">
                  <NavContent 
                    onItemClick={() => setMobileOpen(false)} 
                    userRole={userRole} 
                    hasPageAccess={hasPageAccess}
                  />
                </ScrollArea>
                
                <div className="p-4 border-t border-border space-y-2 mt-auto">
                  <div className="flex items-center justify-between px-4">
                    <span className="text-sm text-muted-foreground">Theme</span>
                    <ThemeToggle />
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <h1 className="text-lg font-medium truncate text-foreground">
            {allNavItems.find(item =>
              item.href === "/baki/stage/admin"
                ? location.pathname === item.href
                : location.pathname.startsWith(item.href)
            )?.label || "Admin"}
          </h1>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-sm text-muted-foreground">
              <span className="text-foreground">{user?.email}</span>
            </div>
            <div className="lg:hidden">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
