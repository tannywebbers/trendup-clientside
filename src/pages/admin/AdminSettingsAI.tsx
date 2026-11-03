import { Bot, FileText, Sparkles } from "lucide-react";
import { SettingsHeader, SettingsList } from "./components/SettingsList";

const AI_ITEMS = [
  {
    label: "AI Configuration",
    description: "API keys, model and pricing for the built-in AI assistant",
    href: "/baki/stage/admin/settings/ai/config",
    icon: Bot,
    badge: "",
  },
  {
    label: "AI Prompts",
    description: "Prompt templates for the chatbot and content features",
    href: "/baki/stage/admin/settings/ai/prompts",
    icon: FileText,
    badge: "",
  },
];

export default function AdminSettingsAI() {
  return (
    <div className="space-y-6">
      <SettingsHeader
        title="AI & Automation"
        description="Configure the AI assistant and prompt templates"
        backHref="/baki/stage/admin/settings"
      />
      <div className="p-4 rounded-lg bg-muted/50 border border-border flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Power the AI-powered features shown to users. Prompts control tone, length and behaviour.
        </p>
      </div>
      <SettingsList items={AI_ITEMS} />
    </div>
  );
}