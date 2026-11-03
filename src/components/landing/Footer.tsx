import { Link, useNavigate } from "react-router-dom";
import { Coins, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FooterBannerAd } from "@/components/ads/GlobalAdSlots";
import { useAuth } from "@/hooks/use-auth";
import { 
  FaFacebook, 
  FaTwitter, 
  FaInstagram, 
  FaTiktok, 
  FaYoutube,
  FaWhatsapp,
  FaTelegram
} from "react-icons/fa";

interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
}

interface FooterSettings {
  app_name: string;
  app_description: string;
  social_links: SocialLinks;
  community_link: string;
  community_label: string;
  support_email: string;
}

const defaultSettings: FooterSettings = {
  app_name: "TrendUp",
  app_description: "The leading platform for TikTok engagement exchange. Exchange engagement with real users and grow your profile.",
  social_links: {},
  community_link: "",
  community_label: "Community",
  support_email: "",
};

// Smart link component that handles auth state
function SmartLink({ 
  to, 
  children, 
  requiresAuth = false 
}: { 
  to: string; 
  children: React.ReactNode; 
  requiresAuth?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    if (requiresAuth && !user) {
      e.preventDefault();
      navigate("/login");
    }
  };

  const actualPath = requiresAuth && user ? `/dashboard${to}` : to;
  
  return (
    <Link 
      to={requiresAuth && !user ? "/login" : actualPath}
      onClick={handleClick}
      className="hover:text-primary transition-colors"
    >
      {children}
    </Link>
  );
}

export function Footer() {
  const [settings, setSettings] = useState<FooterSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("app_name, app_description, social_links, community_link, community_label, support_email")
        .limit(1)
        .maybeSingle();

      if (data) {
        setSettings({
          app_name: data.app_name || defaultSettings.app_name,
          app_description: data.app_description || defaultSettings.app_description,
          social_links: (data.social_links as SocialLinks) || {},
          community_link: data.community_link || "",
          community_label: data.community_label || "Community",
          support_email: data.support_email || "",
        });
      }
    } catch (error) {
      console.error("Error fetching footer settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSocialIcon = (platform: string) => {
    const iconClass = "w-5 h-5";
    switch (platform) {
      case "facebook": return <FaFacebook className={iconClass} />;
      case "twitter": return <FaTwitter className={iconClass} />;
      case "instagram": return <FaInstagram className={iconClass} />;
      case "tiktok": return <FaTiktok className={iconClass} />;
      case "youtube": return <FaYoutube className={iconClass} />;
      default: return null;
    }
  };

  const getCommunityIcon = () => {
    if (settings.community_link.includes("whatsapp")) {
      return <FaWhatsapp className="w-4 h-4 mr-2" />;
    }
    if (settings.community_link.includes("telegram") || settings.community_link.includes("t.me")) {
      return <FaTelegram className="w-4 h-4 mr-2" />;
    }
    return null;
  };

  const hasSocialLinks = Object.values(settings.social_links).some(link => link && link.trim());

  return (
    <footer className="py-12 border-t border-border">
      {/* Footer Ad Banner */}
      <FooterBannerAd className="mb-8" />
      
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Coins className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">{settings.app_name}</span>
            </Link>
            <p className="text-muted-foreground text-sm mb-4">
              {settings.app_description}
            </p>
            
            {/* Social Media Buttons */}
            {hasSocialLinks && (
              <div className="flex gap-3 mt-4">
                {Object.entries(settings.social_links).map(([platform, url]) => (
                  url && url.trim() && (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition-colors flex items-center justify-center"
                      aria-label={platform}
                    >
                      {getSocialIcon(platform)}
                    </a>
                  )
                ))}
              </div>
            )}
          </div>
          
          {/* Platform Links */}
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <SmartLink to="/tasks" requiresAuth>Browse Tasks</SmartLink>
              </li>
              <li>
                <SmartLink to="/create-ad" requiresAuth>Create Ad</SmartLink>
              </li>
              <li>
                <SmartLink to="/wallet" requiresAuth>Wallet</SmartLink>
              </li>
            </ul>
          </div>
          
          {/* Support Links */}
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent("openLiveChat"))}
                  className="hover:text-primary transition-colors"
                >
                  Help Center
                </button>
              </li>
              <li>
                <Link to="/contact" className="hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/faqs" className="hover:text-primary transition-colors">
                  FAQs
                </Link>
              </li>
              {settings.community_link && (
                <li>
                  <a 
                    href={settings.community_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors flex items-center"
                  >
                    {getCommunityIcon()}
                    {settings.community_label}
                  </a>
                </li>
              )}
            </ul>
          </div>
          
          {/* Legal Links */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/terms" className="hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:text-primary transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border mt-12 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {settings.app_name} Exchange. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
