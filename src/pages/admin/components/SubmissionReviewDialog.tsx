import { useState } from "react";
import { 
  CheckCircle, 
  XCircle, 
  Loader2,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
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
  profiles?: { tiktok_username: string; email: string };
  ads?: { task_type: string; points_per_task: number };
}

interface SubmissionReviewDialogProps {
  submission: Submission | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function SubmissionReviewDialog({ submission, onClose, onUpdate }: SubmissionReviewDialogProps) {
  const [adminNotes, setAdminNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  if (!submission) return null;

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      const points = submission.ads?.points_per_task || 0;

      await supabase
        .from("task_submissions")
        .update({
          status: "approved",
          points_awarded: points,
          admin_notes: adminNotes || null,
        })
        .eq("id", submission.id);

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

      toast({ title: "Approved", description: `Task approved. ${points} points awarded.` });
      onClose();
      onUpdate();
    } catch (error) {
      console.error("Error approving:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to approve submission." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await supabase
        .from("task_submissions")
        .update({
          status: "rejected",
          admin_notes: adminNotes || null,
        })
        .eq("id", submission.id);

      toast({ title: "Rejected", description: "Task has been rejected." });
      onClose();
      onUpdate();
    } catch (error) {
      console.error("Error rejecting:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to reject submission." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={!!submission} onOpenChange={onClose}>
      <DialogContent className="bg-neutral-900 border-neutral-800 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-neutral-100">Review Submission</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Info */}
          <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
            <div>
              <div className="font-medium text-neutral-100">
                {`@${submission.profiles?.tiktok_username}`}
              </div>
              <div className="text-sm text-neutral-500">{submission.profiles?.email}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-neutral-400 capitalize">
                {submission.ads?.task_type?.replace("_", " ")} Task
              </div>
              <div className="text-sm text-neutral-500">
                {submission.ads?.points_per_task} points
              </div>
            </div>
          </div>

          {/* Screenshots */}
          <div className="space-y-2">
            <Label className="text-neutral-300">Screenshots ({submission.screenshot_urls.length})</Label>
            <div className="grid grid-cols-3 gap-2">
              {submission.screenshot_urls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-video rounded-lg overflow-hidden bg-neutral-800 border border-neutral-700 hover:border-neutral-600 transition-colors relative group"
                >
                  <img
                    src={url}
                    alt={`Screenshot ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-white" />
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* AI Analysis */}
          {submission.ai_analysis && (
            <div className="space-y-2">
              <Label className="text-neutral-300">AI Analysis</Label>
              <div className="p-3 bg-neutral-800 rounded-lg text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Decision:</span>
                  <span className={submission.ai_analysis.approved ? "text-green-400" : "text-red-400"}>
                    {submission.ai_analysis.approved ? "Approved" : "Rejected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Confidence:</span>
                  <span className="text-neutral-100">{submission.ai_analysis.confidence || 0}%</span>
                </div>
                {submission.ai_analysis.reason && (
                  <div className="pt-2 border-t border-neutral-700">
                    <span className="text-neutral-400">Reason: </span>
                    <span className="text-neutral-300">{submission.ai_analysis.reason}</span>
                  </div>
                )}
                {submission.ai_analysis.details && (
                  <div className="pt-2 border-t border-neutral-700">
                    <span className="text-neutral-400 block mb-1">Details:</span>
                    <pre className="text-xs text-neutral-300 whitespace-pre-wrap">
                      {JSON.stringify(submission.ai_analysis.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin Notes */}
          <div className="space-y-2">
            <Label className="text-neutral-300">Admin Notes</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add notes about this decision..."
              className="bg-neutral-800 border-neutral-700 text-neutral-100"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-neutral-700 text-neutral-300"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
