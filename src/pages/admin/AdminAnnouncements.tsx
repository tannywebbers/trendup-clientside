import { useState, useEffect } from "react";
import { Megaphone, Plus, Send, Trash2, Loader2, Eye, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "announcement" | "info" | "warning" | "promotion";
  status: "draft" | "sent";
  audience: "all" | "active" | "banned";
  show_in_dashboard: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
}

const ANNOUNCEMENT_CARD = {
  announcement: { label: "Announcement", className: "text-blue-500 border-blue-500/30" },
  info: { label: "Info", className: "text-cyan-500 border-cyan-500/30" },
  warning: { label: "Warning", className: "text-yellow-500 border-yellow-500/30" },
  promotion: { label: "Promotion", className: "text-purple-500 border-purple-500/30" },
};

export default function AdminAnnouncements() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<Announcement["type"]>("announcement");
  const [audience, setAudience] = useState<Announcement["audience"]>("all");
  const [showInDashboard, setShowInDashboard] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setAnnouncements((data as Announcement[]) || []);
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setType("announcement");
    setAudience("all");
    setShowInDashboard(true);
  };

  const handleSaveDraft = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ variant: "destructive", title: "Missing fields", description: "Title and message are required." });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await (supabase as any).from("announcements").insert({
        title: title.trim(),
        message: message.trim(),
        type,
        audience,
        show_in_dashboard: showInDashboard,
        status: "draft",
        created_by: user?.id,
      });
      if (error) throw error;
      toast({ title: "Draft saved", description: "Announcement saved as a draft." });
      setShowCompose(false);
      resetForm();
      fetchAnnouncements();
    } catch (error) {
      console.error("Save announcement error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save announcement." });
    } finally {
      setIsSaving(false);
    }
  };

  const sendAnnouncement = async (announcement: Announcement) => {
    setIsSending(true);
    try {
      // Resolve recipients based on audience
      let query = supabase.from("profiles").select("user_id, is_banned");
      if (announcement.audience === "active") query = query.eq("is_banned", false);
      if (announcement.audience === "banned") query = query.eq("is_banned", true);
      const { data: profiles } = await query;
      const recipients = (profiles || []).map((p) => p.user_id);

      // Fan-out in-app notifications
      const CHUNK = 500;
      const rows = recipients.map((userId) => ({
        user_id: userId,
        type: announcement.type,
        title: announcement.title,
        message: announcement.message,
      }));
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from("notifications").insert(rows.slice(i, i + CHUNK));
        if (error) throw error;
      }

      // Optionally surface as dashboard marquee (SlidingBanners)
      if (announcement.show_in_dashboard) {
        const { data: existing } = await (supabase as any)
          .from("sliding_banners")
          .select("id")
          .eq("message", announcement.message)
          .maybeSingle();
        if (!existing) {
          const { error: bannerError } = await (supabase as any)
            .from("sliding_banners")
            .insert({ message: announcement.title + " — " + announcement.message, is_active: true });
          if (bannerError) console.error("Sliding banner error:", bannerError);
        }
      }

      const { error: updateError } = await (supabase as any)
        .from("announcements")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          recipient_count: recipients.length,
        })
        .eq("id", announcement.id);
      if (updateError) throw updateError;

      toast({ title: "Announcement sent", description: `Delivered to ${recipients.length} users.` });
      fetchAnnouncements();
    } catch (error) {
      console.error("Send announcement error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to send announcement." });
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement? This cannot be undone.")) return;
    try {
      const { error } = await (supabase as any).from("announcements").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Announcement removed." });
      fetchAnnouncements();
    } catch (error) {
      console.error("Delete announcement error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete announcement." });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <SettingsHeader
        title="Announcements"
        description="Create, schedule and send platform announcements to your users"
        backHref="/baki/stage/admin/communications"
      />

      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowCompose(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Announcement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            All Announcements
          </CardTitle>
          <CardDescription>Drafts stay hidden until you send them</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No announcements yet</p>
              <p className="text-sm">Create your first announcement to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-foreground">Announcement</TableHead>
                    <TableHead className="text-foreground">Type</TableHead>
                    <TableHead className="text-foreground">Audience</TableHead>
                    <TableHead className="text-foreground">Status</TableHead>
                    <TableHead className="text-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((a) => {
                    const meta = ANNOUNCEMENT_CARD[a.type] || ANNOUNCEMENT_CARD.announcement;
                    return (
                      <TableRow key={a.id} className="border-border hover:bg-muted/50">
                        <TableCell>
                          <div className="max-w-xs">
                            <div className="font-medium text-foreground truncate">{a.title}</div>
                            <div className="text-sm text-muted-foreground truncate">{a.message}</div>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {new Date(a.created_at).toLocaleString()}
                              {a.show_in_dashboard && (
                                <Badge variant="secondary" className="text-xs">Dashboard banner</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">{a.audience}</TableCell>
                        <TableCell>
                          {a.status === "sent" ? (
                            <Badge variant="outline" className="border-green-600 text-green-500 gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Sent{typeof a.recipient_count === "number" ? ` (${a.recipient_count})` : ""}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {a.status === "draft" ? (
                              <Button size="sm" onClick={() => sendAnnouncement(a)} disabled={isSending}>
                                <Send className="w-4 h-4 mr-1" /> Send
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" disabled>
                                <Eye className="w-4 h-4 mr-1" /> Sent
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(a.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compose dialog */}
      <Dialog open={showCompose} onOpenChange={(open) => { if (!open) resetForm(); setShowCompose(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>Save as a draft, then send it whenever you're ready</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="e.g. Summer Raid Weekend!" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea rows={5} placeholder="What should your users know?" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as Announcement["type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as Announcement["audience"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    <SelectItem value="active">Active users</SelectItem>
                    <SelectItem value="banned">Banned users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="font-medium text-sm">Show on dashboard banner</p>
                <p className="text-xs text-muted-foreground">Also scrolls this announcement across the app</p>
              </div>
              <Switch checked={showInDashboard} onCheckedChange={setShowInDashboard} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
            <Button onClick={handleSaveDraft} disabled={isSaving || !title.trim() || !message.trim()}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}