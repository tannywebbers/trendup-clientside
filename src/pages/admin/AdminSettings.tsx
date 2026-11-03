import {
  Palette,
  Coins,
  Megaphone,
  Mail,
  KeyRound,
  Brain,
} from "lucide-react";
import { SettingsList } from "./components/SettingsList";

const CATEGORIES = [
  {
    label: "App Settings & Branding",
    href: "/baki/stage/admin/settings/app-branding",
    icon: Palette,
    badge: "Branding · SEO · Platform · Social · Maintenance",
  },
  {
    label: "Paystack & Pricing Settings",
    href: "/baki/stage/admin/settings/paystack-pricing",
    icon: Coins,
    badge: "Payments · Pricing · Points & Bonuses",
  },
  {
    label: "Ads & Monetization Settings",
    href: "/baki/stage/admin/settings/ads",
    icon: Megaphone,
    badge: "Adsterra · Google Ads",
  },
  {
    label: "Email & SMTP",
    href: "/baki/stage/admin/settings/email",
    icon: Mail,
    badge: "SMTP · Domains · Templates · Delivery Logs",
  },
  {
    label: "2FA Security",
    href: "/baki/stage/admin/settings/2fa",
    icon: KeyRound,
    badge: "Two-factor authentication",
  },
  {
    label: "AI & Automation",
    href: "/baki/stage/admin/settings/ai",
    icon: Brain,
    badge: "AI Config · Prompts",
  },
];

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Choose a category</p>
      </div>

      <SettingsList
        items={CATEGORIES.map(({ badge, ...c }) => ({ ...c, description: badge }))}
      />
    </div>
  );
}