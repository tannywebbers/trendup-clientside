import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Link2, Coins, AlertCircle, CheckCircle, Loader2, User, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

function extractTikTokUsername(url: string): string | null {
  try {
    const match = url.match(/@([a-zA-Z0-9_.]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function CreateAdPage() {
  const [completions, setCompletions] = useState(100);
  const [pointsPerEngagement, setPointsPerEngagement] = useState(50);
  const [postLink, setPostLink] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [commentKeywords, setCommentKeywords] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const extractedUsername = useMemo(() => extractTikTokUsername(postLink), [postLink]);

  const usernameMatchesProfile = useMemo(() => {
    if (!extractedUsername || !profile?.tiktok_username) return null;
    return extractedUsername.toLowerCase() === profile.tiktok_username.toLowerCase();
  }, [extractedUsername, profile?.tiktok_username]);

  const totalCost = completions * pointsPerEngagement;
  const userBalance = profile?.tik_points || 0;
  const canAfford = userBalance >= totalCost;
  const linkVerified = extractedUsername != null && usernameMatchesProfile === true;

  const handleCreatePost = async () => {
    setIsSubmitting(true);
    try {
      const { error: adError } = await supabase
        .from("ads")
        .insert({
          creator_id: user?.id,
          tiktok_post_url: postLink,
          task_type: "combo_large" as any,
          required_completions: completions,
          points_per_task: pointsPerEngagement,
          video_description: videoDescription || null,
          comment_keywords: commentKeywords
            ? commentKeywords.split(",").map((k) => k.trim()).filter(Boolean)
            : null,
        });
      if (adError) throw adError;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ tik_points: userBalance - totalCost })
        .eq("user_id", user?.id);
      if (updateError) throw updateError;

      await supabase.from("transactions").insert({
        user_id: user?.id,
        amount: -totalCost,
        type: "spend",
        description: "Added post for content boost",
      });

      toast({ title: "Success!", description: "Your post has been added for authentic engagement." });
      navigate("/dashboard/my-ads");
    } catch (error) {
      console.error("Error creating post:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add post. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openConfirmation = () => {
    if (!postLink.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please enter your TikTok post link." });
      return;
    }
    if (!postLink.includes("tiktok.com")) {
      toast({ variant: "destructive", title: "Invalid URL", description: "Please enter a valid TikTok link." });
      return;
    }
    if (!extractedUsername) {
      toast({ variant: "destructive", title: "Error", description: "Could not find a TikTok username in the URL." });
      return;
    }
    if (!usernameMatchesProfile) {
      toast({
        variant: "destructive",
        title: "Username Mismatch",
        description: `The link is for @${extractedUsername} but your profile is @${profile?.tiktok_username}. Please use your own TikTok post link.`,
      });
      return;
    }
    if (!canAfford) {
      toast({ variant: "destructive", title: "Insufficient Balance", description: "You don't have enough Streak Points." });
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Add Post</h1>
          <p className="text-muted-foreground">
            Boost your content with authentic engagement from real users.
          </p>
        </div>
      </motion.div>

      {/* Post details */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Your TikTok Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="postLink">Video Link *</Label>
              <Input
                id="postLink"
                placeholder="https://www.tiktok.com/@yourusername/video/..."
                value={postLink}
                onChange={(e) => setPostLink(e.target.value)}
              />
              {extractedUsername && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Detected: </span>
                  <span className={usernameMatchesProfile === false ? "text-destructive" : "text-success"}>
                    @{extractedUsername}
                  </span>
                  {linkVerified ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : usernameMatchesProfile === false ? (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  ) : null}
                </div>
              )}
              {usernameMatchesProfile === false && (
                <p className="text-xs text-destructive">
                  The link must be from your own TikTok profile (@{profile?.tiktok_username}).
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoDescription" className="flex items-center gap-2">
                Video Description
                <span className="text-xs text-muted-foreground">for AI comments</span>
              </Label>
              <Textarea
                id="videoDescription"
                placeholder="Describe exactly what happens in your video so AI can write relevant comments..."
                rows={3}
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
              />
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">
                  Be precise — describe exactly what your video shows. The better the description, the more
                  relevant the AI comments will be.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commentKeywords">Comment Keywords (Optional)</Label>
              <Input
                id="commentKeywords"
                placeholder="amazing, love this, fire, talent (comma separated)"
                value={commentKeywords}
                onChange={(e) => setCommentKeywords(e.target.value)}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Keywords to include in generated comments.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Engagement & Cost */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <CardHeader>
            <CardTitle>Engagement &amp; Budget</CardTitle>
            <CardDescription>
              Set how many engagements you want and how much you pay per engagement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="completions">Number of Engagements</Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Input
                  id="completions"
                  type="number"
                  value={completions}
                  onChange={(e) => setCompletions(Math.max(10, parseInt(e.target.value) || 10))}
                  min={10}
                  max={10000}
                  className="w-full sm:w-32"
                />
                <div className="flex-1">
                  <input
                    type="range"
                    min={10}
                    max={1000}
                    value={completions}
                    onChange={(e) => setCompletions(parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pointsPerEngagement">Points to Pay per Engagement</Label>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-primary shrink-0" />
                <Input
                  id="pointsPerEngagement"
                  type="number"
                  value={pointsPerEngagement}
                  onChange={(e) => setPointsPerEngagement(Math.max(10, parseInt(e.target.value) || 10))}
                  min={10}
                  className="w-full sm:w-40"
                />
                <span className="text-sm text-muted-foreground">SP each</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Suggest a fair price so users stay interested — higher payouts get seen faster.
              </p>
            </div>

            {/* Total cost summary */}
            <div className={`rounded-xl border-2 p-5 ${canAfford ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
              <h3 className="text-sm font-semibold mb-3">Total Cost</h3>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <Coins className="w-6 h-6 text-primary self-center" />
                    <span className="text-4xl font-bold gradient-text">{totalCost.toLocaleString()}</span>
                    <span className="text-muted-foreground">Streak Points</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <AlertCircle className="w-4 h-4" />
                    {completions} engagements × {pointsPerEngagement} points each
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <Button
                    variant="gradient"
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={openConfirmation}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Adding…</>
                    ) : (
                      <><CheckCircle className="w-5 h-5" /> Add Post</>
                    )}
                  </Button>
                  <p className={`text-xs text-center ${canAfford ? "text-muted-foreground" : "text-destructive"}`}>
                    Your balance: {userBalance.toLocaleString()} Streak Points
                    {!canAfford && " (Insufficient)"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Confirm your post
            </AlertDialogTitle>
            <AlertDialogDescription>
              Review the details below before we add your post.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Post</span>
              <span className="font-medium truncate max-w-[60%]">{postLink}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Engagements</span>
              <span className="font-medium">{completions.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Per engagement</span>
              <span className="font-medium">{pointsPerEngagement.toLocaleString()} SP</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
              <span className="text-muted-foreground">Total cost</span>
              <span className="font-bold text-primary">{totalCost.toLocaleString()} SP</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Your balance</span>
              <span className={`font-medium ${!canAfford ? "text-destructive" : ""}`}>{userBalance.toLocaleString()} SP</span>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreatePost}
              disabled={isSubmitting || !canAfford}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Confirm &amp; Add Post</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}