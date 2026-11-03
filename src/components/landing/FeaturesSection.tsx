import { motion } from "framer-motion";
import { Brain, Eye, CheckCircle, ShieldCheck, LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const defaultFeatures: Feature[] = [
  {
    icon: Eye,
    title: "Screenshot Analysis",
    description: "Our AI scans your screenshots to detect likes, comments, saves, and views with 99.9% accuracy.",
  },
  {
    icon: Brain,
    title: "Username Matching",
    description: "Automatically verifies your TikTok username appears in comments to prevent fraud.",
  },
  {
    icon: CheckCircle,
    title: "Instant Verification",
    description: "Get verified and credited within seconds of submitting your proof.",
  },
  {
    icon: ShieldCheck,
    title: "Anti-Fraud Protection",
    description: "Advanced algorithms detect duplicate screenshots and suspicious activity.",
  },
];

interface FeaturesContent {
  title: string;
  subtitle: string;
  content: string;
  is_visible: boolean;
}

interface FeaturesSectionProps {
  content?: FeaturesContent;
}

export function FeaturesSection({ content }: FeaturesSectionProps) {
  const [featuresContent, setFeaturesContent] = useState<FeaturesContent | null>(content || null);

  useEffect(() => {
    if (!content) {
      const fetchContent = async () => {
        const { data } = await supabase
          .from("landing_content")
          .select("*")
          .eq("section_key", "features")
          .maybeSingle();
        
        if (data) {
          setFeaturesContent({
            title: data.title || "AI-Powered Verification",
            subtitle: data.subtitle || "Why Choose Us",
            content: data.content || "Our cutting-edge AI technology ensures every task is completed authentically.",
            is_visible: data.is_visible,
          });
        }
      };
      fetchContent();
    }
  }, [content]);

  const displayContent = featuresContent || {
    title: "AI-Powered Verification",
    subtitle: "Why Choose Us",
    content: "Our cutting-edge AI technology ensures every task is completed authentically. No more manual reviews, no more waiting – just instant, accurate verification.",
    is_visible: true,
  };

  // Parse features from content if available (JSON format)
  let features = defaultFeatures;
  if (displayContent.content) {
    try {
      const parsed = JSON.parse(displayContent.content);
      if (Array.isArray(parsed)) {
        features = parsed.map((f: any, i: number) => ({
          icon: [Eye, Brain, CheckCircle, ShieldCheck][i % 4],
          title: f.title || defaultFeatures[i]?.title || "Feature",
          description: f.description || defaultFeatures[i]?.description || "",
        }));
      }
    } catch {
      // Content is not JSON, use as description text
    }
  }

  return (
    <section className="py-24 relative" id="features">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              {displayContent.title.split(" ").slice(0, -1).join(" ")}{" "}
              <span className="gradient-text">{displayContent.title.split(" ").slice(-1)}</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              {typeof displayContent.content === 'string' && !displayContent.content.startsWith('[') 
                ? displayContent.content 
                : "Our cutting-edge AI technology ensures every task is completed authentically. No more manual reviews, no more waiting – just instant, accurate verification."}
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card variant="glass" className="h-full">
                    <CardContent className="p-5">
                      <feature.icon className="w-8 h-8 text-primary mb-3" />
                      <h3 className="font-semibold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative mx-auto max-w-sm">
              {/* iPhone 17 device */}
              <div className="relative bg-zinc-900 rounded-[3.2rem] p-2 shadow-elevated border border-border">
                {/* Side buttons */}
                <div className="absolute -left-[2px] top-28 w-[3px] h-10 bg-zinc-700 rounded-l-md" />
                <div className="absolute -left-[2px] top-40 w-[3px] h-14 bg-zinc-700 rounded-l-md" />
                <div className="absolute -left-[2px] top-56 w-[3px] h-14 bg-zinc-700 rounded-l-md" />
                <div className="absolute -right-[2px] top-36 w-[3px] h-20 bg-zinc-700 rounded-r-md" />

                <div className="bg-background rounded-[2.9rem] overflow-hidden aspect-[9/19] relative">
                  {/* Dynamic Island */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-8 bg-black rounded-full z-20" />

                  {/* Status bar */}
                  <div className="relative h-9 bg-card/0 flex items-center justify-between px-6 pt-1.5">
                    <span className="text-[10px] text-muted-foreground font-medium">9:41</span>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span className="text-[9px]">5G</span>
                      <span className="text-[10px]">📶</span>
                      <span className="text-[10px]">🔋</span>
                    </div>
                  </div>

                  {/* Dashboard snapshot */}
                  <div className="px-3 pb-4">
                    {/* Greeting */}
                    <div className="mb-3 pt-2">
                      <p className="text-[10px] text-muted-foreground">Good evening 👋</p>
                      <p className="text-sm font-bold">You're averaging +1.2K likes/day</p>
                    </div>

                    {/* Balance card */}
                    <div className="rounded-2xl bg-gradient-to-br from-primary to-accent p-3 mb-3">
                      <p className="text-[10px] text-white/80">Streak Points</p>
                      <p className="text-3xl font-bold text-white">18,450</p>
                      <div className="flex gap-1.5 mt-2">
                        <span className="text-[9px] bg-white/20 text-white rounded-full px-2 py-0.5">Browse Tasks</span>
                        <span className="text-[9px] bg-white/20 text-white rounded-full px-2 py-0.5">Boost Ad</span>
                      </div>
                    </div>

                    {/* Growth chart */}
                    <div className="rounded-2xl glass p-3 mb-3 border border-border/50">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] font-semibold">Profile Growth</p>
                        <p className="text-[9px] text-success">▲ this week</p>
                      </div>
                      <div className="flex items-end justify-between h-12 gap-1">
                        {[35, 45, 40, 55, 62, 75, 90].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-sm bg-gradient-to-t from-primary/40 to-primary"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Task list */}
                    <div className="space-y-2">
                      {[
                        { label: "Follow @creator", pts: "+12 SP", done: true },
                        { label: "Comment on video", pts: "+10 SP", done: false },
                        { label: "Like trending post", pts: "+8 SP", done: false },
                      ].map((task, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between rounded-xl p-2 border ${
                            task.done ? "border-success/30 bg-success/10" : "border-border bg-card"
                          }`}
                        >
                          <span className="text-[10px]">{task.label}</span>
                          <span className={`text-[9px] font-semibold ${task.done ? "text-success" : "text-primary"}`}>
                            {task.pts}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-accent/20 blur-3xl -z-10 scale-150" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
