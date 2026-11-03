import { useState, useEffect } from "react";
import { Timer, Save, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsHeader } from "./components/SettingsList";

interface MaintenanceSettings {
  enabled: boolean;
  ends_at: string | null;
  show_countdown: boolean;
  message_html: string;
}

const DEFAULT_HTML =
  "<p><strong>We'll be back shortly.</strong></p><p>We're currently performing scheduled maintenance on the platform. New features are coming soon — thank you for your patience!</p>";

export default function AdminMaintenanceSettings() {
  const [settings, setSettings] = useState<MaintenanceSettings>({
    enabled: false,
    ends_at: null,
    show_countdown: true,
    message_html: DEFAULT_HTML,
  });
  const [siteName, setSiteName] = useState("TrendUp");
  const [supportEmail, setSupportEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["maintenance_settings", "site_settings"]);
      if (data) {
        const maintenance = data.find((d) => d.key === "maintenance_settings");
        if (maintenance && typeof maintenance.value === "object" && maintenance.value !== null) {
          setSettings((prev) => ({ ...prev, ...(maintenance.value as unknown as MaintenanceSettings) }));
        }
        const site = data.find((d) => d.key === "site_settings")?.value as
          | { site_name?: string; support_email?: string }
          | undefined;
        if (site) {
          setSiteName(site.site_name || "TrendUp");
          setSupportEmail(site.support_email || "");
        }
      }
    } catch (error) {
      console.error("Error fetching maintenance settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const upsertSetting = async (key: string, value: any) => {
    const { data: existing } = await supabase
      .from("platform_settings")
      .select("id")
      .eq("key", key)
      .maybeSingle();
    const payload = JSON.parse(JSON.stringify(value));
    if (existing) {
      const { error } = await supabase.from("platform_settings").update({ value: payload }).eq("key", key);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("platform_settings").insert([{ key, value: payload }]);
      if (error) throw error;
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertSetting("maintenance_settings", {
        ...settings,
        ends_at: settings.ends_at ? new Date(settings.ends_at).toISOString() : null,
      });
      // Mirror the on/off switch into site_settings so existing maintenance gate works everywhere
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "site_settings")
        .maybeSingle();
      const siteValue = (existing?.value as Record<string, unknown>) || {};
      await upsertSetting("site_settings", { ...siteValue, site_name: siteName, support_email: supportEmail, maintenance_mode: settings.enabled });
      toast({ title: "Saved", description: "Maintenance settings updated." });
    } catch (error) {
      console.error("Error saving maintenance settings:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save maintenance settings." });
    } finally {
      setIsSaving(false);
    }
  };

  const localEndsAt = settings.ends_at
    ? new Date(settings.ends_at).toISOString().slice(0, 16)
    : "";

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <SettingsHeader
        title="Maintenance Mode"
        description="Put the site offline with a scheduled reopen and custom message"
        backHref="/baki/stage/admin/settings/app-branding"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Timer className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <CardTitle>Maintenance Mode</CardTitle>
              <CardDescription>When enabled, visitors see your custom message instead of the site</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Maintenance Mode</Label>
              <p className="text-xs text-muted-foreground">Shows the maintenance page to all visitors</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })} />
          </div>

          {settings.enabled && (
            <>
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Reopen Countdown</Label>
                    <p className="text-xs text-muted-foreground">Display a live countdown until the site is back online</p>
                  </div>
                  <Switch
                    checked={settings.show_countdown}
                    onCheckedChange={(checked) => setSettings({ ...settings, show_countdown: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Site Comes Back Online At</Label>
                  <Input
                    type="datetime-local"
                    value={localEndsAt}
                    onChange={(e) => setSettings({ ...settings, ends_at: e.target.value || null })}
                  />
                  {settings.ends_at && (
                    <p className="text-xs text-muted-foreground">
                      Auto reopens at {new Date(settings.ends_at).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Maintenance Message (HTML)
                    <Badge variant="secondary">HTML allowed</Badge>
                  </Label>
                  <Textarea
                    value={settings.message_html}
                    onChange={(e) => setSettings({ ...settings, message_html: e.target.value })}
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports HTML (headings, paragraphs, links, buttons) plus {siteName} as the site name.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Preview</span>
                  </div>
                  <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: settings.message_html }} />
                </div>
              </div>

              <div className="border-t pt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Site Name</Label>
                  <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>
    </div>
  );
}