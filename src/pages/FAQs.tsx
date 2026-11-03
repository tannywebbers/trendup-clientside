import { useState, useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQItem {
  question: string;
  answer: string;
}

export default function FAQs() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [title, setTitle] = useState("Frequently Asked Questions");
  const [subtitle, setSubtitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const [{ data: pageData }, { data: appSettings }] = await Promise.all([
        supabase
          .from("landing_content")
          .select("*")
          .eq("section_key", "faqs")
          .maybeSingle(),
        supabase.from("app_settings").select("app_name, points_name").limit(1).maybeSingle(),
      ]);

      const appName = appSettings?.app_name || "TrendUp";
      const pointsName = appSettings?.points_name || "Streak Points";

      if (pageData) {
        setTitle(pageData.title || "Frequently Asked Questions");
        setSubtitle(pageData.subtitle || "");
        try {
          const parsed = JSON.parse(pageData.content || "[]");
          setFaqs(Array.isArray(parsed) ? parsed : getDefaultFAQs(appName, pointsName));
        } catch {
          setFaqs(getDefaultFAQs(appName, pointsName));
        }
      } else {
        setFaqs(getDefaultFAQs(appName, pointsName));
      }
    } catch (error) {
      console.error("Error fetching FAQs:", error);
      setFaqs(getDefaultFAQs("TrendUp", "Streak Points"));
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultFAQs = (appName: string, pointsName: string): FAQItem[] => [
    {
      question: `What is ${appName}?`,
      answer: `${appName} is a platform where you can earn ${pointsName} by completing engagement tasks on TikTok, such as liking, commenting, saving, and following. You can also use ${pointsName} to promote your own TikTok content.`,
    },
    {
      question: "How do I earn points?",
      answer: "Browse available tasks, complete the required action on TikTok (like, comment, save, watch, or follow), take a screenshot as proof, and submit it. Our AI will verify your submission and credit points to your account.",
    },
    {
      question: "How does verification work?",
      answer: "We use advanced AI technology to analyze your screenshots and verify that you've completed the required task. The verification process typically takes just a few seconds.",
    },
    {
      question: "Can I create my own ads?",
      answer: "Yes! You can create ads to promote your TikTok content. Set the task type, number of completions needed, and points per task. Other users will complete your tasks to earn points.",
    },
    {
      question: "How do I withdraw my earnings?",
      answer: "You can use your points to create ads for your own content or exchange them according to the platform's current exchange rates. Check the Wallet section for available options.",
    },
    {
      question: "What happens if my submission is rejected?",
      answer: "If your submission is rejected, you won't receive points for that task. Make sure your screenshot clearly shows the completed action. You can try the task again with a valid screenshot.",
    },
    {
      question: "Is there a minimum withdrawal amount?",
      answer: "Yes, minimum thresholds apply for withdrawals. Check the Wallet section for current limits and available withdrawal methods.",
    },
    {
      question: "How can I contact support?",
      answer: "You can reach us through our live chat feature, Contact Us page, or join our community channels for assistance.",
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-lg">{subtitle}</p>}
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="border rounded-lg px-6 bg-card"
            >
              <AccordionTrigger className="text-left hover:no-underline py-4">
                <span className="font-medium">{faq.question}</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
      <Footer />
    </div>
  );
}
