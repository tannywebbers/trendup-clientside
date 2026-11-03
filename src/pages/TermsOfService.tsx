import { useState, useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface LegalSection {
  heading: string;
  body: string;
}

export default function TermsOfService() {
  const [title, setTitle] = useState("Terms of Service");
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
          .eq("section_key", "terms_of_service")
          .maybeSingle(),
        supabase.from("app_settings").select("app_name").limit(1).maybeSingle(),
      ]);

      const appName = appSettings?.app_name || "TrendUp";

      if (pageData) {
        setTitle(pageData.title || "Terms of Service");
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
      console.error("Error fetching terms of service:", error);
      setSections(getDefaultSections("TrendUp"));
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultSections = (name: string): LegalSection[] => [
    {
      heading: "Acceptance of Terms",
      body: `By accessing and using ${name}, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this service.`,
    },
    {
      heading: "User Accounts",
      body: "You are responsible for:\n• Maintaining the confidentiality of your account credentials\n• All activities that occur under your account\n• Providing accurate and complete information\n• Notifying us immediately of any unauthorized access",
    },
    {
      heading: "Prohibited Activities",
      body: "Users are prohibited from:\n• Creating multiple accounts\n• Using bots or automated tools\n• Engaging in fraudulent activities\n• Manipulating the points system\n• Violating TikTok's terms of service\n• Harassing other users",
    },
    {
      heading: "Points and Transactions",
      body: "Points earned through tasks:\n• Have no cash value outside the platform\n• Cannot be transferred between accounts\n• May be forfeited for terms violations\n• Are subject to verification requirements",
    },
    {
      heading: "Task Verification",
      body: "All task submissions are subject to AI verification and manual review. We reserve the right to reject submissions that do not meet our quality standards or appear to be fraudulent.",
    },
    {
      heading: "Termination",
      body: "We may terminate or suspend your account immediately, without prior notice, for any breach of these Terms. Upon termination, your right to use the service will cease immediately.",
    },
    {
      heading: "Limitation of Liability",
      body: `${name} shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the service.`,
    },
    {
      heading: "Changes to Terms",
      body: "We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.",
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
