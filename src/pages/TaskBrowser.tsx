import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, MessageCircle, ExternalLink, Copy, Check, Loader2, Coins,
  CheckCircle2, SkipForward, ShieldAlert, Users, Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { NativeAdCard } from "@/components/ads/NativeAdCard";

interface Ad {
  id: string;
  creator_id: string;
  tiktok_post_url: string;
  task_type: string;
  required_completions: number;
  completed_count: number;
  points_per_task: number;
  video_description: string | null;
  created_at: string;
}

interface CreatorProfile {
  user_id: string;
  tiktok_username: string;
  first_name: string | null;
  avatar_url: string | null;
}

const ENGAGE_STEPS = [
  "Open the post link in TikTok",
  "Hold the like button for 3 seconds",
  "Paste the copied comment",
  "Share the post to the chat room",
  "Come back and click Verify",
];

export default function TaskBrowser() {
  const [contents, setContents] = useState<Ad[]>([]);
  const [creators, setCreators] = useState<Record<string, CreatorProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Ad | null>(null);
  const [generatedComment, setGeneratedComment] = useState<string | null>(null);
  const [isGeneratingComment, setIsGeneratingComment] = useState(false);
  const [commentCopied, setCommentCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const fetchCreators = useCallback(async (ads: Ad[]) => {
    const ids = Array.from(new Set(ads.map((a) => a.creator_id)));
    if (ids.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, tiktok_username, first_name, avatar_url")
      .in("user_id", ids);
    if (data) {
      const map: Record<string, CreatorProfile> = {};
      data.forEach((p: any) => { map[p.user_id] = p; });
      setCreators(map);
    }
  }, []);

  const fetchContents = useCallback(async () => {
    setIsLoading(true);
    try {
      const [submissionsRes, adsRes, boostsRes] = await Promise.all([
        supabase
          .from("task_submissions")
          .select("ad_id")
          .eq("user_id", user?.id),
        supabase
          .from("ads")
          .select("*")
          .eq("is_active", true),
        (supabase as any)
          .from("post_boosts")
          .select("ad_id")
          .eq("status", "active"),
      ]);

      const submittedAds = new Set(submissionsRes.data?.map((s: any) => s.ad_id) || []);
      const boostedAds = new Set(boostsRes.data?.map((b: any) => b.ad_id) || []);

      let ads = (adsRes.data || []).filter(
        (a: any) =>
          a.creator_id !== user?.id &&
          a.completed_count < a.required_completions &&
          !submittedAds.has(a.id)
      );

      // Random order, weighted so higher-point contents surface first
      ads = ads
        .map((a: any) => ({ ...a, _w: Math.random() * (boostedAds.has(a.id) ? a.points_per_task * 3 : a.points_per_task) }))
        .sort((a: any, b: any) => b._w - a._w);

      setContents(ads as Ad[]);
      await fetchCreators(ads as Ad[]);
    } catch (error) {
      console.error("Error fetching contents:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load contents." });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (user) fetchContents();
  }, [user, fetchContents]);

  const resetDialog = () => {
    setGeneratedComment(null);
    setCommentCopied(false);
    setVerified(false);
  };

  const handleClose = () => {
    setSelected(null);
    resetDialog();
  };

  const handleSkip = () => {
    if (!selected) return;
    setContents((prev) => [...prev.filter((c) => c.id !== selected.id), selected]);
    handleClose();
  };

  const generateComment = async () => {
    if (!selected || !user) return;
    setIsGeneratingComment(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-screenshot", {
        body: { action: "generate_comment", adId: selected.id, userId: user.id },
      });
      if (error) throw error;
      if (data?.comment) {
        setGeneratedComment(data.comment);
        toast({ title: "Comment generated", description: "Copy it and paste on the post." });
      }
    } catch (error) {
      console.error("Error generating comment:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate a comment." });
    } finally {
      setIsGeneratingComment(false);
    }
  };

  const copyComment = async () => {
    if (!generatedComment) return;
    await navigator.clipboard.writeText(generatedComment);
    setCommentCopied(true);
    toast({ title: "Copied!", description: "Now paste it on the TikTok post." });
    setTimeout(() => setCommentCopied(false), 3000);
  };

  const handleVerify = async () => {
    if (!selected || !user) return;
    setVerifying(true);
    try {
      const { error } = await supabase.from("task_submissions").insert({
        user_id: user.id,
        ad_id: selected.id,
        status: "pending",
        screenshot_urls: [],
      });
      if (error) throw error;
      setVerified(true);
      await refreshProfile();
      toast({ title: "Submission received!", description: "Verification is pending. Points arrive once approved." });
      // Remove this content from the queue
      setContents((prev) => prev.filter((c) => c.id !== selected.id));
    } catch (error) {
      console.error("Verify error:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not submit verification." });
    } finally {
      setVerifying(false);
    }
  };

  const openPost = () => {
    if (selected) window.open(selected.tiktok_post_url, "_blank");
  };

  const creator = selected ? creators[selected.creator_id] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Browse Contents</h1>
          <p className="text-muted-foreground">
            Engage with real contents and earn streak points. {contents.length} available right now.
          </p>
        </div>
        <Badge variant="gradient" className="gap-1 self-start sm:self-auto p-2">
          <Coins className="w-4 h-4" /> Earn up to {contents.reduce((max, c) => Math.max(max, c.points_per_task), 0)} SP per content
        </Badge>
      </div>

      {/* Instructions strip */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">How to engage</span>
        </div>
        <div className="grid sm:grid-cols-5 gap-3">
          {ENGAGE_STEPS.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold shrink-0">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : contents.length === 0 ? (
        <Card variant="glass" className="py-12">
          <CardContent className="text-center">
            <Layers className="w-10 h-10 mx-auto mb-3 opacity-40 text-muted-foreground" />
            <p className="text-muted-foreground">No contents available at the moment.</p>
            <p className="text-sm text-muted-foreground mt-2">Check back later for new engagement opportunities!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {contents.map((ad, index) => {
              const c = creators[ad.creator_id];
              const isBoosted = false;
              return (
                <>
                  <motion.div
                    key={ad.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <Card variant="interactive" className="h-full overflow-hidden">
                      {/* Creator header */}
                      <div className="flex items-center gap-3 p-4 pb-0">
                        {c?.avatar_url && /\p{Emoji}/u.test(c.avatar_url) ? (
                          <span className="text-2xl">{c.avatar_url}</span>
                        ) : c?.avatar_url ? (
                          <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {c?.first_name || c?.tiktok_username || "TrendUp creator"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">@{c?.tiktok_username || "creator"}</div>
                        </div>
                        <Badge variant="gradient" className="gap-1 shrink-0">
                          <Coins className="w-3 h-3" />+{ad.points_per_task}
                        </Badge>
                      </div>

                      {/* Post preview */}
                      <div className="p-4">
                        <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-muted to-muted/50 border border-border aspect-video flex items-center justify-center">
                          <div className="absolute inset-0 flex items-center justify-center bg-black/5" />
                          <Play className="w-10 h-10 text-muted-foreground/60 relative z-10" />
                          <div className="absolute top-2 right-2 z-10">
                            {isBoosted ? (
                              <Badge variant="success" className="text-[10px]">Boosted</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {ad.task_type.replace("_", " ")}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2 min-h-[2.5rem]">
                          {ad.video_description || "Tap Engage to see the post and start earning."}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-muted-foreground">
                            {ad.required_completions - ad.completed_count} spots left
                          </span>
                          <Button variant="gradient" size="sm" onClick={() => setSelected(ad)}>
                            Engage
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>

                  {/* Native ad after every 4th card */}
                  {(index + 1) % 4 === 0 && index < contents.length - 1 && (
                    <motion.div key={`native-${index}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <NativeAdCard className="h-full min-h-[200px]" />
                    </motion.div>
                  )}
                </>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Engage dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {creator && (
                <>
                  {creator.avatar_url && /\p{Emoji}/u.test(creator.avatar_url) && (
                    <span className="text-xl">{creator.avatar_url}</span>
                  )}
                </>
              )}
              Engage with this content
            </DialogTitle>
            <DialogDescription>
              Follow these steps to earn {selected?.points_per_task} Streak Points.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-5">
              {verified ? (
                <div className="p-6 text-center space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                  <p className="font-medium">Submission received!</p>
                  <p className="text-sm text-muted-foreground">
                    Your points will be credited once verification is approved.
                  </p>
                </div>
              ) : (
                <>
                  {/* Creator + post */}
                  {creator && (
                    <div className="p-4 rounded-xl border border-border bg-muted/30 flex items-center gap-3">
                      {creator.avatar_url && /\p{Emoji}/u.test(creator.avatar_url) ? (
                        <span className="text-2xl">{creator.avatar_url}</span>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">@{creator.tiktok_username}</div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {selected.video_description || "TikTok post"}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
                      Open the post link
                    </h4>
                    <Button variant="outline" className="w-full" onClick={openPost}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open on TikTok
                    </Button>
                  </div>

                  <div className="space-y-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <h4 className="font-medium flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <MessageCircle className="w-4 h-4" />
                      Step 2 — Copy your comment
                    </h4>
                    {!generatedComment ? (
                      <Button onClick={generateComment} disabled={isGeneratingComment} className="w-full">
                        {isGeneratingComment ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
                        ) : (
                          <><MessageCircle className="w-4 h-4 mr-2" /> Generate AI Comment</>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-3 bg-background rounded-lg border text-sm">"{generatedComment}"</div>
                        <Button onClick={copyComment} variant="outline" className="w-full gap-2">
                          {commentCopied ? (
                            <><Check className="w-4 h-4 text-green-500" /> Copied!</>
                          ) : (
                            <><Copy className="w-4 h-4" /> Copy Comment</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">3</span>
                      Complete the engagement
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                      <li>Hold the like button for 3 seconds.</li>
                      <li>Paste the copied comment on the post.</li>
                      <li>Share the post to the chat room with your friends.</li>
                    </ul>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1" onClick={handleSkip}>
                      <SkipForward className="w-4 h-4 mr-2" />
                      Skip
                    </Button>
                    <Button variant="gradient" className="flex-1" onClick={handleVerify} disabled={verifying}>
                      {verifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><Check className="w-4 h-4 mr-2" /> I've done it — Verify</>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Verification happens via API. You'll be credited once your submission is approved.
                  </p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}