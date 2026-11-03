import { useState, useEffect } from "react";
import { Mail, Plus, Send, Trash2, Loader2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { SettingsHeader } from "./components/SettingsList";

interface Campaign {
  id: string;
  title: string;
  subject: string;
  body_html: string;
  status: "draft" | "sending" | "sent" | "failed";
  audience: "all" | "active" | "verified";
  recipient_count: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
}

export default function AdminEmailCampaigns() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingId, setIsSendingId] = useState<string | null>(null);

  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [audience, setAudience] = useState<Campaign["audience"]>("all");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("email_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setCampaigns((data as Campaign[]) || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim() || !subject.trim() || !bodyHtml.trim()) {
      toast({ variant: "destructive", title: "Missing fields", description: "Title, subject and content are required." });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await (supabase as any).from("email_campaigns").insert({
        title: title.trim(),
        subject: subject.trim(),
        body_html: bodyHtml.trim(),
        audience,
        status: "draft",
        created_by: user?.id,
      });
      if (error) throw error;
      toast({ title: "Draft saved", description: "Campaign saved as a draft." });
      setShowCompose(false);
      setTitle("");
      setSubject("");
      setBodyHtml("");
      setAudience("all");
      fetchCampaigns();
    } catch (error) {
      console.error("Save campaign error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save campaign." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async (campaign: Campaign) => {
    if (!confirm(`Send "${campaign.title}" to users now? This emails everyone in the selected audience.`)) return;
    setIsSendingId(campaign.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-bulk-email", {
        body: { campaignId: campaign.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Campaign sent",
        description: `Delivered to ${data?.sent ?? 0} users (${data?.failed ?? 0} failed).`,
      });
      fetchCampaigns();
    } catch (error) {
      console.error("Send campaign error:", error);
      const message = error instanceof Error ? error.message : "Failed to send campaign.";
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setIsSendingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    try {
      const { error } = await (supabase as any).from("email_campaigns").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Campaign removed." });
      fetchCampaigns();
    } catch (error) {
      console.error("Delete campaign error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete campaign." });
    }
  };

  const statusBadge = (c: Campaign) => {
    if (c.status === "sent") return <Badge variant="outline" className="border-green-600 text-green-500 gap-1"><CheckCircle2 className="w-3 h-3" /> Sent ({c.recipient_count})</Badge>;
    if (c.status === "failed") return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Failed</Badge>;
    if (c.status === "sending") return <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Sending</Badge>;
    return <Badge variant="secondary">Draft</Badge>;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <SettingsHeader
        title="Email Campaigns"
        description="Compose, preview and send email campaigns to users"
        backHref="/baki/stage/admin/communications"
      />

      <div className="flex justify-end">
        <Button onClick={() => setShowCompose(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Campaign
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Campaigns
          </CardTitle>
          <CardDescription>Emails are sent through your configured SMTP/Brevo gateway</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No campaigns yet</p>
              <p className="text-sm">Create your first email campaign to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-foreground">Campaign</TableHead>
                    <TableHead className="text-foreground">Audience</TableHead>
                    <TableHead className="text-foreground">Status</TableHead>
                    <TableHead className="text-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c.id} className="border-border hover:bg-muted/50">
                      <TableCell>
                        <div className="max-w-md">
                          <div className="font-medium text-foreground">{c.title}</div>
                          <div className="text-sm text-muted-foreground">Subject: {c.subject}</div>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {new Date(c.created_at).toLocaleString()}
                          </div>
                          {c.last_error && <div className="text-xs text-destructive mt-1">{c.last_error}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">{c.audience}</TableCell>
                      <TableCell>{statusBadge(c)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {c.status === "draft" ? (
                            <Button size="sm" onClick={() => handleSend(c)} disabled={isSendingId === c.id}>
                              {isSendingId === c.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                              Send
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" disabled>
                              {c.status === "sent" ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                              {c.status === "sent" ? "Sent" : c.status}
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compose dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Email Campaign</DialogTitle>
            <DialogDescription>{"You can use {{name}}, {{email}} and {{app_name}} as variables"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Campaign Title (internal)</Label>
              <Input placeholder="e.g. Welcome series" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email Subject</Label>
                <Input placeholder="e.g. Big update coming!" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as Campaign["audience"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    <SelectItem value="active">Active users</SelectItem>
                    <SelectItem value="verified">Users with email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email Body (HTML)</Label>
              <Textarea rows={10} placeholder="<h1>Hi {{name}}!</h1><p>Welcome to {{app_name}}.</p>" value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} className="font-mono text-sm" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
            <Button onClick={handleSaveDraft} disabled={isSaving || !title.trim() || !subject.trim() || !bodyHtml.trim()}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}