import { Megaphone, Check } from "lucide-react";
import { SettingsHeader, SettingsList } from "./components/SettingsList";

const PROVIDERS = [
  {
    label: "Adsterra",
    description: "Native, banner, social bar, popunders and more",
    href: "/baki/stage/admin/settings/ads/adsterra",
    icon: Megaphone,
    badge: "Supported",
    badgeVariant: "success" as const,
  },
  {
    label: "Google Ads (AdSense)",
    description: "Responsive banner and in-feed ads from Google AdSense",
    href: "/baki/stage/admin/settings/ads/google_ads",
    icon: Megaphone,
    badge: "Available",
    badgeVariant: "secondary" as const,
  },
];

export default function AdminAdsSettings() {
  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Ads & Monetization"
        description="Choose an ad provider to configure placements"
        backHref="/baki/stage/admin/settings"
      />
      <div className="p-4 rounded-lg bg-muted/50 border border-border flex items-start gap-2">
        <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Each provider has its own placements screen. You can run one provider at a time — enabling a placement under a
          provider switches that placement's code source.
        </p>
      </div>
      <SettingsList items={PROVIDERS} className="sm:grid-cols-2" />
    </div>
  );
}