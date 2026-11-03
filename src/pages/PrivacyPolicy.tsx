import { useState, useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface LegalSection {
  heading: string;
  body: string;
}

export default function PrivacyPolicy() {
  const [title, setTitle] = useState("Privacy Policy");
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
          .eq("section_key", "privacy_policy")
          .maybeSingle(),
        supabase.from("app_settings").select("app_name").limit(1).maybeSingle(),
      ]);

      const appName = appSettings?.app_name || "TrendUp";

      if (pageData) {
        setTitle(pageData.title || "Privacy Policy");
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
      console.error("Error fetching privacy policy:", error);
      setSections(getDefaultSections("TrendUp"));
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultSections = (name: string): LegalSection[] => [
    {
      heading: "Introduction",
      body: `Welcome to ${name}. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we handle your personal data when you visit our website and use our services.`,
    },
    {
      heading: "Information We Collect",
      body: "We collect information you provide directly to us, such as:\n• Account information (email, username, profile details)\n• TikTok username and display name\n• Transaction history and points balance\n• Screenshots submitted for task verification\n• Communications with our support team",
    },
    {
      heading: "How We Use Your Information",
      body: "We use the information we collect to:\n• Provide, maintain, and improve our services\n• Process transactions and send related information\n• Send technical notices and support messages\n• Respond to your comments and questions\n• Detect and prevent fraudulent activity",
    },
    {
      heading: "Data Security",
      body: "We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.",
    },
    {
      heading: "Your Rights",
      body: "You have the right to:\n• Access your personal data\n• Correct inaccurate data\n• Request deletion of your data\n• Object to processing of your data",
    },
    {
      heading: "Contact Us",
      body: "If you have any questions about this Privacy Policy, please contact us through our support channels.",
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
