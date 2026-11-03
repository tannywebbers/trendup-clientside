import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Zap, Link2, Clock, Loader2, CheckCircle2, Send, Eye, Check, ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RaidState {
  success: boolean;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  raid_link: string | null;
  joined: boolean;
  joined_at: string | null;
  post_window_start: string | null;
  post_window_end: string | null;
  yesterday_eligible: boolean;
  today_post: {
    id: string;
    post_url: string;
    status: string;
  } | null;
  message?: string;
}

const postStatusLabel: Record<string, { label: string; color: "secondary" | "success" | "default" }> = {
  pending: { label: "Pending review", color: "secondary" },
  viewed: { label: "Viewed by admin", color: "default" },
  added: { label: "Added to raid", color: "success" },
};

export default function Raid() {
  const { user } = useAuth();
  const [state, setState] = useState<RaidState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [postUrl, setPostUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (user) {
      fetchState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchState = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await (supabase.rpc as any)("get_raid_state", {
      _user_id: user.id,
    });
    if (error) {
      console.error("raid state error:", error);
    } else if (data) {
      setState(data as RaidState);
    }
    setIsLoading(false);
  };

  const handleSubmitPost = async () => {
    if (!user) return;
    if (!postUrl.trim()) {
      toast.error("Please paste your TikTok post link");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase.rpc as any)("submit_raid_post", {
        _user_id: user.id,
        p_post_url: postUrl.trim(),
      });
      if (error || !data?.success) {
        toast.error((error?.message as string) || (data as any)?.message || "Could not submit post");
        return;
      }
      toast.success("Post submitted for the raid!");
      setPostUrl("");
      await fetchState();
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!user) return;
    setJoining(true);
    try {
      const { data } = await (supabase.rpc as any)("join_raid", { _user_id: user.id });
      if (data?.success) {
        toast.success(data.message || "Joined the raid!");
      } else {
        toast.info(data?.message || "You're already in the raid.");
      }
      await fetchState();
    } finally {
      setJoining(false);
    }
  };

  const countdown = useMemo(() => {
    if (!state?.active || !state.ends_at) return null;
    const end = new Date(state.ends_at).getTime();
    const start = state.starts_at ? new Date(state.starts_at).getTime() : 0;
    const diff = end - now.getTime();
    if (diff <= 0) return { label: "Raid has ended", value: "00:00:00", ended: true };
    const total = Math.floor(diff / 1000);
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    const notStarted = now.getTime() < start;
    return {
      label: notStarted ? "Raid starts in" : "Time remaining until raid ends",
      value: `${h}:${m}:${s}`,
      ended: false,
      notStarted,
    };
  }, [state, now]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const todayPost = state?.today_post;
  const statusCfg = todayPost ? (postStatusLabel[todayPost.status] || postStatusLabel.pending) : null;

  return (
    <div className="space-y-6 max-w-3xl">
      {!state?.active ? (
        <Card>
          <CardContent className="p-10 text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Zap className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">No raid is live right now</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
              Raids happen regularly. Check back soon — and make sure you claim your daily check-in to stay on streak.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Raid live card */}
          <Card className="overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-transparent to-accent/10">
            <CardContent className="p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                    <Zap className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold">Raid is Live</h2>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {state.joined
                        ? "You joined this raid. Open the collection and engage to earn your share."
                        : "Join the raid and engage with the collection before the timer ends."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {countdown && (
                    <div className="text-center">
                      <div className="text-3xl font-bold tabular-nums text-primary">{countdown.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{countdown.label}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                {state.joined ? (
                  state.raid_link ? (
                    <Button variant="gradient" asChild>
                      <a href={state.raid_link} target="_blank" rel="noreferrer">
                        Open Raid Link
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </a>
                    </Button>
                  ) : (
                    <Button variant="gradient" disabled>
                      Raid link coming soon
                    </Button>
                  )
                ) : (
                  <Button
                    variant="gradient"
                    onClick={handleJoin}
                    disabled={joining || countdown?.notStarted || countdown?.ended}
                  >
                    {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Join Raid</>}
                  </Button>
                )}
                {!state.joined && state.raid_link && (
                  <Button variant="outline" asChild>
                    <a href={state.raid_link} target="_blank" rel="noreferrer">
                      Preview Raid Link
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit today's post */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-1">Submit today's post</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add the link to the post you want featured in today's raid. One post per day.
              </p>

              {todayPost ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-muted/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {todayPost.status === "added" ? (
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                    ) : (
                      <Eye className="w-5 h-5 text-primary shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{todayPost.post_url}</div>
                      <div className="text-xs text-muted-foreground">Submitted today</div>
                    </div>
                  </div>
                  {statusCfg && (
                    <Badge variant={statusCfg.color} className="shrink-0">
                      {statusCfg.label}
                    </Badge>
                  )}
                </motion.div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="postUrl">TikTok post link</Label>
                    <Input
                      id="postUrl"
                      placeholder="https://www.tiktok.com/@user/video/..."
                      value={postUrl}
                      onChange={(e) => setPostUrl(e.target.value)}
                    />
                  </div>
                  <Button variant="gradient" onClick={handleSubmitPost} disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <><Send className="w-4 h-4 mr-2" /> Submit Post</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Your post will appear in the admin raid section for review.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* How it works */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">How the Raid works</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Submit your post", desc: "Paste a TikTok link you want featured in today's raid." },
              { step: "2", title: "Raiders engage", desc: "Everyone who joined opens the collection and engages with it." },
              { step: "3", title: "Earn your share", desc: "Participating in raids earns you points plus daily check-in streaks." },
            ].map((s) => (
              <div key={s.step} className="p-4 rounded-xl border border-border bg-muted/30">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm mb-2">
                  {s.step}
                </div>
                <div className="font-medium text-sm">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}