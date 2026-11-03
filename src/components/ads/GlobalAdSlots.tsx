import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdSlotProps {
  slot: 'top_banner' | 'feed_inline' | 'footer_banner' | 'dashboard_banner' | 'wallet_banner';
  className?: string;
}

interface AdSetting {
  id: string;
  ad_type: string;
  ad_code: string | null;
  is_enabled: boolean;
  placement: string | null;
}

// Map slot names to ad_type values
const slotToAdType: Record<string, string> = {
  top_banner: 'banner_top',
  feed_inline: 'native_ads',
  footer_banner: 'banner_bottom',
  dashboard_banner: 'banner_top',
  wallet_banner: 'banner_bottom',
};

export function GlobalAdSlot({ slot, className = "" }: AdSlotProps) {
  const [adSetting, setAdSetting] = useState<AdSetting | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAdSetting();
  }, [slot]);

  useEffect(() => {
    if (adSetting?.ad_code && adSetting?.is_enabled && containerRef.current && !isLoaded) {
      renderAdCode();
    }
  }, [adSetting, isLoaded]);

  const fetchAdSetting = async () => {
    try {
      const adType = slotToAdType[slot] || slot;
      
      const { data, error } = await supabase
        .from("ad_settings")
        .select("*")
        .eq("ad_type", adType)
        .eq("is_enabled", true)
        .maybeSingle();

      if (error) {
        console.error(`Error fetching ad for slot ${slot}:`, error);
        return;
      }

      setAdSetting(data);
    } catch (error) {
      console.error(`Error fetching ad slot ${slot}:`, error);
    }
  };

  const renderAdCode = () => {
    if (!containerRef.current || !adSetting?.ad_code) return;

    // Clear previous content
    containerRef.current.innerHTML = "";
    
    // Parse and execute the ad code
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = adSetting.ad_code;
    
    // Find all scripts
    const scripts = tempDiv.querySelectorAll("script");
    const nonScriptContent: Node[] = [];
    
    // Clone non-script elements
    tempDiv.childNodes.forEach((node) => {
      if (node.nodeName !== "SCRIPT") {
        nonScriptContent.push(node.cloneNode(true));
      }
    });
    
    // Append non-script content first
    nonScriptContent.forEach((node) => {
      containerRef.current?.appendChild(node);
    });
    
    // Execute scripts in order
    scripts.forEach((script) => {
      const newScript = document.createElement("script");
      
      Array.from(script.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      
      if (script.src) {
        newScript.src = script.src;
        newScript.async = true;
      } else if (script.textContent) {
        newScript.textContent = script.textContent;
      }
      
      document.body.appendChild(newScript);
    });
    
    setIsLoaded(true);
  };

  if (!adSetting?.is_enabled || !adSetting?.ad_code) {
    return null;
  }

  // Centered container styling based on slot type
  const getContainerStyle = () => {
    switch (slot) {
      case 'footer_banner':
        return 'flex justify-center items-center w-full py-4 bg-muted/30';
      case 'top_banner':
      case 'dashboard_banner':
        return 'flex justify-center items-center w-full py-2 bg-muted/20';
      case 'feed_inline':
        return 'flex justify-center items-center my-4';
      case 'wallet_banner':
        return 'flex justify-center items-center py-3';
      default:
        return 'flex justify-center items-center';
    }
  };

  return (
    <div className={`${getContainerStyle()} ${className}`}>
      <div 
        ref={containerRef}
        className="ad-slot max-w-full"
        data-ad-slot={slot}
      />
    </div>
  );
}

// Convenience components for specific slots
export function TopBannerAd({ className }: { className?: string }) {
  return <GlobalAdSlot slot="top_banner" className={className} />;
}

export function FooterBannerAd({ className }: { className?: string }) {
  return <GlobalAdSlot slot="footer_banner" className={className} />;
}

export function FeedInlineAd({ className }: { className?: string }) {
  return <GlobalAdSlot slot="feed_inline" className={className} />;
}

export function DashboardBannerAd({ className }: { className?: string }) {
  return <GlobalAdSlot slot="dashboard_banner" className={className} />;
}

export function WalletBannerAd({ className }: { className?: string }) {
  return <GlobalAdSlot slot="wallet_banner" className={className} />;
}
