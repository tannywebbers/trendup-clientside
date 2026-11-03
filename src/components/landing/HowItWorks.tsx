import { motion } from "framer-motion";
import { Heart, MessageCircle, Bookmark, Play, ArrowRight, LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Step {
  step: number;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

const defaultSteps: Step[] = [
  {
    step: 1,
    title: "Browse Tasks",
    description: "Find TikTok posts that need engagement from advertisers",
    icon: Play,
    color: "from-primary to-purple-500",
  },
  {
    step: 2,
    title: "Complete Actions",
    description: "Like, comment, save, or watch videos as required",
    icon: Heart,
    color: "from-purple-500 to-accent",
  },
  {
    step: 3,
    title: "Upload Proof",
    description: "Submit screenshots showing your completed actions",
    icon: MessageCircle,
    color: "from-accent to-cyan-400",
  },
  {
    step: 4,
    title: "Earn Points",
    description: "AI verifies your work and credits Streak Points instantly",
    icon: Bookmark,
    color: "from-cyan-400 to-primary",
  },
];

interface HowItWorksContent {
  title: string;
  subtitle: string;
  content: string;
  is_visible: boolean;
}

interface HowItWorksProps {
  content?: HowItWorksContent;
}

export function HowItWorks({ content }: HowItWorksProps) {
  const [howContent, setHowContent] = useState<HowItWorksContent | null>(content || null);

  useEffect(() => {
    if (!content) {
      const fetchContent = async () => {
        const { data } = await supabase
          .from("landing_content")
          .select("*")
          .eq("section_key", "how_it_works")
          .maybeSingle();
        
        if (data) {
          setHowContent({
            title: data.title || "How It Works",
            subtitle: data.subtitle || "Start growing on TikTok in minutes with our simple 4-step process",
            content: data.content || "",
            is_visible: data.is_visible,
          });
        }
      };
      fetchContent();
    }
  }, [content]);

  const displayContent = howContent || {
    title: "How It Works",
    subtitle: "Start growing on TikTok in minutes with our simple 4-step process",
    content: "",
    is_visible: true,
  };

  // Parse steps from content if available (JSON format)
  let steps = defaultSteps;
  if (displayContent.content) {
    try {
      const parsed = JSON.parse(displayContent.content);
      if (Array.isArray(parsed)) {
        const icons = [Play, Heart, MessageCircle, Bookmark];
        const colors = ["from-primary to-purple-500", "from-purple-500 to-accent", "from-accent to-cyan-400", "from-cyan-400 to-primary"];
        steps = parsed.map((s: any, i: number) => ({
          step: i + 1,
          title: s.title || defaultSteps[i]?.title || `Step ${i + 1}`,
          description: s.description || defaultSteps[i]?.description || "",
          icon: icons[i % 4],
          color: colors[i % 4],
        }));
      }
    } catch {
      // Content is not JSON, ignore
    }
  }

  return (
    <section className="py-24 relative" id="how-it-works">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-transparent" />
      
      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {displayContent.title.includes("Works") ? (
              <>
                {displayContent.title.split("Works")[0]}
                <span className="gradient-text">Works</span>
                {displayContent.title.split("Works")[1]}
              </>
            ) : (
              <>How It <span className="gradient-text">Works</span></>
            )}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {displayContent.subtitle}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative"
            >
              <Card variant="interactive" className="h-full">
                <CardContent className="p-6 pt-8">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4`}>
                    <item.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-2 font-medium">
                    STEP {item.step}
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </CardContent>
              </Card>
              
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                  <ArrowRight className="w-6 h-6 text-primary" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
