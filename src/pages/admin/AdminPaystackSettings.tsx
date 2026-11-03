import { useState, useEffect } from "react";
import { Banknote, Save, Loader2, Eye, EyeOff, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsHeader } from "./components/SettingsList";

interface PaystackSettings {
  public_key: string;
  secret_key: string;
  test_mode: boolean;
  enabled: boolean;
}

export default function AdminPaystackSettings() {
  const [settings, setSettings] = useState<PaystackSettings>({
    public_key: "",
    secret_key: "",
    test_mode: true,
    enabled: false,
  });
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "paystack_settings")
        .maybeSingle();
      if (data && typeof data.value === "object" && data.value !== null) {
        setSettings((prev) => ({ ...prev, ...(data.value as unknown as PaystackSettings) }));
      }
    } catch (error) {
      console.error("Error fetching paystack settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.public_key || !settings.secret_key) {
      toast({ variant: "destructive", title: "Error", description: "Enter both your Paystack public and secret keys." });
      return;
    }
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id")
        .eq("key", "paystack_settings")
        .maybeSingle();
      const value = JSON.parse(JSON.stringify(settings));
      if (existing) {
        const { error } = await supabase.from("platform_settings").update({ value }).eq("key", "paystack_settings");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("platform_settings").insert([{ key: "paystack_settings", value }]);
        if (error) throw error;
      }
      toast({ title: "Saved", description: "Paystack settings saved." });
    } catch (error) {
      console.error("Error saving paystack settings:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save Paystack settings." });
    } finally {
      setIsSaving(false);
    }
  };

  const keyValid = (key: string) => /^(sk|pk)_(test_)?[A-Za-z0-9]+$/.test(key);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <SettingsHeader
        title="Paystack Payments"
        description="Configure the Paystack payment gateway for points purchases"
        backHref="/baki/stage/admin/settings/paystack-pricing"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <CardTitle>API Credentials</CardTitle>
              <CardDescription>Find these in your Paystack Dashboard → Settings → API Keys</CardDescription>
            </div>
            {settings.enabled ? (
              <Badge className="ml-auto bg-success/10 text-success border-success/20">Enabled</Badge>
            ) : (
              <Badge variant="secondary" className="ml-auto">Disabled</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Public Key</Label>
            <Input
              value={settings.public_key}
              onChange={(e) => setSettings({ ...settings, public_key: e.target.value.trim() })}
              placeholder="pk_test_..."
            />
            {settings.public_key && (
              <p className={`text-xs ${keyValid(settings.public_key) ? "text-green-600" : "text-warning"}`}>
                {keyValid(settings.public_key) ? "✓ Valid format" : "Looks like a test key unless it starts with pk_live_"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Secret Key</Label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                value={settings.secret_key}
                onChange={(e) => setSettings({ ...settings, secret_key: e.target.value.trim() })}
                placeholder="sk_test_..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="space-y-0.5">
              <Label>Test Mode</Label>
              <p className="text-xs text-muted-foreground">Use test keys (no real charges)</p>
            </div>
            <Switch
              checked={settings.test_mode}
              onCheckedChange={(checked) => setSettings({ ...settings, test_mode: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Payments</Label>
              <p className="text-xs text-muted-foreground">Allow users to purchase points</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="p-4 rounded-lg bg-muted/50 border border-border flex items-start gap-2">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          The secret key is stored in the database for reference. For the payment edge functions to charge cards, the
          <code className="mx-1 bg-muted px-1 py-0.5 rounded">PAYSTACK_SECRET_KEY</code> environment variable must also be set in the Supabase Dashboard.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>
    </div>
  );
}