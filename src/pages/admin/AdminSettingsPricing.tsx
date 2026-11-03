import { useState, useEffect } from "react";
import { Coins, Rocket, Plus, Save, Loader2, BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PricingSettings {
  points_amount: number;
  currency_amount: number;
  currency_symbol: string;
}

interface BoostPlan {
  plan_key: string;
  duration_days: number;
  price_points: number;
  multiplier: number;
  is_active: boolean;
}

const BOOST_PLAN_LABELS: Record<string, string> = {
  "1_day": "1 Day",
  "3_day": "3 Days",
  "7_day": "7 Days",
};

export default function AdminSettingsPricing() {
  const [pricing, setPricing] = useState<PricingSettings>({ points_amount: 10, currency_amount: 5, currency_symbol: "₦" });
  const [boostPlans, setBoostPlans] = useState<BoostPlan[]>([]);
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
        .select("*")
        .eq("key", "pricing_settings")
        .maybeSingle();
      if (data && typeof data.value === "object" && data.value !== null) {
        setPricing((prev) => ({ ...prev, ...(data.value as unknown as PricingSettings) }));
      }

      const { data: boostData } = await (supabase as any)
        .from("boost_pricing")
        .select("*")
        .order("price_points", { ascending: true });
      if (boostData && boostData.length) setBoostPlans(boostData as BoostPlan[]);
    } catch (error) {
      console.error("Error fetching pricing:", error);
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
      await saveSetting("pricing_settings", pricing);
      const boostRows = boostPlans.map((p) => ({
        plan_key: p.plan_key,
        duration_days: p.duration_days,
        price_points: p.price_points,
        multiplier: p.multiplier,
        is_active: p.is_active,
      }));
      if (boostRows.length) {
        const { error } = await (supabase as any)
          .from("boost_pricing")
          .upsert(boostRows, { onConflict: "plan_key" });
        if (error) throw error;
      }
      toast({ title: "Saved", description: "Pricing settings updated." });
    } catch (error) {
      console.error("Error saving pricing:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save pricing settings." });
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

  const rate = pricing.points_amount > 0 && pricing.currency_amount > 0
    ? pricing.points_amount / pricing.currency_amount
    : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pricing Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Exchange rate for buying points and boost costs</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BadgeDollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Points Exchange Rate</CardTitle>
              <CardDescription>How many points users get per currency amount</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>Points Amount</Label>
                <Input
                  type="number"
                  value={pricing.points_amount}
                  onChange={(e) => setPricing({ ...pricing, points_amount: parseInt(e.target.value) || 1 })}
                  min={1}
                />
              </div>
              <div className="flex items-center justify-center text-2xl font-bold text-muted-foreground">=</div>
              <div className="space-y-2">
                <Label>Currency Amount</Label>
                <div className="flex gap-2">
                  <Input
                    value={pricing.currency_symbol}
                    onChange={(e) => setPricing({ ...pricing, currency_symbol: e.target.value })}
                    className="w-16"
                    placeholder="₦"
                  />
                  <Input
                    type="number"
                    value={pricing.currency_amount}
                    onChange={(e) => setPricing({ ...pricing, currency_amount: parseInt(e.target.value) || 1 })}
                    min={1}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Rate: {pricing.points_amount} points = {pricing.currency_symbol}{pricing.currency_amount} (
              {rate.toFixed(2)} points per {pricing.currency_symbol}1)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <CardTitle>Content Boost Pricing</CardTitle>
              <CardDescription>Point cost for boosting a post (appears first in Browse Contents)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {boostPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No boost plans found. Run the dashboard migration to seed defaults (1 / 3 / 7 days).
            </p>
          ) : (
            <div className="space-y-3">
              {boostPlans.map((plan) => (
                <div
                  key={plan.plan_key}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <Coins className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">
                      {BOOST_PLAN_LABELS[plan.plan_key] || plan.plan_key.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Cost</Label>
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      value={plan.price_points}
                      onChange={(e) =>
                        setBoostPlans((prev) =>
                          prev.map((p) =>
                            p.plan_key === plan.plan_key
                              ? { ...p, price_points: parseInt(e.target.value) || 0 }
                              : p
                          )
                        )
                      }
                    />
                    <Label className="text-xs text-muted-foreground">SP</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Multiplier</Label>
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      value={plan.multiplier}
                      onChange={(e) =>
                        setBoostPlans((prev) =>
                          prev.map((p) =>
                            p.plan_key === plan.plan_key ? { ...p, multiplier: parseInt(e.target.value) || 1 } : p
                          )
                        )
                      }
                    />
                    <Label className="text-xs text-muted-foreground">x</Label>
                  </div>
                  <Switch
                    className="ml-auto"
                    checked={plan.is_active}
                    onCheckedChange={(checked) =>
                      setBoostPlans((prev) =>
                        prev.map((p) => (p.plan_key === plan.plan_key ? { ...p, is_active: checked } : p))
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}