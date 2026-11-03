import { Palette, Globe, Smartphone, Share2, Timer } from "lucide-react";
import { SettingsHeader, SettingsList } from "./components/SettingsList";

const ITEMS = [
  { label: "Branding", description: "App name, logo, favicon, colors and PWA icon", href: "/baki/stage/admin/settings/app-branding/branding", icon: Palette },
  { label: "SEO & Meta", description: "Meta title, description and search preview", href: "/baki/stage/admin/settings/app-branding/seo", icon: Globe },
  { label: "Platform", description: "Target social platform, points names and labels", href: "/baki/stage/admin/settings/app-branding/platform", icon: Smartphone },
  { label: "Social & Support", description: "Social links, community channel and support email", href: "/baki/stage/admin/settings/app-branding/social", icon: Share2 },
  { label: "Maintenance Mode", description: "Offline mode with countdown and custom HTML message", href: "/baki/stage/admin/settings/app-branding/maintenance", icon: Timer, badge: "New" },
];

export default function AdminSettingsAppBranding() {
  return (
    <div className="space-y-6">
      <SettingsHeader
        title="App Settings & Branding"
        description="Pick a section to edit"
        backHref="/baki/stage/admin/settings"
      />
      <SettingsList items={ITEMS} />
    </div>
  );
}