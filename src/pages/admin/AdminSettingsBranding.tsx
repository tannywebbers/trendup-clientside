import { Link } from "react-router-dom";
import { ArrowLeft, Palette, Globe, Smartphone, Share2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  {
    key: "branding",
    icon: Palette,
    title: "Branding",
    description: "App name, logo, favicon, colors and PWA icon",
    color: "text-pink-500",
  },
  {
    key: "seo",
    icon: Globe,
    title: "SEO & Meta",
    description: "Meta title, description and search preview",
    color: "text-blue-500",
  },
  {
    key: "platform",
    icon: Smartphone,
    title: "Platform",
    description: "Target social platform, points names and labels",
    color: "text-cyan-500",
  },
  {
    key: "social",
    icon: Share2,
    title: "Social & Support",
    description: "Social media links, community channel and support email",
    color: "text-green-500",
  },
];

export default function AdminSettingsBranding() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/baki/stage/admin/settings">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">App Settings & Branding</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a section to edit</p>
        </div>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.key}
            to={`/baki/stage/admin/settings/branding/${section.key}`}
            className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors"
          >
            <div className={`w-11 h-11 rounded-lg bg-muted flex items-center justify-center ${section.color}`}>
              <section.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{section.title}</p>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}