import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  User,
  AtSign,
  Mail,
  Globe,
  Save,
  AlertTriangle,
  Loader2,
  Gift,
  Copy,
  Check,
  Users,
  BadgeCheck,
  ShieldAlert,
  CalendarClock,
  Flame,
  Trophy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState({ count: 0, earned: 0 });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    country: "",
  });
  const [stats, setStats] = useState({
    tasksDone: 0,
    successRate: 0,
    adsCreated: 0,
    daysActive: 0,
  });
  const [verification, setVerification] = useState({
    engagedContents: 0,
    currentStreak: 0,
  });
  
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        email: profile.email || "",
        country: profile.country || "",
      });
    }
    fetchStats();
    fetchReferralData();
  }, [profile]);

  const fetchReferralData = async () => {
    if (!user) return;
    
    // Get user's referral code
    const { data: profileData } = await supabase
      .from("profiles")
      .select("referral_code, id")
      .eq("user_id", user.id)
      .single();
    
    if (profileData?.referral_code) {
      setReferralCode(profileData.referral_code);
      
      // Get referral count
      const { count } = await supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", profileData.id);
      
      // Get total commission earned
      const { data: commissions } = await supabase
        .from("referral_commissions")
        .select("commission_points")
        .eq("referrer_id", profileData.id);
      
      const totalEarned = commissions?.reduce((sum, c) => sum + (c.commission_points || 0), 0) || 0;
      
      setReferralStats({
        count: count || 0,
        earned: totalEarned,
      });
    }
  };

  const copyReferralLink = () => {
    if (referralCode) {
      const link = `${window.location.origin}/register?ref=${referralCode}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Copied!", description: "Referral link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const computeCheckinStreak = (dateKeys: string[]): number => {
    if (!dateKeys.length) return 0;
    const set = new Set(dateKeys);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    let cursor = new Date();
    const today = fmt(cursor);
    if (!set.has(today)) {
      cursor = new Date(cursor.getTime() - 86400000);
      if (!set.has(fmt(cursor))) return 0;
    }
    let streak = 0;
    while (set.has(fmt(cursor))) {
      streak++;
      cursor = new Date(cursor.getTime() - 86400000);
    }
    return streak;
  };

  const fetchStats = async () => {
    if (!user) return;
    try {
      // Fetch task submissions
      const { data: submissions } = await supabase
        .from("task_submissions")
        .select("status, ad_id")
        .eq("user_id", user.id);

      // Fetch ads created
      const { data: ads } = await supabase
        .from("ads")
        .select("id")
        .eq("creator_id", user.id);

      const total = submissions?.length || 0;
      const approved = submissions?.filter(s => s.status === "approved") || [];
      const engagedContents = new Set(approved.map((s) => s.ad_id).filter(Boolean)).size;
      
      // Calculate days active
      const createdAt = new Date(profile?.created_at || Date.now());
      const now = new Date();
      const daysActive = Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Current check-in streak
      let currentStreak = 0;
      try {
        const { data: checkinRes } = await (supabase.rpc as any)("get_my_checkin_status", {
          _user_id: user.id,
        });
        if (checkinRes && typeof checkinRes.current_streak === "number") {
          currentStreak = checkinRes.current_streak;
        }
      } catch {
        currentStreak = 0;
      }
      if (currentStreak === 0) {
        try {
          const { data: checkins } = await (supabase as any)
            .from("daily_checkins")
            .select("checkin_date")
            .eq("user_id", user.id)
            .order("checkin_date", { ascending: false });
          currentStreak = computeCheckinStreak((checkins || []).map((c: any) => c.checkin_date));
        } catch {
          currentStreak = 0;
        }
      }

      setStats({
        tasksDone: approved.length,
        successRate: total > 0 ? Math.round((approved.length / total) * 100) : 0,
        adsCreated: ads?.length || 0,
        daysActive: Math.max(1, daysActive),
      });
      setVerification({ engagedContents, currentStreak });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          country: formData.country,
        })
        .eq("user_id", user?.id);

      if (error) throw error;

      // If email changed, require confirmation before it applies
      if (user?.email && formData.email && formData.email.toLowerCase() !== user.email.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: formData.email });
        if (!emailError) {
          toast({
            title: "Confirm your email",
            description: `A confirmation link was sent to ${formData.email}. Your email updates once you confirm it.`,
          });
        }
      }

      await refreshProfile();
      setIsEditing(false);
      toast({ title: "Saved", description: "Your profile has been updated." });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save profile." });
    } finally {
      setIsSaving(false);
    }
  };

  const initials = `${formData.firstName?.charAt(0) || ""}${formData.lastName?.charAt(0) || ""}`.toUpperCase() || "U";

  const isVerified = verification.engagedContents > 200 && verification.currentStreak >= 7;
  const eligibleReady = verification.engagedContents >= 30;
  const engagementProgress = Math.min(100, Math.round((verification.engagedContents / 200) * 100));
  const streakProgress = Math.min(100, Math.round((verification.currentStreak / 7) * 100));

  const displayName = [formData.firstName, formData.lastName].filter(Boolean).join(" ").trim() || "TrendUp Member";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card variant="elevated">
          <CardContent className="p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold text-primary-foreground">
                  {initials}
                </div>
              </div>
              
              <div className="text-center sm:text-left flex-1 min-w-0">
                <h2 className="text-2xl font-bold flex items-center justify-center sm:justify-start gap-2">
                  <span className="truncate">{displayName}</span>
                  {isVerified && (
                    <BadgeCheck className="w-6 h-6 text-[#25F4EE] fill-[#25F4EE] shrink-0" />
                  )}
                </h2>
                <p className="text-muted-foreground">
                  <span>@{profile?.tiktok_username}</span>
                </p>
                <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                  {isVerified ? (
                    <Badge variant="success" className="gap-1">
                      <BadgeCheck className="w-3.5 h-3.5" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldAlert /> Pending Verification
                    </Badge>
                  )}
                  {stats.tasksDone >= 100 && <Badge variant="gradient">Pro Member</Badge>}
                </div>
              </div>

              <Button 
                variant={isEditing ? "default" : "outline"}
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : isEditing ? (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                ) : (
                  "Edit Profile"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* TikTok Identity Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AtSign className="w-5 h-5" />
              TikTok Identity
            </CardTitle>
            <CardDescription>
              Your TikTok identity is used for task verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Username - Locked permanently */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                TikTok Username
                <Badge variant="destructive" className="text-xs">Locked Forever</Badge>
              </Label>
              <Input 
                value={`@${profile?.tiktok_username}`} 
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Must exactly match your TikTok profile username for comment verification. Cannot be changed after registration.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Referral Program Card */}
      {referralCode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Gift className="w-5 h-5" />
                Referral Program
              </CardTitle>
              <CardDescription>
                Invite friends and earn commission from their purchases!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-xl bg-background/50 border border-border">
                  <div className="text-2xl font-bold text-primary">{referralStats.count}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Users className="w-3 h-3" />
                    Referrals
                  </div>
                </div>
                <div className="text-center p-4 rounded-xl bg-background/50 border border-border">
                  <div className="text-2xl font-bold text-primary">{referralStats.earned}</div>
                  <div className="text-xs text-muted-foreground">Points Earned</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Your Referral Code</Label>
                <div className="flex gap-2">
                  <Input 
                    value={referralCode} 
                    readOnly 
                    className="font-mono text-lg tracking-widest bg-muted"
                  />
                  <Button variant="outline" size="icon" onClick={copyReferralLink}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">
                  Share your referral link with friends. When they sign up and purchase points, 
                  you'll earn a percentage of their purchase as commission!
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Verification Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className={`${isVerified ? "border-emerald-500/40 bg-emerald-500/5" : "border-primary/30 bg-primary/5"}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isVerified ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`}>
              {isVerified ? <BadgeCheck className="w-5 h-5 fill-current" /> : <ShieldAlert className="w-5 h-5" />}
              {isVerified ? "Verified Account" : "Get Verified"}
            </CardTitle>
            <CardDescription>
              {isVerified
                ? "You're officially verified — enjoy the blue tick on your wall and leaderboard."
                : "Be active for 7 consecutive days and engage on 200+ contents to unlock your verified blue tick."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!isVerified ? (
              <>
                {!eligibleReady && (
                  <div className="p-3 rounded-lg bg-background/60 border border-border">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-primary shrink-0" />
                      <p className="text-sm text-foreground">
                        First, login and engage with up to{" "}
                        <b className="text-primary">30 posts</b> to begin your verification journey.
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-border mt-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, Math.round((verification.engagedContents / 30) * 100))}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {verification.engagedContents} / 30 contents engaged
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5" /> Contents engaged
                    </span>
                    <span className="font-semibold tabular-nums">
                      {Math.min(verification.engagedContents, 200)} / 200
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${engagementProgress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {verification.engagedContents >= 200 ? "Target reached!" : `${200 - verification.engagedContents} more contents to go.`}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" /> Consecutive active days
                    </span>
                    <span className="font-semibold tabular-nums">
                      {Math.min(verification.currentStreak, 7)} / 7
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all" style={{ width: `${streakProgress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {verification.currentStreak >= 7 ? "Target reached!" : `${7 - verification.currentStreak} more consecutive days to go.`}
                  </p>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border">
                  <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Your blue tick is awarded automatically as soon as both targets are met.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <BadgeCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Verified — blue tick active</p>
                  <p className="text-xs text-muted-foreground">
                    {verification.engagedContents} contents engaged · {verification.currentStreak} day streak
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Profile Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Your details are private and only shared when you engage your wall.
              </CardDescription>
            </div>
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEditing ? (
                <><Save className="w-4 h-4" /> Save</>
              ) : (
                "Edit"
              )}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  disabled={!isEditing}
                  className={!isEditing ? "bg-muted" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={!isEditing}
                  className={!isEditing ? "bg-muted" : ""}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
                className={!isEditing ? "bg-muted" : ""}
              />
              <p className="text-xs text-muted-foreground">
                A confirmation link is required before a new email is applied to your account.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Country
              </Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="Your country"
                disabled={!isEditing}
                className={!isEditing ? "bg-muted" : ""}
              />
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Member since{" "}
                <span className="text-foreground font-medium">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
                    : "today"}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Account Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="text-2xl font-bold gradient-text">{stats.tasksDone}</div>
                <div className="text-sm text-muted-foreground">Tasks Done</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="text-2xl font-bold gradient-text">{stats.successRate}%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="text-2xl font-bold gradient-text">{stats.adsCreated}</div>
                <div className="text-sm text-muted-foreground">Posts Added</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="text-2xl font-bold gradient-text">{stats.daysActive}</div>
                <div className="text-sm text-muted-foreground">Days Active</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}