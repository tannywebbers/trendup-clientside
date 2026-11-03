import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NativeAdCardProps {
  className?: string;
}

/**
 * A flexible native ad component that can be inserted between content cards.
 * It blends with the UI and adapts to its container.
 */
export function NativeAdCard({ className = "" }: NativeAdCardProps) {
  const [adCode, setAdCode] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const instanceId = useRef(`native-ad-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    fetchAdSettings();
  }, []);

  useEffect(() => {
    if (adCode && isEnabled && containerRef.current && !isLoaded) {
      // Clear previous content
      containerRef.current.innerHTML = "";
      
      // Parse the ad code
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = adCode;
      
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
      
      // Execute scripts
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
    }
  }, [adCode, isEnabled, isLoaded]);

  const fetchAdSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("ad_settings")
        .select("is_enabled, ad_code")
        .eq("ad_type", "native_feed")
        .single();

      if (error) {
        console.error("Error fetching native ad settings:", error);
        return;
      }

      setIsEnabled(data?.is_enabled || false);
      setAdCode(data?.ad_code || null);
    } catch (error) {
      console.error("Error fetching native ad:", error);
    }
  };

  if (!isEnabled || !adCode) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      id={instanceId.current}
      className={`native-ad-card w-full rounded-lg overflow-hidden ${className}`}
      data-ad-type="native_feed"
    />
  );
}
