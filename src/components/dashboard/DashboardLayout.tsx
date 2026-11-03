import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Coins, 
  LayoutGrid, 
  Wallet, 
  User, 
  PlusCircle, 
  BarChart3,
  LogOut,
  Menu,
  X,
  Gift,
  Flame,
  Zap,
  Trophy,
  Megaphone,
  Smartphone,
  Bell,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { SlidingBanners } from "./SlidingBanners";
import { AdBanner } from "@/components/ads/AdBanner";
import { AdPopup } from "@/components/ads/AdPopup";
import { SocialBar } from "@/components/ads/SocialBar";

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: Flame, label: "Check-In", href: "/dashboard/check-in" },
  { icon: Zap, label: "Raid", href: "/dashboard/raid" },
  { icon: BarChart3, label: "Browse Contents", href: "/dashboard/tasks" },
  { icon: Trophy, label: "Leaderboard", href: "/dashboard/leaderboard" },
  { icon: Wallet, label: "Wallet", href: "/dashboard/wallet" },
  { icon: PlusCircle, label: "Add Post", href: "/dashboard/create-ad" },
  { icon: Megaphone, label: "My Posts", href: "/dashboard/my-ads" },
  { icon: Smartphone, label: "My Wall", href: "/dashboard/wall" },
  { icon: Gift, label: "Referrals", href: "/dashboard/referrals" },
  { icon: Bell, label: "Notifications", href: "/dashboard/notifications" },
  { icon: User, label: "Profile", href: "/dashboard/profile" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleProfileClick = () => {
    navigate("/dashboard/profile");
  };

  // Generate avatar display from emoji or initials
  const getAvatarDisplay = () => {
    if (profile?.avatar_url) {
      // Check if it's an emoji
      if (/\p{Emoji}/u.test(profile.avatar_url)) {
        return (
          <span className="text-xl">{profile.avatar_url}</span>
        );
      }
      // It's an image URL
      return (
        <img 
          src={profile.avatar_url} 
          alt="Profile" 
          className="w-full h-full object-cover rounded-full"
        />
      );
    }
    // Default gradient avatar
    return null;
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card sticky top-0 h-screen self-start z-30">
        <div className="p-6 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Coins className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">TrendUp</span>
          </Link>
        </div>
        
        <ScrollArea className="flex-1 min-h-0">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="lg:hidden fixed inset-0 z-50"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border flex flex-col"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Coins className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">TrendUp</span>
              </Link>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <ScrollArea className="flex-1 min-h-0">
              <nav className="p-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        isActive 
                          ? "bg-primary text-primary-foreground" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </ScrollArea>
            
            <div className="p-4 border-t border-border mt-auto">
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 text-muted-foreground" 
                onClick={() => { handleSignOut(); setSidebarOpen(false); }}
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </Button>
            </div>
          </motion.aside>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold hidden sm:block">Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Points Balance */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted">
              <Flame className="w-4 h-4 text-primary" />
              <span className="font-semibold">{profile?.tik_points || 0}</span>
              <Badge variant="gradient" className="text-xs">Points</Badge>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <NotificationsDropdown />

            {/* Profile - Always navigates to profile page */}
            <button
              onClick={handleProfileClick}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            >
              {getAvatarDisplay()}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {/* Sliding raid/announcement banners */}
          <SlidingBanners />

          {/* Top Banner Ad in Dashboard - Leaderboard format */}
          <AdBanner adType="banner_top" className="w-full flex justify-center mb-4" />
          
          <Outlet />
          
          {/* Bottom Banner Ad - Leaderboard format */}
          <AdBanner adType="banner_bottom" className="w-full flex justify-center mt-6" />
        </main>
        
        {/* Popup Ads - Only show once per session */}
        <AdPopup adType="popup" />
        <AdPopup adType="popunder" />
        
        {/* Social Bar */}
        <SocialBar />
      </div>
    </div>
  );
}
