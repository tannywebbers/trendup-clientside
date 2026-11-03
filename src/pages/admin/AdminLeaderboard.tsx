import { useEffect, useState } from "react";
import { Trophy, Loader2, Award, Coins, Trash2, Check, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Period = "daily" | "weekly" | "monthly" | "referral";

interface RewardRow {
  period: Period;
  rank: number;
  reward_points: number;
  is_active: boolean;
}

const PERIODS: Period[] = ["daily", "weekly", "monthly", "referral"];
const RANKS = Array.from({ length: 10 }, (_, i) => i + 1);

const DEFAULT_REWARDS: Record<Period, RewardRow[]> = {
  daily: RANKS.map((rank) => ({ period: "daily", rank, reward_points: rank === 1 ? 50 : Math.max(10, 50 - rank * 4), is_active: true })),
  weekly: RANKS.map((rank) => ({ period: "weekly", rank, reward_points: rank === 1 ? 250 : Math.max(30, 250 - rank * 20), is_active: true })),
  monthly: RANKS.map((rank) => ({ period: "monthly", rank, reward_points: rank === 1 ? 1000 : Math.max(60, 1000 - rank * 85), is_active: true })),
  referral: RANKS.map((rank) => ({ period: "referral", rank, reward_points: rank === 1 ? 400 : Math.max(40, 400 - rank * 36), is_active: true })),
};

export default function AdminLeaderboard() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("daily");
  const [rows, setRows] = useState<Record<Period, RewardRow[]>>(DEFAULT_REWARDS);
  const [rewardsMode, setRewardsMode] = useState<"auto" | "manual">("auto");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);
  const [awarding, setAwarding] = useState(false);

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    setLoading(true);
    const [rewardsRes, modeRes] = await Promise.all([
      (supabase as any).from("leaderboard_rewards").select("*"),
      supabase.from("platform_settings").select("value").eq("key", "leaderboard_rewards_mode").maybeSingle(),
    ]);
    const map: Record<Period, RewardRow[]> = JSON.parse(JSON.stringify(DEFAULT_REWARDS));
    ((rewardsRes.data as RewardRow[]) || []).forEach((r: RewardRow) => {
      const existing = map[r.period]?.find((x) => x.rank === r.rank);
      if (existing) {
        existing.reward_points = r.reward_points;
        existing.is_active = r.is_active;
      } else if (map[r.period]) {
        map[r.period].push({ period: r.period, rank: r.rank, reward_points: r.reward_points, is_active: r.is_active });
      }
    });
    const modeValue = (modeRes.data as any)?.value?.mode;
    if (modeValue === "manual" || modeValue === "auto") {
      setRewardsMode(modeValue);
    }
    setRows(map);
    setLoading(false);
  };

  const saveRewardsMode = async (mode: "auto" | "manual") => {
    setSavingMode(true);
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key: "leaderboard_rewards_mode", value: { mode } }, { onConflict: "key" });
    setSavingMode(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not update rewards mode." });
      return;
    }
    setRewardsMode(mode);
    toast({
      title: mode === "auto" ? "Auto-run enabled" : "Manual mode enabled",
      description:
        mode === "auto"
          ? "Awards will be distributed automatically at the end of each period."
          : "Awards are only distributed when you run them manually.",
    });
  };

  const saveRewards = async () => {
    setSaving(true);
    const payload = rows[period].map((r) => ({ period: r.period, rank: r.rank, reward_points: r.reward_points, is_active: r.is_active }));
    // Delete existing for this period then upsert (keeps config matching what is shown)
    await (supabase as any).from("leaderboard_rewards").delete().eq("period", period);
    const { error } = await (supabase as any).from("leaderboard_rewards").insert(payload);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not save reward tiers." });
      return;
    }
    toast({ title: "Saved", description: "Leaderboard reward tiers updated." });
  };

  const runAwards = async () => {
    if (!period) return;
    setAwarding(true);
    const { data, error } = await (supabase.rpc as any)("award_leaderboard_rewards", { p_period: period });
    setAwarding(false);
    setAwardOpen(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Could not run awards." });
      return;
    }
    const res = data as { success?: boolean; awarded?: number; message?: string };
    toast({
      title: "Awards run!",
      description: res.message || `Rewarded top ranks on the ${period} leaderboard.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Leaderboards & Rewards</h1>
        </div>
        <Button variant="gradient" onClick={() => setAwardOpen(true)} disabled={loading || rewardsMode === "auto"}>
          <Award className="w-4 h-4 mr-2" />
          Run Awards Now ({period})
        </Button>
      </div>

      {/* Rewards distribution mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="w-5 h-5 text-primary" />
            Rewards Distribution
          </CardTitle>
          <CardDescription>
            Choose whether leaderboard rewards are distributed automatically at the end of each period or only when you run them manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={rewardsMode === "auto"}
              onCheckedChange={(checked) => saveRewardsMode(checked ? "auto" : "manual")}
              disabled={savingMode}
            />
            {savingMode && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            <div>
              <p className="text-sm font-medium">
                {rewardsMode === "auto" ? "Auto-run rewards" : "Manual awards only"}
              </p>
              <p className="text-xs text-muted-foreground">
                {rewardsMode === "auto"
                  ? "A scheduled worker distributes rewards when each period ends. You can still force-run anytime."
                  : "The Run Awards Now button is the only way rewards get distributed. Remember to run it before a new period starts."}
              </p>
            </div>
          </div>
          <Badge variant={rewardsMode === "auto" ? "success" : "warning"}>
            {rewardsMode === "auto" ? "Auto" : "Manual"}
          </Badge>
        </CardContent>
      </Card>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 max-w-md">
          {PERIODS.map((p) => (
            <TabsTrigger key={p} value={p} className="capitalize">{p}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={period}>
          <Card>
            <CardHeader>
              <CardTitle className="capitalize">{period} reward tiers</CardTitle>
              <CardDescription>
                Configure what the top 10 users earn when the {period} period ends.{" "}
                {rewardsMode === "auto" ? "Rewards are issued automatically at the end of the period." : "Rewards are issued only when you run them manually."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-3">
                  {rows[period].sort((a, b) => a.rank - b.rank).map((row) => (
                    <div key={row.rank} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                      <div className="flex items-center gap-2 w-24 shrink-0">
                        <span className="text-lg">{row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}</span>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <Coins className="w-4 h-4 text-primary shrink-0" />
                        <Input
                          type="number"
                          min={0}
                          value={row.reward_points}
                          onChange={(e) => {
                            const updated = rows[period].map((r) =>
                              r.rank === row.rank ? { ...r, reward_points: parseInt(e.target.value) || 0 } : r
                            );
                            setRows({ ...rows, [period]: updated });
                          }}
                          className="w-28"
                        />
                        <span className="text-xs text-muted-foreground">SP</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {row.is_active ? <Badge variant="success" className="text-xs">Active</Badge> : <Badge variant="secondary" className="text-xs">Off</Badge>}
                        <Switch
                          checked={row.is_active}
                          onCheckedChange={(checked) => {
                            const updated = rows[period].map((r) =>
                              r.rank === row.rank ? { ...r, is_active: checked } : r
                            );
                            setRows({ ...rows, [period]: updated });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-2">
                    <Button variant="gradient" onClick={saveRewards} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" /> Save {period} tiers</>}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-start gap-3">
              <Trash2 className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Running awards now credits the current top 10 of the <b className="text-foreground capitalize">{period}</b> period,
                marks the period as rewarded (idempotent — running twice won't double-pay), and notifies each winner.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={awardOpen} onOpenChange={setAwardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Run {period} leaderboard awards?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Top 10 users on the {period} leaderboard will be credited their configured reward points
              and notified. This is idempotent and safe to run at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runAwards} disabled={awarding}>
              {awarding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Award Rewards"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}