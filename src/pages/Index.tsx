import { useEffect, useState } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TrustedBy } from "@/components/landing/TrustedBy";
import { Footer } from "@/components/landing/Footer";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AdBanner } from "@/components/ads/AdBanner";
import { AdPopup } from "@/components/ads/AdPopup";
import { SocialBar } from "@/components/ads/SocialBar";

interface SiteSettings {
  site_name?: string;
  site_logo?: string;
  support_email?: string;
  maintenance_mode?: boolean;
}

interface MaintenanceSettings {
  enabled?: boolean;
  ends_at?: string;
  show_countdown?: boolean;
  message_html?: string;
}

interface LandingSection {
  section_key: string;
  title: string | null;
  subtitle: string | null;
  content: string | null;
  image_url: string | null;
  button_text: string | null;
  button_url: string | null;
  is_visible: boolean;
}

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const Index = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSettings>({});
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [sections, setSections] = useState<Record<string, LandingSection>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch site settings
        const [{ data: settingsData }, { data: maintData }] = await Promise.all([
          supabase
            .from("platform_settings")
            .select("key, value")
            .eq("key", "site_settings")
            .maybeSingle(),
          supabase
            .from("platform_settings")
            .select("key, value")
            .eq("key", "maintenance_settings")
            .maybeSingle(),
        ]);

        if (settingsData) {
          const settings = settingsData.value as SiteSettings;
          setSiteSettings(settings);
          setMaintenanceMode(settings.maintenance_mode || false);

          // Update PWA manifest dynamically if logo is set
          if (settings.site_logo) {
            updatePWAManifest(settings);
          }
        }

        if (maintData) {
          const settings = maintData.value as MaintenanceSettings;
          setMaintenanceSettings(settings);
          if (settings.enabled) setMaintenanceMode(true);
        }

        // Fetch landing content
        const { data: landingData } = await supabase
          .from("landing_content")
          .select("*")
          .order("sort_order");

        if (landingData) {
          const sectionsMap: Record<string, LandingSection> = {};
          landingData.forEach((section) => {
            sectionsMap[section.section_key] = section;
          });
          setSections(sectionsMap);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Live countdown to maintenance end
  useEffect(() => {
    if (!maintenanceMode || !maintenanceSettings.ends_at) return;
    const end = new Date(maintenanceSettings.ends_at);
    if (isNaN(end.getTime())) return;

    const tick = () => {
      const diff = end.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining(null);
        setMaintenanceMode(false);
        return;
      }
      setRemaining({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [maintenanceMode, maintenanceSettings.ends_at]);

  // Update PWA manifest with admin-configured logo
  const updatePWAManifest = (settings: SiteSettings) => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink && settings.site_logo) {
      // Create a dynamic manifest
      const manifest = {
        name: settings.site_name || "TrendUp",
        short_name: settings.site_name || "TrendUp",
        description: "Exchange engagement with real users and grow on TikTok",
        theme_color: "#ec4899",
        background_color: "#0a0a0f",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: settings.site_logo,
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: settings.site_logo,
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: settings.site_logo,
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      };

      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      const manifestURL = URL.createObjectURL(blob);
      manifestLink.setAttribute('href', manifestURL);
    }

    // Update document title
    if (settings.site_name) {
      document.title = `${settings.site_name} - TikTok Engagement Exchange`;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (maintenanceMode) {
    const showCountdown = maintenanceSettings.show_countdown && maintenanceSettings.ends_at && remaining;
    const countdownParts = remaining
      ? [
          { label: "Days", value: remaining.days },
          { label: "Hours", value: remaining.hours },
          { label: "Minutes", value: remaining.minutes },
          { label: "Seconds", value: remaining.seconds },
        ]
      : [];

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          {maintenanceSettings.message_html ? (
            <div
              className="[&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: maintenanceSettings.message_html }}
            />
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-warning" />
              </div>
              <h1 className="text-3xl font-bold mb-4">Under Maintenance</h1>
              <p className="text-muted-foreground mb-6">
                {siteSettings.site_name || "TrendUp"} is currently undergoing scheduled maintenance. 
                We'll be back shortly. Thank you for your patience!
              </p>
            </>
          )}

          {showCountdown && (
            <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto mt-6 mb-8">
              {countdownParts.map((part) => (
                <div
                  key={part.label}
                  className="rounded-xl bg-muted/50 border p-3"
                >
                  <div className="text-2xl font-bold tabular-nums text-primary">
                    {String(part.value).padStart(2, "0")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{part.label}</div>
                </div>
              ))}
            </div>
          )}

          {siteSettings.support_email && (
            <p className="text-sm text-muted-foreground">
              For urgent inquiries, contact us at{" "}
              <a href={`mailto:${siteSettings.support_email}`} className="text-primary hover:underline">
                {siteSettings.support_email}
              </a>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Prepare content for each section from DB
  const heroContent = sections.hero ? {
    title: sections.hero.title || "Earn & Grow on TikTok",
    subtitle: sections.hero.subtitle || "AI-Powered TikTok Engagement Exchange",
    content: sections.hero.content || "Exchange engagement with real users by engaging on others' content and boosting your own profile.",
    button_text: sections.hero.button_text || "Start Growing Now",
    button_url: sections.hero.button_url || "/register",
    is_visible: sections.hero.is_visible,
  } : undefined;

  const statsContent = sections.stats ? {
    title: sections.stats.title || "Our Stats",
    subtitle: sections.stats.subtitle || "Join our growing community",
    content: sections.stats.content || "",
    is_visible: sections.stats.is_visible,
  } : undefined;

  const howItWorksContent = sections.how_it_works ? {
    title: sections.how_it_works.title || "How It Works",
    subtitle: sections.how_it_works.subtitle || "Start growing on TikTok in minutes with our simple 4-step process",
    content: sections.how_it_works.content || "",
    is_visible: sections.how_it_works.is_visible,
  } : undefined;

  const featuresContent = sections.features ? {
    title: sections.features.title || "AI-Powered Verification",
    subtitle: sections.features.subtitle || "Why Choose Us",
    content: sections.features.content || "",
    is_visible: sections.features.is_visible,
  } : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Top Banner Ad */}
      <AdBanner adType="banner_top" className="w-full flex justify-center py-2 bg-muted/30" />
      
      {/* Hero Section */}
      {sections.hero?.is_visible !== false && <HeroSection content={heroContent} />}
      
      {/* Stats Section */}
      {sections.stats?.is_visible !== false && <StatsSection content={statsContent} />}
      
      {/* How It Works */}
      {sections.how_it_works?.is_visible !== false && <HowItWorks content={howItWorksContent} />}
      
      {/* Features Section */}
      {sections.features?.is_visible !== false && <FeaturesSection content={featuresContent} />}
      
      {/* Trusted Brands */}
      <TrustedBy />
      
      {/* Pricing Section */}
      <PricingSection />
      
      {/* Bottom Banner Ad */}
      <AdBanner adType="banner_bottom" className="w-full flex justify-center py-4 bg-muted/30" />
      
      <Footer />
      
      {/* Popup Ads */}
      <AdPopup adType="popup" />
      <AdPopup adType="popunder" />
      <AdPopup adType="interstitial" />
      
      {/* Social Bar */}
      <SocialBar />
    </div>
  );
};

export default Index;
