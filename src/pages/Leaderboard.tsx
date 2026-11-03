import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Coins, Crown, Medal, Loader2, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "referral";

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  tiktok_username: string;
  avatar_url: string | null;
  points: number;
}

interface LeaderboardData {
  success: boolean;
  period: string;
  period_start: string;
  entries: LeaderboardEntry[];
  rewards: { rank: number; reward_points: number; is_active: boolean }[];
  my_rank: number | null;
}

const periodMeta: Record<LeaderboardPeriod, { label: string; icon: React.ElementType; blurb: string }> = {
  daily: { label: "Daily", icon: TrendingUp, blurb: "Top engagers today — rewards reset every day." },
  weekly: { label: "Weekly", icon: Crown, blurb: "Top earners this week — big rewards for the leaders." },
  monthly: { label: "Monthly", icon: Trophy, blurb: "Top earners this month — the bragging rights round." },
  referral: { label: "Referral", icon: Users, blurb: "Most successful referrers — growing the family." },
};

function emojiFor(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}`;
}

function rankColor(rank: number): string {
  if (rank === 1) return "from-yellow-400 to-amber-500";
  if (rank === 2) return "from-slate-300 to-slate-400";
  if (rank === 3) return "from-orange-400 to-amber-600";
  return "from-primary/40 to-accent/40";
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchLeaderboard(period);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, period]);

  const fetchLeaderboard = async (p: LeaderboardPeriod) => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await (supabase.rpc as any)("get_leaderboard", {
      p_period: p,
      _user_id: user.id,
    });
    if (error) {
      console.error("leaderboard error:", error);
    } else if (data) {
      setData(data as LeaderboardData);
    }
    setIsLoading(false);
  };

  const meta = periodMeta[period];
  const activeRewards = (data?.rewards || []).filter((r) => r.is_active);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Leaderboard</h2>
          <p className="text-sm text-muted-foreground">{meta.blurb}</p>
        </div>
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as LeaderboardPeriod)}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-4">
          {(["daily", "weekly", "monthly", "referral"] as LeaderboardPeriod[]).map((p) => {
            const Icon = periodMeta[p].icon;
            return (
              <TabsTrigger key={p} value={p} disabled={isLoading}>
                <Icon className="w-4 h-4 mr-2 hidden sm:inline" />
                {periodMeta[p].label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={period}>
          <div className="grid lg:grid-cols-[1fr_260px] gap-4 mt-4">
            {/* Rankings */}
            <Card>
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : !data?.entries?.length ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Trophy className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>No rankings yet for this {meta.label.toLowerCase()} period.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.entries.map((entry, i) => {
                      const isMe = entry.user_id === user?.id;
                      return (
                        <motion.div
                          key={`${entry.rank}-${entry.user_id}`}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={`flex items-center gap-3 p-3 rounded-xl ${
                            isMe ? "bg-primary/10 border border-primary/30" : "bg-muted/20 border border-transparent"
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${rankColor(entry.rank)} flex items-center justify-center text-sm font-bold`}>
                            {emojiFor(entry.rank)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              {entry.name || entry.tiktok_username || "TrendUp user"}
                              {isMe && <Badge variant="gradient" className="ml-2 text-xs">You</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">@{entry.tiktok_username}</div>
                          </div>
                          <div className="flex items-center gap-1.5 font-semibold text-primary">
                            <Coins className="w-4 h-4" />
                            {entry.points.toLocaleString()}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {data?.my_rank != null && (
                  <div className="mt-4 p-3 rounded-xl border border-border bg-muted/40 text-center text-sm">
                    You are currently <span className="font-bold text-primary">#{data.my_rank}</span> on the{" "}
                    {meta.label.toLowerCase()} leaderboard.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rewards */}
            <div className="space-y-4">
              <Card className="bg-gradient-to-br from-primary/15 to-accent/10 border-primary/25">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Medal className="w-5 h-5 text-accent" />
                    <h3 className="font-semibold">{meta.label} Rewards</h3>
                  </div>
                  {activeRewards.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No reward tiers configured yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {activeRewards.map((r) => (
                        <div
                          key={r.rank}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{emojiFor(r.rank)}</span>
                            <span className="text-sm font-medium">#{r.rank}</span>
                          </div>
                          <Badge variant="gradient" className="gap-1">
                            <Coins className="w-3 h-3" />+{r.reward_points}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    Top-ranked users are rewarded automatically when each period ends.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-sm mb-2">How it works</h3>
                  <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                    <li>Earn points from content engagement, check-ins and raids.</li>
                    <li>Watch yourself climb in real time across all four periods.</li>
                    <li>Referral boards reward those who grow the community.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}