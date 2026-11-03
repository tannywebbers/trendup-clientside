import { useState, useEffect } from "react";
import { 
  Gift, 
  Users, 
  Save,
  Loader2,
  Percent,
  Coins,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BonusSettings {
  welcome_bonus: number;
  welcome_bonus_enabled: boolean;
  referral_commission_percentage: number;
  referral_enabled: boolean;
}

export default function AdminBonusSettings() {
  const [settings, setSettings] = useState<BonusSettings>({
    welcome_bonus: 0,
    welcome_bonus_enabled: false,
    referral_commission_percentage: 10,
    referral_enabled: true,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    totalCommissionPaid: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchStats();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "bonus_settings")
        .maybeSingle();

      if (data && typeof data.value === 'object' && data.value !== null) {
        const savedSettings = data.value as unknown as BonusSettings;
        setSettings(prev => ({ ...prev, ...savedSettings }));
      }
    } catch (error) {
      console.error("Error fetching bonus settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get total referrals count
      const { count: referralCount } = await supabase
        .from("referrals")
        .select("*", { count: "exact", head: true });

      // Get total commission paid
      const { data: commissions } = await supabase
        .from("referral_commissions")
        .select("commission_points");

      const totalCommission = commissions?.reduce((sum, c) => sum + (c.commission_points || 0), 0) || 0;

      setStats({
        totalReferrals: referralCount || 0,
        totalCommissionPaid: totalCommission,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id")
        .eq("key", "bonus_settings")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("platform_settings")
          .update({ value: JSON.parse(JSON.stringify(settings)) })
          .eq("key", "bonus_settings");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("platform_settings")
          .insert([{ key: "bonus_settings", value: JSON.parse(JSON.stringify(settings)) }]);
        if (error) throw error;
      }

      toast({ title: "Saved", description: "Bonus settings updated successfully." });
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
      <div>
        <h1 className="text-2xl font-semibold">Bonus & Referral Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure welcome bonuses and referral commissions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
                <p className="text-2xl font-bold">{stats.totalReferrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Coins className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Commission Paid</p>
                <p className="text-2xl font-bold">{stats.totalCommissionPaid} pts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Welcome Bonus Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Gift className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Welcome Bonus</CardTitle>
              <CardDescription>
                Credit new users with bonus points on signup
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Welcome Bonus</Label>
              <p className="text-xs text-muted-foreground">
                New users receive points when they sign up
              </p>
            </div>
            <Switch
              checked={settings.welcome_bonus_enabled}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, welcome_bonus_enabled: checked })
              }
            />
          </div>

          {settings.welcome_bonus_enabled && (
            <div className="space-y-2 pt-2 border-t">
              <Label>Bonus Amount (Points)</Label>
              <Input
                type="number"
                value={settings.welcome_bonus}
                onChange={(e) => 
                  setSettings({ ...settings, welcome_bonus: parseInt(e.target.value) || 0 })
                }
                min={0}
                placeholder="e.g., 50"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                New users will receive {settings.welcome_bonus} points upon registration
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <CardTitle>Referral Program</CardTitle>
              <CardDescription>
                Reward users for referring new members
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Referral Program</Label>
              <p className="text-xs text-muted-foreground">
                Users earn commission from referred users' purchases
              </p>
            </div>
            <Switch
              checked={settings.referral_enabled}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, referral_enabled: checked })
              }
            />
          </div>

          {settings.referral_enabled && (
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Commission Percentage
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={settings.referral_commission_percentage}
                    onChange={(e) => 
                      setSettings({ 
                        ...settings, 
                        referral_commission_percentage: parseFloat(e.target.value) || 0 
                      })
                    }
                    min={0}
                    max={100}
                    step={0.5}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  When a referred user purchases points, the referrer earns{" "}
                  {settings.referral_commission_percentage}% of the purchased points
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-medium mb-2">How it works:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Each user gets a unique referral code on their profile</li>
                  <li>New users can enter a referral code during registration</li>
                  <li>When the referred user purchases points, the referrer earns commission</li>
                  <li>Commission is automatically credited to the referrer's balance</li>
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
