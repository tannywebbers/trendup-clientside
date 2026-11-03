import { Server, Shield, FileText, Activity, Check } from "lucide-react";
import { SettingsHeader, SettingsList } from "./components/SettingsList";

const EMAIL_ITEMS = [
  {
    label: "SMTP Configuration & Test Email",
    description: "Connect any SMTP provider (Brevo, SendGrid, Mailgun…) and send a test",
    href: "/baki/stage/admin/settings/email/smtp",
    icon: Server,
    badge: "",
  },
  {
    label: "Allowed Email Domains",
    description: "Restrict signups to specific email domains",
    href: "/baki/stage/admin/settings/email/domains",
    icon: Shield,
    badge: "",
  },
  {
    label: "Email Templates",
    description: "Edit subjects and HTML bodies for every email",
    href: "/baki/stage/admin/settings/email/templates",
    icon: FileText,
    badge: "",
  },
  {
    label: "Delivery Logs",
    description: "Sent/failed status and open tracking for every email",
    href: "/baki/stage/admin/settings/email/logs",
    icon: Activity,
    badge: "",
  },
];

export default function AdminEmailMenu() {
  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Email & SMTP"
        description="Configure email delivery, templates and tracking"
        backHref="/baki/stage/admin/settings"
      />
      <div className="p-4 rounded-lg bg-muted/50 border border-border flex items-start gap-2">
        <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Every email is logged in the delivery logs and includes a tracking pixel that records when it's opened.
        </p>
      </div>
      <SettingsList items={EMAIL_ITEMS} />
    </div>
  );
}