import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles, Heart, MessageCircle, Bookmark, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface HeroContent {
  title: string;
  subtitle: string;
  content: string;
  button_text: string;
  button_url: string;
  is_visible: boolean;
}

interface HeroSectionProps {
  content?: HeroContent;
}

function useCountUp(target: number, duration = 2000, start = false) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);

  return value.toLocaleString();
}

export function HeroSection({ content }: HeroSectionProps) {
  const [heroContent, setHeroContent] = useState<HeroContent | null>(content || null);
  const [countUp, setCountUp] = useState(false);

  useEffect(() => {
    setCountUp(true);
  }, []);

  useEffect(() => {
    if (!content) {
      const fetchContent = async () => {
        const { data } = await supabase
          .from("landing_content")
          .select("*")
          .eq("section_key", "hero")
          .maybeSingle();

        if (data) {
          setHeroContent({
            title: data.title || "Earn & Grow on TikTok",
            subtitle: data.subtitle || "Real Engagement, Real Growth",
            content: data.content || "Exchange engagement with real users by engaging on others' content and boosting your own profile.",
            button_text: data.button_text || "Start Growing Now",
            button_url: data.button_url || "/register",
            is_visible: data.is_visible,
          });
        }
      };
      fetchContent();
    }
  }, [content]);

  // Default values if content not loaded
  const displayContent = heroContent || {
    title: "Earn & Grow on TikTok",
    subtitle: "Real Engagement, Real Growth",
    content: "Exchange engagement with real users by engaging on others' content and boosting your own profile.",
    button_text: "Start Growing Now",
    button_url: "/register",
    is_visible: true,
  };

  const likes = useCountUp(12847, 2200, countUp);
  const comments = useCountUp(2139, 2600, countUp);
  const saves = useCountUp(1385, 2900, countUp);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background effects */}
      <div className="absolute inset-0 bg-background pointer-events-none" />
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(ellipse at 50% 0%, hsl(330 90% 60% / 0.15) 0%, transparent 50%),
                            radial-gradient(ellipse at 80% 50%, hsl(180 80% 50% / 0.1) 0%, transparent 40%),
                            radial-gradient(ellipse at 20% 80%, hsl(270 80% 55% / 0.1) 0%, transparent 40%)`,
        }}
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="glass" className="mb-6 px-4 py-2">
              <Sparkles className="w-4 h-4 mr-2" />
              {displayContent.subtitle}
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
          >
            {displayContent.title.includes("TikTok") ? (
              <>
                {displayContent.title.split("TikTok")[0]}
                <span className="gradient-text glow-text">TikTok</span>
                {displayContent.title.split("TikTok")[1]}
              </>
            ) : (
              <span className="gradient-text glow-text">{displayContent.title}</span>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
          >
            {displayContent.content}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button variant="gradient" size="xl" className="w-full sm:w-64" asChild>
              <Link to={displayContent.button_url || "/register"}>
                {displayContent.button_text || "Start Growing Now"}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="glass" size="xl" className="w-full sm:w-64" asChild>
              <a href="#how-it-works">
                <Play className="w-5 h-5" />
                See How It Works
              </a>
            </Button>
          </motion.div>

          {/* Growth illustration - real analytics style, no points */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-20 relative"
          >
            <div className="flex justify-center items-end gap-4">
              {/* Comments card */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="hidden sm:block w-48 p-4 rounded-2xl glass border border-border/50 transform -rotate-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="h-3 w-20 bg-muted rounded" />
                    <div className="h-2 w-14 bg-muted/50 rounded mt-1" />
                  </div>
                </div>
                <div className="h-24 bg-muted/30 rounded-lg mb-3 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-primary">{comments}</span>
                  <span className="text-xs text-muted-foreground">comments</span>
                </div>
                <div className="flex items-center justify-center gap-1 text-xs text-success">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Trending today
                </div>
              </motion.div>

              {/* Main profile card - growth highlight */}
              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="w-56 p-5 rounded-2xl glass border border-primary/30 shadow-glow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent" />
                  <div className="text-left">
                    <div className="h-3 w-24 bg-foreground/80 rounded" />
                    <div className="h-2 w-16 bg-muted-foreground/50 rounded mt-1" />
                  </div>
                </div>
                <div className="h-32 bg-muted/30 rounded-lg mb-4 flex flex-col items-center justify-center relative overflow-hidden">
                  <Heart className="absolute top-2 right-2 w-4 h-4 text-pink-500 animate-pulse" />
                  <span className="text-4xl font-bold gradient-text">{likes}</span>
                  <span className="text-xs text-muted-foreground">likes on your latest post</span>
                  <div className="flex gap-1 mt-2">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3 }}
                        className="text-pink-500 text-xs"
                      >
                        ❤️
                      </motion.span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Heart className="w-3.5 h-3.5 text-pink-500" /> Growing
                  </span>
                  <Badge variant="success" className="text-xs">+1,200 today</Badge>
                </div>
              </motion.div>

              {/* Saves card */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="hidden sm:block w-48 p-4 rounded-2xl glass border border-border/50 transform rotate-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                    <Bookmark className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="h-3 w-20 bg-muted rounded" />
                    <div className="h-2 w-14 bg-muted/50 rounded mt-1" />
                  </div>
                </div>
                <div className="h-24 bg-muted/30 rounded-lg mb-3 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-accent">{saves}</span>
                  <span className="text-xs text-muted-foreground">saves</span>
                </div>
                <div className="flex items-center justify-center gap-1 text-xs text-success">
                  <TrendingUp className="w-3.5 h-3.5" />
                  More reach
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}