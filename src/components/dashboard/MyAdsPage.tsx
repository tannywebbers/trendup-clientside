import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  CheckCircle2,
  Clock,
  Loader2,
  ExternalLink,
  Pause,
  Play,
  BarChart3,
  TrendingUp,
  Users,
  Coins,
  Trash2,
  Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Ad {
  id: string;
  tiktok_post_url: string;
  task_type: string;
  points_per_task: number;
  required_completions: number;
  completed_count: number;
  is_active: boolean;
  created_at: string;
}

interface AdStats {
  pending: number;
  approved: number;
  rejected: number;
  totalSpent: number;
  boosted: boolean;
}

const taskTypeLabels: Record<string, string> = {
  like: "Like",
  comment: "Comment",
  save: "Save",
  follow: "Follow",
  combo_mini: "Combo Mini",
  combo_large: "Normal",
};

interface BoostPlan {
  days: number;
  price: number;
}

export function MyAdsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [ads, setAds] = useState<Ad[]>([]);
  const [adStats, setAdStats] = useState<Record<string, AdStats>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<string | null>(null);
  const [deleteAd, setDeleteAd] = useState<Ad | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [boostAd, setBoostAd] = useState<Ad | null>(null);
  const [boostPlan, setBoostPlan] = useState<number>(1);
  const [boostPrices, setBoostPrices] = useState<BoostPlan[]>([]);
  const [boosting, setBoosting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAds();
    }
  }, [user]);

  const fetchBoostPrices = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "boost_pricing")
      .maybeSingle();
    if (data?.value) {
      setBoostPrices([
        { days: 1, price: data.value["1_day"] || 150 },
        { days: 3, price: data.value["3_day"] || 400 },
        { days: 7, price: data.value["7_day"] || 800 },
      ]);
    } else {
      setBoostPrices([
        { days: 1, price: 150 },
        { days: 3, price: 400 },
        { days: 7, price: 800 },
      ]);
    }
  };

  const fetchAds = async () => {
    try {
      setLoading(true);

      // Fetch user's ads
      const { data: adsData, error: adsError } = await supabase
        .from("ads")
        .select("*")
        .eq("creator_id", user?.id)
        .order("created_at", { ascending: false });

      if (adsError) throw adsError;
      setAds(adsData || []);

      // Fetch stats for each ad
      const statsMap: Record<string, AdStats> = {};
      const { data: boosts } = await (supabase as any)
        .from("post_boosts")
        .select("ad_id")
        .eq("creator_id", user?.id)
        .eq("status", "active");
      const boostedAdIds = new Set(boosts?.map((b: any) => b.ad_id) || []);

      for (const ad of adsData || []) {
        const { data: submissions } = await supabase
          .from("task_submissions")
          .select("status, points_awarded")
          .eq("ad_id", ad.id);

        const pending = submissions?.filter(s => s.status === "pending" || s.status === "needs_review").length || 0;
        const approved = submissions?.filter(s => s.status === "approved").length || 0;
        const rejected = submissions?.filter(s => s.status === "rejected").length || 0;
        const totalSpent = submissions?.reduce((sum, s) => sum + (s.points_awarded || 0), 0) || 0;

        statsMap[ad.id] = { pending, approved, rejected, totalSpent, boosted: boostedAdIds.has(ad.id) };
      }
      setAdStats(statsMap);
      await fetchBoostPrices();
    } catch (error) {
      console.error("Error fetching ads:", error);
      toast({
        title: "Error",
        description: "Failed to load your ads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleAdStatus = async (ad: Ad) => {
    try {
      const { error } = await supabase
        .from("ads")
        .update({ is_active: !ad.is_active })
        .eq("id", ad.id);

      if (error) throw error;

      setAds(prev =>
        prev.map(a => (a.id === ad.id ? { ...a, is_active: !a.is_active } : a))
      );

      toast({
        title: "Updated",
        description: `Ad ${!ad.is_active ? "activated" : "paused"} successfully`,
      });
    } catch (error) {
      console.error("Error toggling ad:", error);
      toast({
        title: "Error",
        description: "Failed to update ad status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAd = async () => {
    if (!deleteAd || !user) return;
    
    setIsDeleting(true);
    try {
      const stats = adStats[deleteAd.id] || { totalSpent: 0 };
      const totalBudget = deleteAd.required_completions * deleteAd.points_per_task;
      const refundAmount = totalBudget - stats.totalSpent;
      
      // Delete the ad
      const { error: deleteError } = await supabase
        .from("ads")
        .delete()
        .eq("id", deleteAd.id);
        
      if (deleteError) throw deleteError;
      
      // Refund remaining balance to user
      if (refundAmount > 0) {
        // Update user's points
        const { error: updateError } = await supabase.rpc("credit_purchase_points", {
          _user_id: user.id,
          _points: refundAmount,
          _amount_paid: 0,
          _reference: `refund_ad_${deleteAd.id}`
        });
        
        // If RPC fails (due to duplicate reference), try direct update
        if (updateError) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("tik_points")
            .eq("user_id", user.id)
            .single();
            
          if (profile) {
            await supabase
              .from("profiles")
              .update({ tik_points: profile.tik_points + refundAmount })
              .eq("user_id", user.id);
          }
        }
        
        // Refresh profile to update points display
        await refreshProfile();
        
        toast({
          title: "Ad Deleted",
          description: `${refundAmount} Streak Points have been refunded to your account.`,
        });
      } else {
        toast({
          title: "Ad Deleted",
          description: "Your ad has been deleted successfully.",
        });
      }
      
      setAds(prev => prev.filter(a => a.id !== deleteAd.id));
      setDeleteAd(null);
    } catch (error) {
      console.error("Error deleting ad:", error);
      toast({
        title: "Error",
        description: "Failed to delete ad",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openBoost = (ad: Ad) => {
    setBoostPlan(1);
    setBoostAd(ad);
  };

  const handleBoost = async () => {
    if (!boostAd || !user) return;
    const plan = boostPrices.find((p) => p.days === boostPlan);
    if (!plan) return;
    const balance = profile?.tik_points || 0;
    if (balance < plan.price) {
      toast({
        variant: "destructive",
        title: "Insufficient Balance",
        description: `This boost costs ${plan.price} Streak Points. Top up on the Wallet page.`,
      });
      return;
    }

    setBoosting(true);
    try {
      const expiresAt = new Date(Date.now() + plan.days * 86400000).toISOString();
      const { error: boostError } = await (supabase as any).from("post_boosts").insert({
        ad_id: boostAd.id,
        creator_id: user.id,
        plan_days: plan.days,
        multiplier: 3,
        price: plan.price,
        status: "active",
        expires_at: expiresAt,
      });
      if (boostError) throw boostError;

      const { error: spendError } = await supabase
        .from("profiles")
        .update({ tik_points: balance - plan.price })
        .eq("user_id", user.id);
      if (spendError) throw spendError;

      await supabase.from("transactions").insert({
        user_id: user.id,
        amount: -plan.price,
        type: "spend",
        description: `${plan.days}-day boost on a post`,
      });

      await refreshProfile();
      await fetchAds();
      toast({
        title: "Post Boosted!",
        description: `Your post is boosted at 3x the normal rate for ${plan.days} day${plan.days > 1 ? "s" : ""}.`,
      });
      setBoostAd(null);
    } catch (error) {
      console.error("Error boosting post:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not boost this post." });
    } finally {
      setBoosting(false);
    }
  };

  const getAdStatus = (ad: Ad) => {
    if (ad.completed_count >= ad.required_completions) return "completed";
    return ad.is_active ? "active" : "paused";
  };

  const calculateRefund = (ad: Ad) => {
    const stats = adStats[ad.id] || { totalSpent: 0 };
    const totalBudget = ad.required_completions * ad.points_per_task;
    return totalBudget - stats.totalSpent;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Posts</h1>
        <p className="text-muted-foreground">Manage your added posts and boost them for authentic engagement</p>
      </div>

      {ads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Posts Added Yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first post to start getting authentic engagement on your TikTok content.
            </p>
            <Button variant="gradient" onClick={() => window.location.href = "/dashboard/create-ad"}>
              Add Your First Post
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {ads.map((ad, index) => {
            const stats = adStats[ad.id] || { pending: 0, approved: 0, rejected: 0, totalSpent: 0 };
            const status = getAdStatus(ad);
            const progress = (ad.completed_count / ad.required_completions) * 100;
            const remaining = ad.required_completions - ad.completed_count;
            const refundAmount = calculateRefund(ad);

            return (
              <motion.div
                key={ad.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Ad Info */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant={
                            status === "completed" ? "success" :
                            status === "active" ? "default" : "secondary"
                          }>
                            {status === "completed" ? "Completed" :
                             status === "active" ? "Active" : "Paused"}
                          </Badge>
                          <Badge variant="outline">
                            {taskTypeLabels[ad.task_type] || ad.task_type}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Zap className="w-3 h-3" />
                            {ad.points_per_task} pts/task
                          </Badge>
                          {adStats[ad.id]?.boosted ? (
                            <Badge variant="success" className="gap-1">
                              <Zap className="w-3 h-3" /> Boosted 3x
                            </Badge>
                          ) : null}
                        </div>

                        <a
                          href={ad.tiktok_post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline truncate"
                        >
                          <ExternalLink className="w-4 h-4 shrink-0" />
                          <span className="truncate">{ad.tiktok_post_url}</span>
                        </a>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">
                              {ad.completed_count} / {ad.required_completions}
                            </span>
                          </div>
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {remaining > 0 ? `${remaining} more to go` : "Target reached!"}
                          </p>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 lg:w-48">
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <div className="flex items-center justify-center gap-1 text-warning mb-1">
                            <Clock className="w-4 h-4" />
                          </div>
                          <p className="text-lg font-bold">{stats.pending}</p>
                          <p className="text-xs text-muted-foreground">Pending</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <div className="flex items-center justify-center gap-1 text-success mb-1">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <p className="text-lg font-bold">{stats.approved}</p>
                          <p className="text-xs text-muted-foreground">Approved</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <div className="flex items-center justify-center gap-1 text-destructive mb-1">
                            <Users className="w-4 h-4" />
                          </div>
                          <p className="text-lg font-bold">{stats.rejected}</p>
                          <p className="text-xs text-muted-foreground">Rejected</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <div className="flex items-center justify-center gap-1 text-primary mb-1">
                            <Coins className="w-4 h-4" />
                          </div>
                          <p className="text-lg font-bold">{stats.totalSpent}</p>
                          <p className="text-xs text-muted-foreground">Spent</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex lg:flex-col gap-2">
                        <Button
                          variant="gradient"
                          size="sm"
                          onClick={() => openBoost(ad)}
                          disabled={status === "completed"}
                        >
                          <Zap className="w-4 h-4 mr-1" />
                          Boost
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAdStatus(ad)}
                          disabled={status === "completed"}
                        >
                          {ad.is_active ? (
                            <>
                              <Pause className="w-4 h-4 mr-1" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-1" />
                              Activate
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAd(selectedAd === ad.id ? null : ad.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteAd(ad)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedAd === ad.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="mt-4 pt-4 border-t border-border"
                      >
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Created</p>
                            <p className="font-medium">{format(new Date(ad.created_at), "MMM d, yyyy")}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Task Type</p>
                            <p className="font-medium">{taskTypeLabels[ad.task_type]}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Points Per Task</p>
                            <p className="font-medium">{ad.points_per_task} Streak Points</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Refund if Deleted</p>
                            <p className="font-medium text-primary">{refundAmount} Streak Points</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Boost Dialog */}
      <Dialog open={!!boostAd} onOpenChange={(open) => !open && setBoostAd(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Boost this post
            </DialogTitle>
            <DialogDescription>
              Boom your post at 3x the normal rate to users who haven't engaged yet. Choose a plan.
            </DialogDescription>
          </DialogHeader>

          {boostAd && (
            <div className="space-y-4">
              <a
                href={boostAd.tiktok_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border text-sm text-primary hover:underline truncate"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span className="truncate">{boostAd.tiktok_post_url}</span>
              </a>

              <div className="grid grid-cols-3 gap-2">
                {boostPrices.map((plan) => (
                  <button
                    key={plan.days}
                    onClick={() => setBoostPlan(plan.days)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      boostPlan === plan.days
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="font-semibold">{plan.days} day{plan.days > 1 ? "s" : ""}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {plan.price.toLocaleString()} SP
                    </div>
                    {plan.days === 3 && <div className="text-[10px] text-accent font-medium mt-1">Popular</div>}
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                Boosted posts surface higher in Browse Contents and pay out at 3x the standard rate to
                members who engage.
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Balance: <span className="font-medium text-foreground">{(profile?.tik_points || 0).toLocaleString()} SP</span>
                </span>
                <Button variant="gradient" onClick={handleBoost} disabled={boosting}>
                  {boosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-2" /> Boost Now</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAd} onOpenChange={(open) => !open && setDeleteAd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Ad?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAd && (
                <>
                  This will permanently delete this ad and all associated submissions.
                  {calculateRefund(deleteAd) > 0 && (
                    <span className="block mt-2 text-primary font-medium">
                      You will be refunded {calculateRefund(deleteAd)} Streak Points for unused completions.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAd}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete Ad
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
