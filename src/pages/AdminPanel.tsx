import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  FileCheck, 
  Settings, 
  BarChart3,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  AlertTriangle,
  Coins,
  TrendingUp,
  Shield,
  RefreshCw,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface Submission {
  id: string;
  ad_id: string;
  user_id: string;
  screenshot_urls: string[];
  status: "pending" | "approved" | "rejected" | "needs_review";
  ai_analysis: any;
  points_awarded: number | null;
  admin_notes: string | null;
  created_at: string;
  profiles?: {
    tiktok_username: string;
    email: string;
  };
  ads?: {
    task_type: string;
    points_per_task: number;
  };
}

interface User {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  tiktok_username: string;
  tik_points: number;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  pendingReviews: number;
  totalPointsIssued: number;
  approvalRate: number;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("overview");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    pendingReviews: 0,
    totalPointsIssued: 0,
    approvalRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch submissions
      const { data: submissionsData } = await supabase
        .from("task_submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      // Fetch ads for joining
      const { data: adsData } = await supabase
        .from("ads")
        .select("id, task_type, points_per_task");

      // Fetch profiles for joining
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, tiktok_username, email");

      // Fetch users
      const { data: usersData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Join data manually
      const enrichedSubmissions = (submissionsData || []).map(sub => ({
        ...sub,
        profiles: profilesData?.find(p => p.user_id === sub.user_id),
        ads: adsData?.find(a => a.id === sub.ad_id),
      }));

      // Calculate stats
      const pending = enrichedSubmissions.filter(s => s.status === "pending" || s.status === "needs_review").length;
      const approved = enrichedSubmissions.filter(s => s.status === "approved").length;
      const total = enrichedSubmissions.length;
      const totalPoints = enrichedSubmissions.reduce((sum, s) => sum + (s.points_awarded || 0), 0);

      setSubmissions(enrichedSubmissions as Submission[]);
      setUsers(usersData as User[] || []);
      setStats({
        totalUsers: usersData?.length || 0,
        pendingReviews: pending,
        totalPointsIssued: totalPoints,
        approvalRate: total > 0 ? (approved / total) * 100 : 0,
      });
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load admin data.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (submission: Submission) => {
    setIsProcessing(true);
    try {
      const points = submission.ads?.points_per_task || 0;

      // Update submission status
      await supabase
        .from("task_submissions")
        .update({
          status: "approved",
          points_awarded: points,
          admin_notes: adminNotes || null,
        })
        .eq("id", submission.id);

      // Get current user points and update
      const { data: profile } = await supabase
        .from("profiles")
        .select("tik_points")
        .eq("user_id", submission.user_id)
        .single();

      if (profile) {
        await supabase
          .from("profiles")
          .update({ tik_points: profile.tik_points + points })
          .eq("user_id", submission.user_id);
      }

      // Get current ad and update completion count
      const { data: ad } = await supabase
        .from("ads")
        .select("completed_count")
        .eq("id", submission.ad_id)
        .single();

      if (ad) {
        await supabase
          .from("ads")
          .update({ completed_count: ad.completed_count + 1 })
          .eq("id", submission.ad_id);
      }

      toast({
        title: "Approved",
        description: `Task approved. ${points} points awarded.`,
      });

      setSelectedSubmission(null);
      setAdminNotes("");
      fetchData();
    } catch (error) {
      console.error("Error approving:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve submission.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (submission: Submission) => {
    setIsProcessing(true);
    try {
      await supabase
        .from("task_submissions")
        .update({
          status: "rejected",
          admin_notes: adminNotes || null,
        })
        .eq("id", submission.id);

      toast({
        title: "Rejected",
        description: "Task has been rejected.",
      });

      setSelectedSubmission(null);
      setAdminNotes("");
      fetchData();
    } catch (error) {
      console.error("Error rejecting:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reject submission.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.tiktok_username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "success" | "destructive" | "warning"> = {
      pending: "warning",
      approved: "success",
      rejected: "destructive",
      needs_review: "warning",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card variant="glass" className="p-8 text-center">
          <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Manage users, tasks, and platform settings</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="interactive">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <div className="text-sm text-muted-foreground">Total Users</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="interactive">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.pendingReviews}</div>
                <div className="text-sm text-muted-foreground">Pending Reviews</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="interactive">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Coins className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalPointsIssued.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Points Issued</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="interactive">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.approvalRate.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Approval Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Recent Submissions Needing Review</CardTitle>
              <CardDescription>AI flagged these for manual review</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Task Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions
                      .filter(s => s.status === "pending" || s.status === "needs_review")
                      .slice(0, 5)
                      .map(sub => (
                        <TableRow key={sub.id}>
                          <TableCell>@{sub.profiles?.tiktok_username}</TableCell>
                          <TableCell className="capitalize">{sub.ads?.task_type}</TableCell>
                          <TableCell>{statusBadge(sub.status)}</TableCell>
                          <TableCell>{new Date(sub.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => setSelectedSubmission(sub)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions" className="space-y-4 mt-4">
          <Card variant="glass">
            <CardHeader>
              <CardTitle>All Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Task Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map(sub => (
                    <TableRow key={sub.id}>
                      <TableCell>@{sub.profiles?.tiktok_username}</TableCell>
                      <TableCell className="capitalize">{sub.ads?.task_type}</TableCell>
                      <TableCell>{statusBadge(sub.status)}</TableCell>
                      <TableCell>{sub.points_awarded || "-"}</TableCell>
                      <TableCell>{new Date(sub.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedSubmission(sub)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4 mt-4">
          <Card variant="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>User Management</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>TikTok</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>@{user.tiktok_username}</TableCell>
                      <TableCell>
                        <Badge variant="gradient" className="gap-1">
                          <Coins className="w-3 h-3" />
                          {user.tik_points}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Platform Settings</CardTitle>
              <CardDescription>Configure points and AI verification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Points per Like</Label>
                  <Input type="number" defaultValue="5" />
                </div>
                <div className="space-y-2">
                  <Label>Points per Comment</Label>
                  <Input type="number" defaultValue="10" />
                </div>
                <div className="space-y-2">
                  <Label>Points per Save</Label>
                  <Input type="number" defaultValue="8" />
                </div>
                <div className="space-y-2">
                  <Label>Points per Watch</Label>
                  <Input type="number" defaultValue="3" />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <h4 className="font-medium mb-4">AI Verification</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  AI verification is powered by Lovable AI and configured automatically.
                </p>
                <Badge variant="success" className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  AI Verification Active
                </Badge>
              </div>

              <Button variant="gradient">Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Modal */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Submission</DialogTitle>
            <DialogDescription>
              Review the screenshots and approve or reject this task
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">@{selectedSubmission.profiles?.tiktok_username}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedSubmission.ads?.task_type} task
                  </p>
                </div>
                {statusBadge(selectedSubmission.status)}
              </div>

              {/* Screenshots */}
              <div className="grid grid-cols-3 gap-2">
                {selectedSubmission.screenshot_urls.map((url, i) => (
                  <div key={i} className="aspect-[9/16] rounded-lg overflow-hidden bg-muted">
                    <img src={url} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              {/* AI Analysis */}
              {selectedSubmission.ai_analysis && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">AI Analysis</h4>
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(selectedSubmission.ai_analysis, null, 2)}
                  </pre>
                </div>
              )}

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea
                  placeholder="Add notes about this review..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="destructive"
                  onClick={() => handleReject(selectedSubmission)}
                  disabled={isProcessing}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  variant="gradient"
                  onClick={() => handleApprove(selectedSubmission)}
                  disabled={isProcessing}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve (+{selectedSubmission.ads?.points_per_task} pts)
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
