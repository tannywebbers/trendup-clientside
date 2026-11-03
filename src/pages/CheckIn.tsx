import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, CalendarCheck, Trophy, Loader2, Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

interface Milestone {
  streak_length: number;
  reward_amount: number;
  is_active: boolean;
}

interface CheckinStatus {
  success: boolean;
  checked_today: boolean;
  reward: number;
  current_streak: number;
  longest_streak: number;
  checkin_count: number;
  milestones: Milestone[];
  recent_dates: string[];
}

const STREAK_SYMBOL = "🔥";

function dayKey(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default function CheckIn() {
  const { user, refreshProfile } = useAuth();
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [lastReward, setLastReward] = useState<{ reward: number; milestone: number | null } | null>(null);

  const fetchStatus = async () => {
    if (!user) return;
    const { data, error } = await (supabase.rpc as any)("get_my_checkin_status", {
      _user_id: user.id,
    });
    if (error) {
      console.error("checkin status error:", error);
    } else if (data) {
      setStatus(data as CheckinStatus);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleClaim = async () => {
    if (!user) return;
    setClaiming(true);
    try {
      const { data, error } = await (supabase.rpc as any)("claim_daily_checkin", {
        _user_id: user.id,
      });
      if (error || !data?.success) {
        console.error("claim error:", error || data);
        return;
      }
      const res = data as { reward: number; milestone_reward: number | null; already_checked: boolean };
      await refreshProfile();
      if (!res.already_checked) {
        setLastReward({ reward: res.reward, milestone: res.milestone_reward ?? null });
      }
      await fetchStatus();
    } finally {
      setClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const checkedToday = !!status?.checked_today;
  const dailyReward = status?.reward || 10;
  const activeMilestones = (status?.milestones || []).filter((m) => m.is_active).sort((a, b) => a.streak_length - b.streak_length);
  const nextStreak = checkedToday ? (status?.current_streak || 0) : (status?.current_streak || 0) + 1;
  const nextMilestone = activeMilestones.find((m) => m.streak_length >= nextStreak) ?? null;
  const milestonesDone = activeMilestones.filter((m) => m.streak_length <= nextStreak).length;

  const last7 = Array.from({ length: 7 }, (_, i) => dayKey(6 - i));
  const checkedDates = new Set(status?.recent_dates || []);

  const statCards = [
    { icon: Flame, label: "Current streak", value: `${status?.current_streak || 0} ${(status?.current_streak || 0) === 1 ? "day" : "days"}` },
    { icon: CalendarCheck, label: "Total check-ins", value: `${status?.checkin_count || 0}` },
    { icon: Trophy, label: "Milestones", value: `${milestonesDone} of ${activeMilestones.length}` },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Hero check-in card */}
      <Card className="overflow-hidden border-primary/20">
        <CardContent className="p-6 sm:p-8 bg-gradient-to-b from-primary/10 to-transparent">
          {lastReward && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4"
            >
              <Badge variant="gradient" className="text-sm px-4 py-1.5">
                +{lastReward.reward} {STREAK_SYMBOL}
                {lastReward.milestone ? ` + Milestone Bonus ${lastReward.milestone} ${STREAK_SYMBOL}` : ""}
              </Badge>
            </motion.div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
                <Flame className={`w-8 h-8 ${checkedToday ? "text-white animate-pulse" : "text-white/80"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Current streak</p>
                <p className="text-4xl font-bold tracking-tight">
                  {status?.current_streak || 0}{" "}
                  <span className="text-lg font-medium text-muted-foreground">
                    {(status?.current_streak || 0) === 1 ? "day" : "days"}
                  </span>
                </p>
                {checkedToday ? (
                  <Badge className="mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <Check className="w-3 h-3 mr-1" /> Checked in today
                  </Badge>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Check in today to reach {nextStreak} {nextStreak === 1 ? "day" : "days"}
                  </p>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <p className="text-sm text-muted-foreground">Daily reward</p>
              <p className="text-2xl font-semibold tabular-nums">
                {STREAK_SYMBOL} {dailyReward.toLocaleString()}
              </p>
              {nextMilestone && !checkedToday ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Next milestone at {nextMilestone.streak_length} days → {STREAK_SYMBOL}{" "}
                  {nextMilestone.reward_amount.toLocaleString()}
                </p>
              ) : null}
              <Button
                variant="gradient"
                size="lg"
                onClick={handleClaim}
                disabled={checkedToday || claiming}
                className="mt-4 min-w-44"
              >
                {claiming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : checkedToday ? (
                  <><CalendarCheck className="w-4 h-4 mr-2" /> Checked In</>
                ) : (
                  <><CalendarCheck className="w-4 h-4 mr-2" /> Check In Today</>
                )}
              </Button>
            </div>
          </div>

          {/* Last 7 days strip */}
          <div className="mt-8">
            <p className="text-sm font-medium mb-2">This week</p>
            <div className="flex justify-between gap-2">
              {last7.map((day, i) => {
                const checked = checkedDates.has(day);
                const isToday = i === 6;
                const label = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                  new Date(day + "T00:00:00Z").getUTCDay()
                ];
                return (
                  <div key={day} className="flex flex-col items-center gap-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      checked
                        ? "bg-gradient-to-br from-orange-400 to-red-500 text-white"
                        : isToday
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {checked ? <Check className="w-5 h-5" /> : <span className="text-xs font-medium">{i + 1}</span>}
                    </div>
                    <span className={`text-xs truncate ${isToday ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {isToday ? "Today" : label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card variant="interactive">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold truncate">{s.value}</div>
                  <div className="text-sm text-muted-foreground truncate">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Milestones */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeMilestones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No milestone rewards configured yet.
              </p>
            ) : (
              activeMilestones.map((m) => {
                const reached = (status?.current_streak || 0) >= m.streak_length;
                const progress = Math.min(100, Math.round((nextStreak / m.streak_length) * 100));
                return (
                  <div
                    key={m.streak_length}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${
                      reached ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {reached ? (
                        <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                          <Trophy className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{m.streak_length}-day streak</p>
                        <p className="text-xs text-muted-foreground truncate">{m.streak_length} consecutive check-ins</p>
                        <div className="h-1.5 rounded-full bg-border mt-2 overflow-hidden w-full max-w-48">
                          <div
                            className={`h-full rounded-full transition-all ${
                              reached ? "bg-gradient-to-r from-orange-400 to-red-500" : "bg-primary"
                            }`}
                            style={{ width: `${reached ? 100 : progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-semibold tabular-nums whitespace-nowrap shrink-0">
                      {STREAK_SYMBOL} {m.reward_amount.toLocaleString()}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              How it works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: Flame, text: `Claim ${STREAK_SYMBOL} ${dailyReward.toLocaleString()} every day you check in.` },
              { icon: Trophy, text: "Hit streak milestones (3, 7, 14, 30 days) for big bonus payouts." },
              { icon: CalendarCheck, text: "Miss a day and your streak resets — keep it burning!" },
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20">
                <t.icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{t.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}