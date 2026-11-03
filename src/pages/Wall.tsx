import { useEffect, useRef } from "react";
import { Smartphone, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tiktokEmbed?: any;
  }
}

const TIKTOK_EMBED_SCRIPT = "https://www.tiktok.com/embed.js";

export default function Wall() {
  const { profile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.tiktok_username) return;

    const ensureScript = () => {
      if (!document.querySelector(`script[src="${TIKTOK_EMBED_SCRIPT}"]`)) {
        const script = document.createElement("script");
        script.src = TIKTOK_EMBED_SCRIPT;
        script.async = true;
        document.head.appendChild(script);
      }
      // Re-trigger embedding after the blockquote is in the DOM
      const rerender = () => {
        try {
          (window as any).tiktokEmbed?.lib?.load();
        } catch {
          /* embed lib not ready yet */
        }
      };
      rerender();
      // Retry a couple of times to allow the script to load
      const timers = [
        window.setTimeout(rerender, 500),
        window.setTimeout(rerender, 1500),
        window.setTimeout(rerender, 3000),
      ];
      return () => timers.forEach(clearTimeout);
    };

    ensureScript();
  }, [profile?.tiktok_username]);

  const username = (profile?.tiktok_username || "").replace(/^@/, "");
  const profileUrl = username ? `https://www.tiktok.com/@${username}` : "";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">My Wall</h2>
            <p className="text-sm text-muted-foreground truncate">
              {username ? `@${username}` : "Your live TikTok profile"}
            </p>
          </div>
        </div>
        {username && (
          <Button variant="gradient" asChild className="shrink-0 self-start sm:self-auto">
            <a href={profileUrl} target="_blank" rel="noreferrer">
              Open in TikTok
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        )}
      </div>

      {!username ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <p>Set your TikTok username on your profile first to unlock your wall.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* HTML preview of the TikTok creator embed */}
            <div
              ref={containerRef}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 640,
                backgroundColor: "#f8f9fa",
                padding: 20,
              }}
            >
              <blockquote
                className="tiktok-embed"
                cite={profileUrl}
                data-unique-id={username}
                data-embed-from="embed_page"
                data-embed-type="creator"
                style={{
                  maxWidth: 780,
                  minWidth: 288,
                  height: 600,
                  boxShadow: "0px 4px 20px rgba(0,0,0,0.1)",
                  borderRadius: 8,
                }}
              >
                <section>
                  <a target="_blank" href={`${profileUrl}?refer=creator_embed`}>
                    @{username}
                  </a>
                </section>
              </blockquote>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}