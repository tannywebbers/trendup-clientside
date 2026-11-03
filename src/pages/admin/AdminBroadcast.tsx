import { useState, useEffect } from "react";
import { Radio, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { SettingsHeader } from "./components/SettingsList";

type NotificationType = "announcement" | "warning" | "info" | "promotion" | "admin_credit" | "admin_debit";

type Audience = "all" | "active" | "banned";

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "All users",
  active: "Active users",
  banned: "Banned users",
};

export default function AdminBroadcast() {
  const { toast } = useToast();
  const { userRole } = useAuth();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotificationType>("announcement");
  const [audience, setAudience] = useState<Audience>("all");
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ count: number; audience: Audience } | null>(null);

  const handleBroadcast = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ variant: "destructive", title: "Missing fields", description: "Title and message are required." });
      return;
    }

    setIsSending(true);
    try {
      // Resolve target users
      let query = supabase.from("profiles").select("user_id, is_banned").neq("user_id", "");
      if (audience === "active") query = query.eq("is_banned", false);
      if (audience === "banned") query = query.eq("is_banned", true);

      const { data: profiles, error: profilesError } = await query;
      if (profilesError) throw profilesError;

      const targetUsers = (profiles || []).map((p) => p.user_id);
      if (targetUsers.length === 0) {
        toast({ variant: "destructive", title: "No recipients", description: "No users matched that audience." });
        setIsSending(false);
        return;
      }

      // Fan-out notifications in chunks (insert can hit arg limits for huge lists)
      const CHUNK = 500;
      const rows = targetUsers.map((userId) => ({
        user_id: userId,
        type,
        title: title.trim(),
        message: message.trim(),
      }));

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase.from("notifications").insert(chunk);
        if (error) throw error;
      }

      setLastResult({ count: targetUsers.length, audience });
      toast({ title: "Broadcast sent", description: `Sent to ${targetUsers.length} users.` });
      setTitle("");
      setMessage("");
    } catch (error) {
      console.error("Broadcast error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to send broadcast." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <SettingsHeader
        title="Broadcast"
        description="Send one message to everyone on the platform"
        backHref="/baki/stage/admin/communications"
      />

      {lastResult && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-foreground">Last broadcast delivered</span>
            <span className="text-muted-foreground"> — {lastResult.count} recipients ({AUDIENCE_LABELS[lastResult.audience]})</span>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Radio className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>New Broadcast</CardTitle>
              <CardDescription>Every recipient gets an in-app notification</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="active">Active users</SelectItem>
                  <SelectItem value="banned">Banned users</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notification Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as NotificationType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="promotion">Promotion</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="e.g. New feature is live!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              rows={5}
              placeholder="Write the message your users will see..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
            />
          </div>

          {userRole !== "admin" && (
            <p className="text-xs text-muted-foreground">
              Broadcasting is restricted — only administrators can send to all users.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => { setTitle(""); setMessage(""); }}>
          Clear
        </Button>
        <Button onClick={handleBroadcast} disabled={isSending || !title.trim() || !message.trim()}>
          {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {isSending ? "Sending..." : "Send Broadcast"}
        </Button>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
        <Badge variant="secondary" className="shrink-0 mt-0.5">Tip</Badge>
        <p className="text-xs text-muted-foreground">
          Broadcasts are delivered instantly as in-app notifications. Use{" "}
          <span className="font-medium text-foreground">Announcements</span> if you want a permanent, dismissible
          announcement banner that also shows up in the app.
        </p>
      </div>
    </div>
  );
}