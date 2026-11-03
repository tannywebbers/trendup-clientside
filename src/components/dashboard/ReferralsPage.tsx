import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Gift, 
  Copy, 
  Check, 
  Users, 
  Coins, 
  TrendingUp,
  Link2,
  Share2,
  UserPlus,
  Calendar,
  DollarSign
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReferredUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  tiktok_username: string;
  created_at: string;
}

interface Commission {
  id: string;
  commission_points: number;
  purchase_amount: number;
  commission_percentage: number;
  created_at: string;
  referred_user?: {
    first_name: string | null;
    last_name: string | null;
    tiktok_username: string;
  };
}

export function ReferralsPage() {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState({
    count: 0,
    earned: 0,
    pending: 0,
  });
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commissionPercentage, setCommissionPercentage] = useState(0);

  const { user, profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchReferralData();
      fetchCommissionSettings();
    }
  }, [user]);

  const fetchCommissionSettings = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "bonus_settings")
      .single();
    
    if (data?.value) {
      const settings = data.value as { referral_commission_percentage?: number };
      setCommissionPercentage(settings.referral_commission_percentage || 0);
    }
  };

  const fetchReferralData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Get user's profile with referral code
      const { data: profileData } = await supabase
        .from("profiles")
        .select("referral_code, id")
        .eq("user_id", user.id)
        .single();

      if (!profileData?.referral_code) {
        setIsLoading(false);
        return;
      }

      setReferralCode(profileData.referral_code);

      // Get referred users
      const { data: referrals } = await supabase
        .from("referrals")
        .select(`
          id,
          referred_id,
          created_at
        `)
        .eq("referrer_id", profileData.id)
        .order("created_at", { ascending: false });

      if (referrals && referrals.length > 0) {
        // Fetch referred user profiles
        const referredIds = referrals.map(r => r.referred_id);
        const { data: referredProfiles } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name, tiktok_username, created_at")
          .in("id", referredIds);

        if (referredProfiles) {
          setReferredUsers(referredProfiles);
        }
      }

      // Get commissions
      const { data: commissionsData } = await supabase
        .from("referral_commissions")
        .select(`
          id,
          commission_points,
          purchase_amount,
          commission_percentage,
          created_at,
          referred_id
        `)
        .eq("referrer_id", profileData.id)
        .order("created_at", { ascending: false });

      if (commissionsData && commissionsData.length > 0) {
        // Fetch referred user info for commissions
        const referredIds = commissionsData.map(c => c.referred_id);
        const { data: referredProfiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, tiktok_username")
          .in("id", referredIds);

        const commissionsWithUsers = commissionsData.map(c => ({
          ...c,
          referred_user: referredProfiles?.find(p => p.id === c.referred_id),
        }));

        setCommissions(commissionsWithUsers);
      }

      // Calculate stats
      const totalEarned = commissionsData?.reduce((sum, c) => sum + (c.commission_points || 0), 0) || 0;

      setReferralStats({
        count: referrals?.length || 0,
        earned: totalEarned,
        pending: 0, // Could be calculated if you track pending commissions
      });
    } catch (error) {
      console.error("Error fetching referral data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load referral data.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getReferralLink = () => {
    if (!referralCode) return "";
    return `${window.location.origin}/register?ref=${referralCode}`;
  };

  const copyReferralLink = () => {
    const link = getReferralLink();
    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Copied!", description: "Referral link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyReferralCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      toast({ title: "Copied!", description: "Referral code copied to clipboard." });
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const shareReferralLink = async () => {
    const link = getReferralLink();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join TrendUp!",
          text: "Sign up using my referral link and start earning Streak Points!",
          url: link,
        });
      } catch (error) {
        // User cancelled share
      }
    } else {
      copyReferralLink();
    }
  };

  const maskEmail = (email: string) => {
    const [name, domain] = email.split("@");
    if (name.length <= 2) return email;
    return `${name.charAt(0)}${"*".repeat(Math.min(name.length - 2, 5))}${name.charAt(name.length - 1)}@${domain}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Gift className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Referral Program</h1>
            <p className="text-muted-foreground">
              Invite friends and earn {commissionPercentage}% commission from their purchases!
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <Card variant="elevated">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
                <p className="text-2xl font-bold">{referralStats.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Coins className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Points Earned</p>
                <p className="text-2xl font-bold">{referralStats.earned}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Commission Rate</p>
                <p className="text-2xl font-bold">{commissionPercentage}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Referral Link Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Your Referral Link
            </CardTitle>
            <CardDescription>
              Share this link with friends. When they sign up and purchase points, you earn {commissionPercentage}% commission!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Referral Link</label>
              <div className="flex gap-2">
                <Input
                  value={getReferralLink()}
                  readOnly
                  className="bg-background font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={copyReferralLink}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={shareReferralLink}>
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Referral Code</label>
              <div className="flex gap-2">
                <Input
                  value={referralCode || ""}
                  readOnly
                  className="bg-background font-mono text-lg tracking-widest max-w-[200px]"
                />
                <Button variant="outline" size="icon" onClick={copyReferralCode}>
                  {copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Friends can also enter this code manually during registration.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Referred Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Referred Users
            </CardTitle>
            <CardDescription>
              Users who signed up using your referral link
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referredUsers.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>TikTok</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-primary-foreground">
                              {user.first_name?.charAt(0) || user.tiktok_username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">
                                {user.first_name && user.last_name
                                  ? `${user.first_name} ${user.last_name}`
                                  : maskEmail(user.email)}
                              </p>
                              <p className="text-xs text-muted-foreground">{maskEmail(user.email)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">@{user.tiktok_username}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(user.created_at), "MMM d, yyyy")}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No referrals yet</p>
                <p className="text-sm mt-1">Share your referral link to start earning!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Commission History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Commission History
            </CardTitle>
            <CardDescription>
              Points earned from referred users' purchases
            </CardDescription>
          </CardHeader>
          <CardContent>
            {commissions.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Purchase</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Points Earned</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-primary-foreground">
                              {commission.referred_user?.first_name?.charAt(0) || 
                               commission.referred_user?.tiktok_username?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <span className="text-sm">
                              {commission.referred_user?.first_name || 
                               `@${commission.referred_user?.tiktok_username}` || "User"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{commission.purchase_amount} pts</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {commission.commission_percentage}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="success" className="flex items-center gap-1 w-fit">
                            <Coins className="w-3 h-3" />
                            +{commission.commission_points}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(commission.created_at), "MMM d, yyyy")}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No commissions yet</p>
                <p className="text-sm mt-1">You'll earn commission when your referrals purchase points!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* How It Works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Share2 className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-1">1. Share Your Link</h4>
                <p className="text-sm text-muted-foreground">
                  Share your unique referral link with friends and family
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <UserPlus className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-1">2. Friends Sign Up</h4>
                <p className="text-sm text-muted-foreground">
                  They create an account using your referral link
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Coins className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-semibold mb-1">3. Earn Commission</h4>
                <p className="text-sm text-muted-foreground">
                  Get {commissionPercentage}% of their points purchases as commission
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
