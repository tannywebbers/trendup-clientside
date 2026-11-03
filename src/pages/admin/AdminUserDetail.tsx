import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Coins,
  Plus,
  Minus,
  Send,
  Ban,
  Trash2,
  Loader2,
  KeyRound,
  Shield,
  User,
  Calendar,
  Mail,
  CheckCircle,
  XCircle,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  tiktok_username: string;
  country: string | null;
  avatar_url: string | null;
  tik_points: number;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

interface NotificationLog {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

type NotificationType = "announcement" | "warning" | "info" | "admin_credit" | "admin_debit";

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Credit/Debit
  const [creditDebit, setCreditDebit] = useState<{ open: boolean; type: "credit" | "debit" }>({ open: false, type: "credit" });
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  // Notification
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyType, setNotifyType] = useState<NotificationType>("info");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");

  // Ban
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState("");

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Reset password
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const canManage = userRole === "admin";

  useEffect(() => {
    if (!userId) return;
    fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({ variant: "destructive", title: "Not found", description: "User does not exist." });
        navigate("/baki/stage/admin/users");
        return;
      }
      setProfile(data as Profile);

      const [txnData, notifData] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      ]);
      setTransactions((txnData.data as Transaction[]) || []);
      setNotifications((notifData.data as NotificationLog[]) || []);
    } catch (error) {
      console.error("Error fetching user:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load user." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreditDebit = async () => {
    if (!profile) return;
    if (!canManage) {
      toast({ variant: "destructive", title: "Unauthorized", description: "Only admins can credit/debit points." });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast({ variant: "destructive", title: "Invalid amount", description: "Enter a valid amount." });
      return;
    }

    setIsProcessing(true);
    try {
      const amountNum = parseFloat(amount);
      const isCredit = creditDebit.type === "credit";
      const newBalance = isCredit ? profile.tik_points + amountNum : Math.max(0, profile.tik_points - amountNum);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ tik_points: newBalance })
        .eq("user_id", profile.user_id);
      if (updateError) throw updateError;

      await supabase.from("transactions").insert({
        user_id: profile.user_id,
        type: isCredit ? "admin_credit" : "admin_debit",
        amount: isCredit ? amountNum : -amountNum,
        description: reason || `Admin ${isCredit ? "credit" : "debit"}: ${amountNum} points`,
      });

      await supabase.from("notifications").insert({
        user_id: profile.user_id,
        type: isCredit ? "admin_credit" : "admin_debit",
        title: isCredit ? "Points Credited" : "Points Debited",
        message: reason || `${amountNum} Streak Points have been ${isCredit ? "added to" : "removed from"} your account.`,
      });

      toast({ title: "Success", description: `${isCredit ? "Credited" : "Debited"} ${amountNum} points.` });
      setCreditDebit({ open: false, type: "credit" });
      setAmount("");
      setReason("");
      fetchUser();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to process request." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendNotification = async () => {
    if (!profile || !notifyTitle.trim() || !notifyMessage.trim()) {
      toast({ variant: "destructive", title: "Missing fields", description: "Fill title and message." });
      return;
    }
    setIsProcessing(true);
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: profile.user_id,
        type: notifyType,
        title: notifyTitle.trim(),
        message: notifyMessage.trim(),
      });
      if (error) throw error;
      toast({ title: "Sent", description: `Notification sent to ${profile.email}.` });
      setNotifyOpen(false);
      setNotifyTitle("");
      setNotifyMessage("");
      fetchUser();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to send notification." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBan = async () => {
    if (!profile) return;
    setIsProcessing(true);
    try {
      const newBanStatus = !profile.is_banned;
      const { error } = await supabase
        .from("profiles")
        .update({
          is_banned: newBanStatus,
          banned_at: newBanStatus ? new Date().toISOString() : null,
          ban_reason: newBanStatus ? banReason : null,
        })
        .eq("user_id", profile.user_id);
      if (error) throw error;

      if (newBanStatus) {
        await supabase.from("notifications").insert({
          user_id: profile.user_id,
          type: "warning",
          title: "Account Suspended",
          message: banReason || "Your account has been suspended. Contact support for more information.",
        });
      }

      toast({ title: newBanStatus ? "User Banned" : "User Unbanned", description: `${profile.email} has been ${newBanStatus ? "banned" : "unbanned"}.` });
      setBanOpen(false);
      setBanReason("");
      fetchUser();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update ban status." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!profile) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from("profiles").delete().eq("user_id", profile.user_id);
      if (error) throw error;
      toast({ title: "User Deleted", description: `${profile.email} has been permanently deleted.` });
      navigate("/baki/stage/admin/users");
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete user." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!profile) return;
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Weak password", description: "Password must be at least 6 characters." });
      return;
    }
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { userId: profile.user_id, password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Password reset", description: "The user can now sign in with the new password." });
      setResetOpen(false);
      setNewPassword("");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to reset password.";
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const emojiAvatar = profile.avatar_url && /\p{Emoji}/u.test(profile.avatar_url) ? profile.avatar_url : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild onClick={() => navigate("/baki/stage/admin/users")}>
          <span className="inline-flex">
            <ArrowLeft className="w-5 h-5" />
          </span>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">User Profile</h1>
        {profile.is_banned ? (
          <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Banned</Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-green-700 text-green-500"><CheckCircle className="w-3 h-3" /> Active</Badge>
        )}
      </div>

      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl shrink-0">
              {emojiAvatar ? emojiAvatar : (profile.first_name?.[0] || profile.email[0]).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-foreground">
                {profile.first_name} {profile.last_name}
              </h2>
              <p className="text-lg font-medium text-primary">@{profile.tiktok_username}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {profile.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:text-right">
              <div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground"><Coins className="w-3.5 h-3.5" /> Balance</div>
                <div className="text-xl font-semibold text-foreground">{profile.tik_points}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined</div>
                <div className="text-sm font-medium text-foreground">{new Date(profile.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> Referral</div>
                <div className="text-sm font-medium text-foreground">{profile.referral_code || "—"}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Management actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Button variant="outline" className="justify-start gap-3 text-green-600" onClick={() => setCreditDebit({ open: true, type: "credit" })} disabled={!canManage}>
          <Plus className="w-4 h-4" /> Credit Points
        </Button>
        <Button variant="outline" className="justify-start gap-3 text-orange-500" onClick={() => setCreditDebit({ open: true, type: "debit" })} disabled={!canManage}>
          <Minus className="w-4 h-4" /> Debit Points
        </Button>
        <Button variant="outline" className="justify-start gap-3 text-blue-500" onClick={() => setNotifyOpen(true)}>
          <Send className="w-4 h-4" /> Send Notification
        </Button>
        <Button variant="outline" className="justify-start gap-3 text-yellow-500" onClick={() => setBanOpen(true)}>
          <Ban className="w-4 h-4" /> {profile.is_banned ? "Unban" : "Ban"} User
        </Button>
        <Button variant="outline" className="justify-start gap-3" onClick={() => setResetOpen(true)}>
          <KeyRound className="w-4 h-4" /> Reset Password
        </Button>
        <Button
          variant="outline"
          className="justify-start gap-3 text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="w-4 h-4" /> Delete User
        </Button>
      </div>

      {!canManage && (
        <p className="text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5 inline mr-1" />
          Point adjustments and deletions are limited to administrators.
        </p>
      )}

      {/* Activity tabs */}
      <Card>
        <Tabs defaultValue="transactions">
          <CardHeader className="pb-0">
            <TabsList>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="transactions" className="mt-4">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-foreground">Date</TableHead>
                        <TableHead className="text-foreground">Type</TableHead>
                        <TableHead className="text-foreground">Amount</TableHead>
                        <TableHead className="text-foreground">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id} className="border-border hover:bg-muted/50">
                          <TableCell className="text-muted-foreground text-sm">{new Date(tx.created_at).toLocaleString()}</TableCell>
                          <TableCell><Badge variant="outline">{tx.type}</Badge></TableCell>
                          <TableCell className={`font-medium ${tx.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {tx.amount >= 0 ? "+" : ""}{tx.amount}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{tx.description || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            <TabsContent value="notifications" className="mt-4">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{n.title}</p>
                        <p className="text-sm text-muted-foreground">{n.message}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-xs">{n.type}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Credit/Debit dialog */}
      <Dialog open={creditDebit.open} onOpenChange={(open) => !open && setCreditDebit({ ...creditDebit, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{creditDebit.type === "credit" ? "Credit" : "Debit"} Points</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDebit({ ...creditDebit, open: false })}>Cancel</Button>
            <Button onClick={handleCreditDebit} disabled={isProcessing} className={creditDebit.type === "credit" ? "bg-green-600" : "bg-red-600"}>
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {creditDebit.type === "credit" ? "Credit" : "Debit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification dialog */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={notifyType} onValueChange={(v) => setNotifyType(v as NotificationType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Title" value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} />
            <Textarea placeholder="Message" value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyOpen(false)}>Cancel</Button>
            <Button onClick={handleSendNotification} disabled={isProcessing} className="bg-blue-600">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban dialog */}
      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{profile.is_banned ? "Unban" : "Ban"} User</DialogTitle>
            <DialogDescription>
              {profile.is_banned
                ? "This will restore the user's access to the platform."
                : "This will prevent the user from logging in or earning points."}
            </DialogDescription>
          </DialogHeader>
          {!profile.is_banned && (
            <div className="space-y-2 py-4">
              <Label>Ban Reason</Label>
              <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason for ban..." />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanOpen(false)}>Cancel</Button>
            <Button onClick={handleBan} disabled={isProcessing} className={profile.is_banned ? "bg-green-600" : "bg-yellow-600"}>
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {profile.is_banned ? "Unban" : "Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for this user. They will need to sign in with it next time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>New Password</Label>
            <Input type="password" placeholder="Minimum 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={isProcessing}>
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {profile.email} and all their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}