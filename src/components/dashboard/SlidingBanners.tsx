import { useState, useEffect } from "react";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SlidingBanner {
  id: string;
  message: string;
  is_active: boolean;
}

export function SlidingBanners() {
  const [banners, setBanners] = useState<SlidingBanner[]>([]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("sliding_banners")
        .select("id, message, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (live) setBanners((data as SlidingBanner[]) || []);
    };
    load();

    const channel = supabase
      .channel("sliding-banners")
      .on("postgres_changes", { event: "*", schema: "public", table: "sliding_banners" }, load)
      .subscribe();

    return () => {
      live = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const marqueeItems = banners.length > 0 ? [...banners, ...banners] : [];

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden mb-4">
      {banners.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
          <Megaphone className="w-3.5 h-3.5 shrink-0" />
          Raid announcements will appear here once the admin adds them.
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2 overflow-hidden">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-foreground bg-gradient-to-r from-primary to-accent rounded-lg px-2.5 py-1 shrink-0">
            <Megaphone className="w-3.5 h-3.5" />
            Announcement
          </span>
          <div className="relative flex-1 overflow-hidden whitespace-nowrap">
            <div className="flex w-max animate-marquee gap-12">
              {marqueeItems.map((banner, i) => (
                <span
                  key={`${banner.id}-${i}`}
                  className="text-sm font-medium text-foreground whitespace-nowrap"
                >
                  <span className="text-primary mr-2">•</span>
                  {banner.message}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}