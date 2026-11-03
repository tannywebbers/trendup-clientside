import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  ExternalLink,
  Eye,
  Check,
  Loader2,
  Users,
  Clock,
  Megaphone,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RaidPost {
  id: string;
  user_id: string;
  post_url: string;
  post_date: string;
  status: string;
  viewed_at: string | null;
  created_at: string;
}

interface RaidSession {
  id: string;
  raid_link: string | null;
  post_window_start: string | null;
  post_window_end: string | null;
  raid_start: string | null;
  raid_end: string | null;
  reminder_every_minutes: number;
  reminder_buffer_minutes: number;
  is_active: boolean;
}

interface SlidingBanner {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function postStatusCfg(status: string): { label: string; variant: "secondary" | "default" | "success" } {
  if (status === "added") return { label: "Added to collection", variant: "success" };
  if (status === "viewed") return { label: "Viewed", variant: "default" };
  return { label: "Pending review", variant: "secondary" };
}

export default function AdminRaid() {
  const { toast } = useToast();
  const [tab, setTab] = useState("posts");
  const [posts, setPosts] = useState<RaidPost[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [session, setSession] = useState<RaidSession | null>(null);
  const [raidEnded, setRaidEnded] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    post_window_start: "",
    post_window_end: "",
    raid_start: "",
    raid_end: "",
    reminder_every_minutes: 10,
    reminder_buffer_minutes: 30,
  });
  const [banners, setBanners] = useState<SlidingBanner[]>([]);
  const [newBanner, setNewBanner] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [newLink, setNewLink] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [postsRes, sessionRes, bannersRes] = await Promise.all([
      (supabase as any).from("raid_posts").select("*").order("created_at", { ascending: false }).limit(30),
      (supabase as any).from("raid_sessions").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(1),
      (supabase as any).from("sliding_banners").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    let postsData = (postsRes.data as RaidPost[]) || [];
    const bannersData = (bannersRes.data as SlidingBanner[]) || [];
    setBanners(bannersData);

    const active = (sessionRes.data as RaidSession[] | null)?.[0] || null;

    if (active && active.raid_end && new Date(active.raid_end).getTime() <= Date.now()) {
      await (supabase as any).from("raid_sessions").update({ is_active: false, raid_link: null }).eq("id", active.id);
      setSession(null);
      setRaidEnded(true);
      postsData = [];
    } else {
      setRaidEnded(false);
      setSession(active);
      if (active) {
        setSessionForm({
          post_window_start: toLocalInput(active.post_window_start),
          post_window_end: toLocalInput(active.post_window_end),
          raid_start: toLocalInput(active.raid_start),
          raid_end: toLocalInput(active.raid_end),
          reminder_every_minutes: active.reminder_every_minutes,
          reminder_buffer_minutes: active.reminder_buffer_minutes,
        });
      }
    }

    setPosts(postsData);

    const userIds = Array.from(new Set(postsData.map((p) => p.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, tiktok_username")
      .in("user_id", userIds.length ? userIds : ["__none__"]);
    const map: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { map[p.user_id] = p.tiktok_username; });
    setUsernames(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markViewed = async (post: RaidPost) => {
    setUpdating(post.id);
    const { error } = await (supabase as any)
      .from("raid_posts")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", post.id);
    setUpdating(null);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not update post." });
      return;
    }
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: "viewed", viewed_at: new Date().toISOString() } : p)));
  };

