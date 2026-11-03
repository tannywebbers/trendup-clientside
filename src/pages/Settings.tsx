import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Bell, Mail, Loader2, Save, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PrefMap {
  checkin: boolean;
  checkin_milestone: boolean;
  raid: boolean;
  raid_reminder: boolean;
  leaderboard: boolean;
  wallet: boolean;
  referral: boolean;
  promotions: boolean;
}

const PREF_ITEMS: { key: keyof PrefMap; label: string; desc: string }[] = [
  { key: "checkin", label: "Check-in reminders", desc: "Remind me to keep my daily streak alive." },
  { key: "checkin_milestone", label: "Milestone rewards", desc: "Notify me when I unlock a streak milestone." },
  { key: "raid", label: "Raid updates", desc: "When a new raid goes live or I'm added." },
  { key: "raid_reminder", label: "Raid reminders", desc: "Reminders before an active raid begins." },
  { key: "leaderboard", label: "Leaderboard rewards", desc: "When I earn a leaderboard reward." },
  { key: "wallet", label: "Wallet activity", desc: "Points credited or spent in my wallet." },
  { key: "referral", label: "Referral activity", desc: "When someone joins using my link." },
  { key: "promotions", label: "Promotions & news", desc: "New features and special events." },
];

const DEFAULT_PREFS: PrefMap = {
  checkin: true,
  checkin_milestone: true,
  raid: true,
  raid_reminder: true,
  leaderboard: true,
  wallet: true,
  referral: true,
  promotions: true,
};

export default function Settings() {
  const { user } = useAuth();
  const [inApp, setInApp] = useState<PrefMap>(DEFAULT_PREFS);
  const [email, setEmail] = useState<PrefMap>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPrefs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchPrefs = async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("notification_preferences")
      .select("in_app, email")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error && data) {
      setInApp({ ...DEFAULT_PREFS, ...(data.in_app || {}) });
      setEmail({ ...DEFAULT_PREFS, ...(data.email || {}) });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const normalizedInApp = { ...inApp };
    const normalizedEmail = { ...email };
    Object.keys(normalizedInApp).forEach((k) => {
      (normalizedInApp as any)[k] = Boolean((normalizedInApp as any)[k]);
    });
    Object.keys(normalizedEmail).forEach((k) => {
      (normalizedEmail as any)[k] = Boolean((normalizedEmail as any)[k]);
    });

    const { error } = await (supabase as any).from("notification_preferences").upsert({
      user_id: user.id,
      in_app: normalizedInApp,
      email: normalizedEmail,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save preferences");
      return;
    }
    toast.success("Preferences saved");
  };

  const renderPrefRows = (values: PrefMap, setter: (v: PrefMap) => void) =>
    PREF_ITEMS.map((item) => (
      <div
        key={item.key}
        className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0"
      >
        <div>
          <div className="text-sm font-medium">{item.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
        </div>
        <Switch
          checked={values[item.key]}
          onCheckedChange={(checked) => setter({ ...values, [item.key]: checked })}
        />
      </div>
    ));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <SettingsIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">Manage how TrendUp keeps in touch with you.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">In-app notifications</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Delivered to your notification center on this app.</p>
          {renderPrefRows(inApp, setInApp)}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Email notifications</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Sent to the email address on your account.</p>
          {renderPrefRows(email, setEmail)}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="gradient" onClick={handleSave} disabled={saving} className="sm:w-auto w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" /> Save Preferences</>}
        </Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-2">Account</h3>
          <p className="text-xs text-muted-foreground">
            Update your name and email on the{" "}
            <a href="/dashboard/profile" className="text-primary hover:underline">Profile</a> page. Manage your wallet on the{" "}
            <a href="/dashboard/wallet" className="text-primary hover:underline">Wallet</a> page. More settings coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}