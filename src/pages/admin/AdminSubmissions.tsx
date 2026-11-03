import { useState, useEffect } from "react";
import { 
  FileCheck,
  Search,
  Eye,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MobileCards,
  MobileCard,
  MobileCardRow,
  MobileCardHeader,
  MobileCardActions,
} from "@/components/ui/responsive-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { SubmissionReviewDialog } from "./components/SubmissionReviewDialog";

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
  profiles?: { tiktok_username: string; email: string };
  ads?: { task_type: string; points_per_task: number };
}

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("needs_review");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [deleteSubmission, setDeleteSubmission] = useState<Submission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const { data: submissionsData } = await supabase
        .from("task_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: adsData } = await supabase.from("ads").select("id, task_type, points_per_task");
      const { data: profilesData } = await supabase.from("profiles").select("user_id, tiktok_username, email");

      const enrichedSubmissions = (submissionsData || []).map(sub => ({
        ...sub,
        profiles: profilesData?.find(p => p.user_id === sub.user_id),
        ads: adsData?.find(a => a.id === sub.ad_id),
      }));

      setSubmissions(enrichedSubmissions as Submission[]);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load submissions." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSubmission = async () => {
    if (!deleteSubmission) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("task_submissions")
        .delete()
        .eq("id", deleteSubmission.id);
        
      if (error) throw error;
      
      setSubmissions(prev => prev.filter(s => s.id !== deleteSubmission.id));
      toast({ title: "Deleted", description: "Submission has been deleted." });
      setDeleteSubmission(null);
    } catch (error) {
      console.error("Error deleting submission:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete submission." });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = 
      sub.profiles?.tiktok_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "success" | "destructive" | "warning"; icon: any }> = {
      pending: { variant: "warning", icon: AlertTriangle },
      approved: { variant: "success", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
      needs_review: { variant: "warning", icon: AlertTriangle },
    };
    const { variant, icon: Icon } = config[status] || { variant: "default", icon: null };
    return (
      <Badge variant={variant} className="gap-1 capitalize">
        {Icon && <Icon className="w-3 h-3" />}
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const taskTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      like: "bg-red-500/10 text-red-400",
      comment: "bg-blue-500/10 text-blue-400",
      save: "bg-yellow-500/10 text-yellow-400",
      follow: "bg-purple-500/10 text-purple-400",
      combo_mini: "bg-gradient-to-r from-red-500/10 via-blue-500/10 to-yellow-500/10 text-foreground",
      combo_large: "bg-gradient-to-r from-red-500/10 via-blue-500/10 via-yellow-500/10 to-purple-500/10 text-foreground",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${colors[type] || "bg-muted"}`}>
        {type.replace("_", " ")}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Submissions</h1>
          <p className="text-sm text-muted-foreground mt-1">{submissions.length} total submissions</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-10 w-full sm:w-48"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">User</TableHead>
                <TableHead className="text-muted-foreground">Task Type</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">AI Confidence</TableHead>
                <TableHead className="text-muted-foreground">Points</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.map(sub => (
                <TableRow key={sub.id} className="border-border hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <div className="font-medium text-foreground">
                        {`@${sub.profiles?.tiktok_username}`}
                      </div>
                      <div className="text-xs text-muted-foreground">{sub.profiles?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{taskTypeBadge(sub.ads?.task_type || "unknown")}</TableCell>
                  <TableCell>{statusBadge(sub.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {sub.ai_analysis?.confidence ? `${sub.ai_analysis.confidence}%` : "-"}
                  </TableCell>
                  <TableCell className="text-foreground">{sub.points_awarded || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedSubmission(sub)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {sub.status === "approved" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteSubmission(sub)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <MobileCards className="p-4">
          {filteredSubmissions.map(sub => (
            <MobileCard key={sub.id}>
              <MobileCardHeader>
                <div>
                  <div className="font-medium text-foreground">
                    {`@${sub.profiles?.tiktok_username}`}
                  </div>
                  <div className="text-xs text-muted-foreground">{sub.profiles?.email}</div>
                </div>
                {statusBadge(sub.status)}
              </MobileCardHeader>
              
              <MobileCardRow label="Task Type">
                {taskTypeBadge(sub.ads?.task_type || "unknown")}
              </MobileCardRow>
              <MobileCardRow label="AI Confidence">
                <span className="text-muted-foreground">
                  {sub.ai_analysis?.confidence ? `${sub.ai_analysis.confidence}%` : "-"}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Points">
                <span className="text-foreground">{sub.points_awarded || "-"}</span>
              </MobileCardRow>
              <MobileCardRow label="Date">
                <span className="text-muted-foreground">
                  {new Date(sub.created_at).toLocaleDateString()}
                </span>
              </MobileCardRow>
              
              <MobileCardActions>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedSubmission(sub)}
                >
                  <Eye className="w-4 h-4 mr-1" /> Review
                </Button>
                {sub.status === "approved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteSubmission(sub)}
                    className="text-destructive border-destructive/30"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                )}
              </MobileCardActions>
            </MobileCard>
          ))}
        </MobileCards>
      </div>

      <SubmissionReviewDialog
        submission={selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        onUpdate={fetchSubmissions}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSubmission} onOpenChange={(open) => !open && setDeleteSubmission(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this approved submission. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmission}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