  const addToCollection = async (post: RaidPost) => {
    setUpdating(post.id);
    const { error } = await (supabase as any).from("raid_posts").update({ status: "added" }).eq("id", post.id);
    setUpdating(null);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not update post." });
      return;
    }
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: "added" } : p)));
    toast({ title: "Added", description: "Post marked as added to the raid collection." });
  };

  const saveSession = async () => {
    setSavingSession(true);
    const payload = {
      post_window_start: sessionForm.post_window_start ? new Date(sessionForm.post_window_start).toISOString() : null,
      post_window_end: sessionForm.post_window_end ? new Date(sessionForm.post_window_end).toISOString() : null,
      raid_start: sessionForm.raid_start ? new Date(sessionForm.raid_start).toISOString() : null,
      raid_end: sessionForm.raid_end ? new Date(sessionForm.raid_end).toISOString() : null,
      reminder_every_minutes: sessionForm.reminder_every_minutes,
      reminder_buffer_minutes: sessionForm.reminder_buffer_minutes,
      is_active: true,
    };
    const { error } = session
      ? await (supabase as any).from("raid_sessions").update(payload).eq("id", session.id)
      : await (supabase as any).from("raid_sessions").insert(payload);
    setSavingSession(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not save raid settings." });
      return;
    }
    toast({ title: "Saved", description: "Raid settings updated." });
    await fetchData();
  };

  const addRaidLink = async () => {
    const link = newLink.trim();
    if (!link) return;
    setSavingLink(true);
    let result;
    if (session) {
      result = await (supabase as any)
        .from("raid_sessions")
        .update({ raid_link: link, is_active: true })
        .eq("id", session.id);
    } else {
      result = await (supabase as any)
        .from("raid_sessions")
        .insert({ raid_link: link, is_active: true });
    }
    setSavingLink(false);
    if (result.error) {
      toast({ variant: "destructive", title: "Error", description: "Could not save the raid link." });
      return;
    }
    setLinkDialogOpen(false);
    setNewLink("");
    toast({ title: "Added", description: "Raid link added. It will be cleared automatically when the raid ends." });
    await fetchData();
  };

  const addBanner = async () => {
    const message = newBanner.trim();
    if (!message) return;
    const { error } = await (supabase as any).from("sliding_banners").insert({ message, is_active: true });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not add banner." });
      return;
    }
    setNewBanner("");
    toast({ title: "Added", description: "Sliding banner is now live." });
    await fetchData();
  };

  const toggleBanner = async (banner: SlidingBanner) => {
    const { error } = await (supabase as any)
      .from("sliding_banners")
      .update({ is_active: !banner.is_active })
      .eq("id", banner.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not update banner." });
      return;
    }
    setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, is_active: !b.is_active } : b)));
  };

  const deleteBanner = async (id: string) => {
    const { error } = await (supabase as any).from("sliding_banners").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not delete banner." });
      return;
    }
    setBanners((prev) => prev.filter((b) => b.id !== id));
    toast({ title: "Removed", description: "Banner removed. It will no longer show on the user side." });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">Raid Manager</h1>
        {session && !raidEnded && <Badge variant="success">Live</Badge>}
        {raidEnded && <Badge variant="secondary">Raid ended</Badge>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
          <TabsTrigger value="posts">Raids / Submitted Post</TabsTrigger>
          <TabsTrigger value="settings">Raid Settings</TabsTrigger>
        </TabsList>

        {/* ============ Tab: Raids / Submitted Post ============ */}
        <TabsContent value="posts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Submitted Posts
                <Badge variant="secondary">{posts.length}</Badge>
              </CardTitle>
              <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="gradient" size="sm">
                    <Plus className="w-4 h-4 mr-1.5" /> Add Raid Link
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Raid Link</DialogTitle>
                    <DialogDescription>
                      Paste the TikTok collection link. It will be shown to members and reset to empty when the raid ends.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    placeholder="https://www.tiktok.com/@user/collection/..."
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
                    <Button variant="gradient" onClick={addRaidLink} disabled={savingLink || !newLink.trim()}>
                      {savingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Link"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : raidEnded ? (
                <div className="py-10 text-center space-y-1">
                  <p className="text-lg font-semibold text-foreground">Raid has ended</p>
                  <p className="text-sm text-muted-foreground">
                    The submitted post list and raid link have been cleared. Add a new raid link to start the next one.
                  </p>
                </div>
              ) : posts.length === 0 ? (
                <div className="py-10 text-center space-y-1">
                  <p className="text-sm text-muted-foreground">No raid posts submitted yet.</p>
                  <p className="text-xs text-muted-foreground/70">
                    Posts appear here as members submit them, newest first.
                  </p>
                </div>
              ) : (
                posts.map((post) => {
                  const cfg = postStatusCfg(post.status);
                  return (
                    <div key={post.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">@{usernames[post.user_id] || "member"}</span>
                          <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-1">{post.post_url}</div>
                        <div className="text-xs text-muted-foreground/70 mt-0.5">
                          Submitted {new Date(post.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={post.post_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open Post
                          </a>
                        </Button>
                        {post.status === "pending" ? (
                          <Button variant="secondary" size="sm" onClick={() => markViewed(post)} disabled={updating === post.id}>
                            {updating === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Eye className="w-3.5 h-3.5 mr-1.5" /> View</>}
                          </Button>
                        ) : post.status === "viewed" ? (
                          <Button variant="outline" size="sm" className="bg-primary/10" onClick={() => addToCollection(post)} disabled={updating === post.id}>
                            {updating === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1.5" /> Add to Collection</>}
                          </Button>
                        ) : post.status === "added" ? (
                          <Button variant="outline" size="sm" disabled>
                            <Check className="w-3.5 h-3.5 mr-1.5" /> Added
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ Tab: Raid Settings ============ */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Raid Times
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Raid starts at</Label>
                  <Input
                    type="datetime-local"
                    value={sessionForm.raid_start}
                    onChange={(e) => setSessionForm({ ...sessionForm, raid_start: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Raid ends at</Label>
                  <Input
                    type="datetime-local"
                    value={sessionForm.raid_end}
                    onChange={(e) => setSessionForm({ ...sessionForm, raid_end: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Post submission window — start</Label>
                  <Input
                    type="datetime-local"
                    value={sessionForm.post_window_start}
                    onChange={(e) => setSessionForm({ ...sessionForm, post_window_start: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Post submission window — end</Label>
                  <Input
                    type="datetime-local"
                    value={sessionForm.post_window_end}
                    onChange={(e) => setSessionForm({ ...sessionForm, post_window_end: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Reminder every (minutes)</Label>
                  <Input
                    type="number"
                    value={sessionForm.reminder_every_minutes}
                    onChange={(e) => setSessionForm({ ...sessionForm, reminder_every_minutes: parseInt(e.target.value) || 10 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Reminder buffer before raid (minutes)</Label>
                  <Input
                    type="number"
                    value={sessionForm.reminder_buffer_minutes}
                    onChange={(e) => setSessionForm({ ...sessionForm, reminder_buffer_minutes: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="gradient" onClick={saveSession} disabled={savingSession}>
                  {savingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Clock className="w-4 h-4 mr-1.5" /> Save Raid Times</>}
                </Button>
                <p className="text-xs text-muted-foreground self-center ml-1">
                  When the raid ends, submitted posts and the raid link are cleared automatically.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5" />
                Sliding Banners
                <Badge variant="secondary" className="ml-auto">{banners.filter((b) => b.is_active).length} live</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="e.g. Today's raid starts at 6:00 PM — don't miss it!"
                  value={newBanner}
                  onChange={(e) => setNewBanner(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addBanner();
                    }
                  }}
                />
                <Button variant="gradient" onClick={addBanner} disabled={!newBanner.trim()}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add Banner
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Banners slide across the top of every member's dashboard. They stay until you deactivate or remove them.
              </p>

              <div className="space-y-2 pt-1">
                {banners.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No banners yet. The banner area shows a clean placeholder on the user side until one is added.
                  </p>
                ) : (
                  banners.map((banner) => (
                    <div key={banner.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                      <span className="w-2 h-2 rounded-full shrink-0 bg-gradient-to-r from-primary to-accent" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{banner.message}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(banner.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={banner.is_active} onCheckedChange={() => toggleBanner(banner)} />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteBanner(banner.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}