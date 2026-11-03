import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdPopupProps {
  adType: "popup" | "popunder" | "interstitial";
  showOnce?: boolean;
}

export function AdPopup({ adType, showOnce = true }: AdPopupProps) {
  const [hasShown, setHasShown] = useState(false);
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    // Check if already shown in this session
    const storageKey = `ad_shown_${adType}`;
    if (showOnce && sessionStorage.getItem(storageKey)) {
      return;
    }

    if (hasExecutedRef.current) {
      return;
    }

    const loadAd = async () => {
      try {
        const { data, error } = await supabase
          .from("ad_settings")
          .select("is_enabled, ad_code")
          .eq("ad_type", adType)
          .single();

        if (error || !data?.is_enabled || !data?.ad_code || hasShown) {
          return;
        }

        hasExecutedRef.current = true;

        // Parse and execute the ad script
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = data.ad_code;
        
        const scripts = tempDiv.querySelectorAll("script");
        
        scripts.forEach((script) => {
          const newScript = document.createElement("script");
          
          // Copy all attributes
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
        
        setHasShown(true);
        if (showOnce) {
          sessionStorage.setItem(storageKey, "true");
        }
      } catch (error) {
        console.error("Error loading popup ad:", error);
      }
    };

    // Delay popup ads slightly to not interrupt initial load
    const timer = setTimeout(loadAd, 3000);
    return () => clearTimeout(timer);
  }, [adType, showOnce, hasShown]);

  // This component doesn't render anything visible - the ad script handles the popup
  return null;
}