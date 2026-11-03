import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppSettings {
  app_name: string | null;
  app_description: string | null;
  pwa_icon_url: string | null;
  primary_color: string | null;
}

export function usePwaManifest() {
  useEffect(() => {
    const updateManifest = async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("app_name, app_description, pwa_icon_url, primary_color")
          .limit(1)
          .maybeSingle();

        if (error || !data) return;

        const settings = data as AppSettings;
        
        // Only update manifest if we have a custom PWA icon
        if (!settings.pwa_icon_url) return;

        // Create dynamic manifest
        const manifest = {
          name: settings.app_name || "TrendUp",
          short_name: settings.app_name || "TrendUp",
          description: settings.app_description || "Exchange engagement with real users on TikTok",
          theme_color: settings.primary_color || "#ec4899",
          background_color: "#0a0a0f",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: settings.pwa_icon_url,
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: settings.pwa_icon_url,
              sizes: "512x512",
              type: "image/png"
            },
            {
              src: settings.pwa_icon_url,
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ]
        };

        // Create blob URL for the manifest
        const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
        const manifestUrl = URL.createObjectURL(manifestBlob);

        // Update or create the manifest link
        let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (manifestLink) {
          // Revoke old blob URL if it was a blob
          if (manifestLink.href.startsWith('blob:')) {
            URL.revokeObjectURL(manifestLink.href);
          }
          manifestLink.href = manifestUrl;
        } else {
          manifestLink = document.createElement('link');
          manifestLink.rel = 'manifest';
          manifestLink.href = manifestUrl;
          document.head.appendChild(manifestLink);
        }

        // Update apple-touch-icon if it exists
        const appleTouchIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
        if (appleTouchIcon) {
          appleTouchIcon.href = settings.pwa_icon_url;
        }

        // Update theme-color meta tag
        const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        if (themeColorMeta && settings.primary_color) {
          themeColorMeta.content = settings.primary_color;
        }
      } catch (error) {
        console.error("Error updating PWA manifest:", error);
      }
    };

    updateManifest();
  }, []);
}
