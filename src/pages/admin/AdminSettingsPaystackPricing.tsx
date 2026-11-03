import { Banknote, BadgeDollarSign, Gift } from "lucide-react";
import { SettingsHeader, SettingsList } from "./components/SettingsList";

const ITEMS = [
  { label: "Paystack Payments", description: "Public/secret keys, test mode and payment config", href: "/baki/stage/admin/settings/paystack", icon: Banknote },
  { label: "Pricing & Boosts", description: "Points exchange rate and content boost costs", href: "/baki/stage/admin/settings/pricing", icon: BadgeDollarSign },
  { label: "Points & Bonuses", description: "Welcome bonus and referral commissions", href: "/baki/stage/admin/settings/bonus", icon: Gift },
];

export default function AdminSettingsPaystackPricing() {
  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Paystack & Pricing Settings"
        description="Payments, pricing and bonus economy"
        backHref="/baki/stage/admin/settings"
      />
      <SettingsList items={ITEMS} />
    </div>
  );
}