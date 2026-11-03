import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function SocialBar() {
  const [adCode, setAdCode] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    fetchAdSettings();
  }, []);

  useEffect(() => {
    if (adCode && isEnabled && !isLoaded && !hasExecutedRef.current) {
      hasExecutedRef.current = true;
      
      // Parse and execute the social bar script
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = adCode;
      
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
      
      setIsLoaded(true);
    }
  }, [adCode, isEnabled, isLoaded]);

  const fetchAdSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("ad_settings")
        .select("is_enabled, ad_code")
        .eq("ad_type", "social_bar")
        .single();

      if (error) {
        console.error("Error fetching social bar settings:", error);
        return;
      }

      setIsEnabled(data?.is_enabled || false);
      setAdCode(data?.ad_code || null);
    } catch (error) {
      console.error("Error fetching social bar:", error);
    }
  };

  // Social bar is rendered by the external script, we just need to trigger it
  return null;
}