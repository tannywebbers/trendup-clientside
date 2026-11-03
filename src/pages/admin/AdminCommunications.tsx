import { Radio, Megaphone, Mail } from "lucide-react";
import { SettingsHeader, SettingsList } from "./components/SettingsList";

const ITEMS = [
  { label: "Broadcast", description: "Send a single message to every user on the platform", href: "/baki/stage/admin/communications/broadcast", icon: Radio },
  { label: "Announcements", description: "Create and manage platform announcements", href: "/baki/stage/admin/communications/announcements", icon: Megaphone, badge: "New" },
  { label: "Email Campaigns", description: "Compose and send emails to users", href: "/baki/stage/admin/communications/email-campaigns", icon: Mail },
];

export default function AdminCommunications() {
  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Communications"
        description="Broadcast messages, announcements and email campaigns"
        backHref="/baki/stage/admin"
      />
      <SettingsList items={ITEMS} />
    </div>
  );
}