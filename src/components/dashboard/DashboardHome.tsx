import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { 
  Flame, 
  TrendingUp, 
  CheckCircle, 
  ArrowUpRight,
  Loader2,
  Layers,
  CalendarCheck,
  Zap
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface DashboardStats {
  dailyEarned: number;
  dailyChange: number;
  completedExchangeCount: number;
  completedExchangePoints: number;
  completedRaids: number;
  successRate: number;
  availableContents: number;
}

interface RaidState {
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  joined: boolean;
  title?: string;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [raid, setRaid] = useState<RaidState | null>(null);
  const [now, setNow] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      const todayStart = startOfUtcDay(new Date());
      const yesterdayStart = new Date(todayStart.getTime() - 86400000);
      const tomorrowStart = new Date(todayStart.getTime() + 86400000);

      const [submissionsRes, transactionsRes, adsRes, raidRes] = await Promise.all([
        supabase
          .from("task_submissions")
          .select("status, points_awarded, created_at")
          .eq("user_id", user.id),
        supabase
          .from("transactions")
          .select("amount, created_at")
          .eq("user_id", user.id)
          .gt("amount", 0),
        supabase
          .from("ads")
          .select("id, creator_id, completed_count, required_completions")
          .eq("is_active", true),
        (supabase.rpc as any)("get_raid_state", { _user_id: user.id }).maybeSingle(),
      ]);

      const submissions = submissionsRes.data || [];
      const approved = submissions.filter((s: any) => s.status === "approved");
      const awaiting = submissions.filter((s: any) => s.status === "pending" || s.status === "needs_review");

      const todayEarned = (transactionsRes.data || [])
        .filter((t: any) => new Date(t.created_at) >= todayStart && new Date(t.created_at) < tomorrowStart)
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const yesterdayEarned = (transactionsRes.data || [])
        .filter((t: any) => new Date(t.created_at) >= yesterdayStart && new Date(t.created_at) < todayStart)
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

      const totalAttempts = submissions.length;
      const totalEarned = approved.reduce((sum: number, s: any) => sum + (s.points_awarded || 0), 0);
      const successRate = totalAttempts > 0 ? Math.round((approved.length / totalAttempts) * 1000) / 10 : 100;

      const dailyChange = yesterdayEarned > 0
        ? Math.round(((todayEarned - yesterdayEarned) / yesterdayEarned) * 1000) / 10
        : todayEarned > 0 ? 100 : 0;

      const ads = adsRes.data || [];
      const available = ads.filter((a: any) => a.creator_id !== user.id && a.completed_count < a.required_completions);

      let completedRaids = 0;
      if (raidRes.error) {
        console.warn("raid state fetch failed:", raidRes.error);
      } else if (raidRes.data && !Array.isArray(raidRes.data)) {
        const r = raidRes.data as RaidState;
        setRaid({ active: !!r.active, startsAt: r.startsAt, endsAt: r.endsAt, joined: !!r.joined });
        setStats({
          dailyEarned: todayEarned,
          dailyChange,
          completedExchangeCount: approved.length,
          completedExchangePoints: totalEarned,
          completedRaids: 0,
          successRate,
          availableContents: available.length,
        });
        setIsLoading(false);
        return;
      }

      try {
        const { data: participation } = await (supabase as any)
          .from("raid_participations")
          .select("id")
          .eq("user_id", user.id)
          .in("status", ["verified", "completed"]);
        completedRaids = participation?.length || 0;
      } catch {
        completedRaids = 0;
      }

      setStats({
        dailyEarned: todayEarned,
        dailyChange,
        completedExchangeCount: approved.length,
        completedExchangePoints: totalEarned,
        completedRaids,
        successRate,
        availableContents: available.length,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const raidCountdown = useMemo(() => {
    if (!raid?.active || !raid.endsAt) return null;
    const end = new Date(raid.endsAt).getTime();
    const diff = Math.max(0, end - now.getTime());
    if (diff === 0) return null;
    const totalSeconds = Math.floor(diff / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return { h: pad(h), m: pad(m), s: pad(s), isActive: now.getTime() >= new Date(raid.startsAt || "").getTime() };
  }, [raid, now]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statsData = [
    {
      label: "Daily Earned",
      value: `${stats?.dailyEarned.toLocaleString() || 0} SP`,
      icon: Flame,
      change: stats?.dailyChange && stats.dailyChange !== 0
        ? `${stats.dailyChange > 0 ? "+" : ""}${stats.dailyChange}% vs yesterday`
        : "No change",
      trend: (stats?.dailyChange || 0) >= 0 ? "up" : "down",
      hint: "Streak Points earned today",
    },
    {
      label: "Completed Exchange",
      value: `${stats?.completedExchangeCount || 0}`,
      icon: CheckCircle,
      change: `+${stats?.completedExchangePoints || 0} SP`,
      trend: "up",
      hint: "Contents engaged & points earned",
    },
    {
      label: "Completed Raids Lifetime",
      value: `${stats?.completedRaids || 0}`,
      icon: Zap,
      change: "All time",
      trend: "neutral",
      hint: "Raid participations",
    },
    {
      label: "Success Rate",
      value: `${stats?.successRate || 100}%`,
      icon: TrendingUp,
      change: (stats?.successRate || 100) >= 90 ? "Excellent" : "Good",
      trend: (stats?.successRate || 100) >= 90 ? "up" : "neutral",
      hint: "Verified engagement activity",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card variant="interactive">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <Badge
                    variant={stat.trend === "up" ? "success" : "secondary"}
                    className="text-xs max-w-[60%] truncate shrink-0"
                    title={stat.change}
                  >
                    {stat.change}
                  </Badge>
                </div>
                <div className="text-2xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
                <div className="text-xs text-muted-foreground/70 mt-1">{stat.hint}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Available Contents teaser */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">
              {stats?.availableContents || 0} Available Contents
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {stats?.availableContents && stats.availableContents > 0
                ? "Real contents waiting for your engagement."
                : "No contents available at the moment."}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 self-start sm:self-auto" onClick={() => navigate("/dashboard/tasks")}>
          View All
          <ArrowUpRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Active Raid */}
      {raid?.active && (
        <Card variant="elevated" className="bg-gradient-to-br from-primary/20 via-purple-500/10 to-accent/20 border-primary/40 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">Active Raid</h3>
                    {raid.joined && <Badge variant="success" className="text-xs">Joined</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {raid.joined
                      ? "You're in! Keep engaging until the raid ends."
                      : "A raid is live right now. Join before it ends to earn your share."}
                  </p>
                </div>
              </div>

              {raidCountdown && raidCountdown.isActive ? (
                <div className="flex items-center gap-3">
                  {[{ v: raidCountdown.h, l: "hrs" }, { v: raidCountdown.m, l: "min" }, { v: raidCountdown.s, l: "sec" }].map((unit, i) => (
                    <div key={unit.l} className="text-center">
                      <div className="w-16 h-16 rounded-xl bg-card border border-border flex items-center justify-center">
                        <span className="text-2xl font-bold tabular-nums">{unit.v}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{unit.l}</div>
                      {i < 2 && <span className="hidden lg:block" />}
                    </div>
                  ))}
                  <Button variant="gradient" asChild className="lg:ml-2">
                    <Link to="/dashboard/raid">
                      {raid.joined ? "Open Raid" : "Join Raid"}
                      <ArrowUpRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button variant="gradient" asChild>
                  <Link to="/dashboard/raid">
                    Open Raid
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card variant="elevated" className="bg-gradient-to-br from-primary/20 to-purple-500/20 border-primary/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <CalendarCheck className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Start growing</h3>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Browse available contents and earn streak points for engaging with them.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="gradient" asChild>
                <Link to="/dashboard/tasks">
                  Browse Contents
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-gradient-to-br from-accent/20 to-cyan-400/20 border-accent/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-semibold">Boost your content</h3>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Add posts to get authentic engagement on your contents from real TikTok users.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="gradient" asChild>
                <Link to="/dashboard/create-ad">
                  Add Post
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}