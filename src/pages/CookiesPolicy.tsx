import { useState, useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface LegalSection {
  heading: string;
  body: string;
}

export default function CookiesPolicy() {
  const [title, setTitle] = useState("Cookies Policy");
  const [sections, setSections] = useState<LegalSection[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
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
          .eq("section_key", "cookies_policy")
          .maybeSingle(),
        supabase.from("app_settings").select("app_name").limit(1).maybeSingle(),
      ]);

      const appName = appSettings?.app_name || "TrendUp";

      if (pageData) {
        setTitle(pageData.title || "Cookies Policy");
        setUpdatedAt(pageData.updated_at);
        
        try {
          const parsed = JSON.parse(pageData.content || "[]");
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSections(parsed);
          } else {
            setSections(getDefaultSections(appName));
          }
        } catch {
          setSections(getDefaultSections(appName));
        }
      } else {
        setSections(getDefaultSections(appName));
      }
    } catch (error) {
      console.error("Error fetching cookies policy:", error);
      setSections(getDefaultSections("TrendUp"));
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultSections = (name: string): LegalSection[] => [
    {
      heading: "What Are Cookies",
      body: `Cookies are small text files stored on your device when you visit ${name}. They help us provide you with a better experience by remembering your preferences and understanding how you use our service.`,
    },
    {
      heading: "Types of Cookies We Use",
      body: "We use the following types of cookies:\n\n• Essential Cookies: Required for the website to function properly, including authentication and security.\n\n• Analytics Cookies: Help us understand how visitors interact with our website.\n\n• Preference Cookies: Remember your settings and preferences.\n\n• Marketing Cookies: Used to deliver relevant advertisements.",
    },
    {
      heading: "Essential Cookies",
      body: "These cookies are necessary for the website to function and cannot be switched off. They are usually set in response to actions made by you, such as setting your privacy preferences, logging in, or filling in forms.",
    },
    {
      heading: "Managing Cookies",
      body: "You can control and manage cookies in various ways:\n\n• Browser settings: Most browsers allow you to refuse or accept cookies.\n\n• Third-party tools: Various tools are available to manage cookie preferences.\n\nNote: Blocking cookies may impact your experience on our website.",
    },
    {
      heading: "Third-Party Cookies",
      body: "Some cookies are placed by third-party services that appear on our pages. We do not control these cookies. Third parties include analytics providers and advertising networks.",
    },
    {
      heading: "Updates to This Policy",
      body: "We may update this Cookies Policy from time to time. We will notify you of any changes by posting the new policy on this page with a new effective date.",
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
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        {updatedAt && (
          <p className="text-muted-foreground mb-8">
            Last updated: {new Date(updatedAt).toLocaleDateString()}
          </p>
        )}
        
        <div className="space-y-8">
          {sections.map((section, index) => (
            <div key={index} className="space-y-3">
              <h2 className="text-2xl font-semibold">{section.heading}</h2>
              <div className="text-muted-foreground whitespace-pre-line leading-relaxed">
                {section.body}
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
