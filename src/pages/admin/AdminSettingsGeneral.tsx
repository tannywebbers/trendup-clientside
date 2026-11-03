import { useState, useEffect } from "react";
import { Globe, Mail, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SiteSettings {
  site_name: string;
  site_logo: string;
  support_email: string;
  maintenance_mode: boolean;
}

interface EmailVerificationSettings {
  enabled: boolean;
  require_verification: boolean;
}

export default function AdminSettingsGeneral() {
  const [site, setSite] = useState<SiteSettings>({
    site_name: "TrendUp",
    site_logo: "",
    support_email: "support@trendup.com",
    maintenance_mode: false,
  });
  const [email, setEmail] = useState<EmailVerificationSettings>({ enabled: false, require_verification: false });
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: siteData } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "site_settings")
        .maybeSingle();
      if (siteData && typeof siteData.value === "object" && siteData.value !== null) {
        setSite((prev) => ({ ...prev, ...(siteData.value as unknown as SiteSettings) }));
      }

      const { data: emailData } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "email_verification")
        .maybeSingle();
      if (emailData && typeof emailData.value === "object" && emailData.value !== null) {
        setEmail((prev) => ({ ...prev, ...(emailData.value as unknown as EmailVerificationSettings) }));
      }

      const { data: smtpData } = await supabase
        .from("smtp_config")
        .select("is_enabled, password_set")
        .maybeSingle();
      setSmtpConfigured(smtpData?.is_enabled && smtpData?.password_set);
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSetting = async (key: string, value: any) => {
    const { data: existing } = await supabase
      .from("platform_settings")
      .select("id")
      .eq("key", key)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("platform_settings")
        .update({ value: JSON.parse(JSON.stringify(value)) })
        .eq("key", key);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("platform_settings")
        .insert([{ key, value: JSON.parse(JSON.stringify(value)) }]);
      if (error) throw error;
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all([saveSetting("site_settings", site), saveSetting("email_verification", email)]);
      toast({ title: "Saved", description: "General settings updated." });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save settings." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">General Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Site-wide options and email verification</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <CardTitle>Site Settings</CardTitle>
              <CardDescription>Basic site configuration</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Site Name</Label>
              <Input
                value={site.site_name}
                onChange={(e) => setSite({ ...site, site_name: e.target.value })}
                placeholder="TrendUp"
              />
            </div>
            <div className="space-y-2">
              <Label>Support Email</Label>
              <Input
                type="email"
                value={site.support_email}
                onChange={(e) => setSite({ ...site, support_email: e.target.value })}
                placeholder="support@trendup.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Site Logo URL</Label>
            <Input
              value={site.site_logo}
              onChange={(e) => setSite({ ...site, site_logo: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label>Maintenance Mode</Label>
              <p className="text-xs text-muted-foreground">Disable site access for regular users</p>
            </div>
            <Switch
              checked={site.maintenance_mode}
              onCheckedChange={(checked) => setSite({ ...site, maintenance_mode: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <CardTitle>Email Verification</CardTitle>
              <CardDescription>Configure email verification for new signups</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!smtpConfigured && (
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-xs text-muted-foreground">
                Configure SMTP in Email &amp; SMTP settings before enabling email verification.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Email Verification</Label>
              <p className="text-xs text-muted-foreground">Send verification code when users sign up</p>
            </div>
            <Switch
              checked={email.enabled}
              onCheckedChange={(checked) => setEmail({ ...email, enabled: checked })}
              disabled={!smtpConfigured}
            />
          </div>
          {email.enabled && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="space-y-0.5">
                <Label>Require Verification Before Login</Label>
                <p className="text-xs text-muted-foreground">Users must verify email before accessing dashboard</p>
              </div>
              <Switch
                checked={email.require_verification}
                onCheckedChange={(checked) => setEmail({ ...email, require_verification: checked })}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}