import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  Mail,
  Shield,
  Trash2,
  Loader2,
  Eye,
  Ban,
  Check,
  ChevronRight,
  Clock,
  RefreshCw,
  Activity,
  DollarSign,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  MobileCards,
  MobileCard,
  MobileCardRow,
  MobileCardHeader,
  MobileCardActions,
} from "@/components/ui/responsive-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

interface Moderator {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  pages: string[];
  can_manage_chat: boolean;
  can_review_submissions: boolean;
  can_manage_users: boolean;
  can_credit_users: boolean;
  is_suspended: boolean;
  suspend_reason: string | null;
  invited_at: string;
}

interface ActivityLog {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const AVAILABLE_PAGES = [
  { key: "dashboard", label: "Dashboard", description: "View platform statistics" },
  { key: "submissions", label: "Submissions", description: "Review task submissions" },
  { key: "users", label: "Users", description: "Manage user accounts" },
  { key: "analytics", label: "Analytics", description: "View analytics and reports" },
  { key: "raid", label: "Raid Manager", description: "Manage raid sessions" },
  { key: "leaderboard", label: "Leaderboards", description: "View leaderboard rewards" },
  { key: "activities", label: "Activities", description: "View admin activity logs" },
  { key: "live-chats", label: "Live Chats", description: "Respond to user support" },
  { key: "communications", label: "Communications", description: "Broadcast & announcements" },
  { key: "ai-config", label: "AI Config", description: "Configure AI settings" },
  { key: "prompts", label: "AI Prompts", description: "Manage verification prompts" },
  { key: "visual-editor", label: "Visual Editor", description: "Edit landing pages" },
  { key: "landing", label: "Landing CMS", description: "Manage landing page content" },
  { key: "app-settings", label: "App Settings", description: "Platform configuration" },
  { key: "email", label: "Email Config", description: "Email settings" },
  { key: "ads", label: "Ads Settings", description: "Advertisement configuration" },
];

// Staff roles (mirrors TrendUp: owner, administrator, moderator, support, finance, user)
const STAFF_ROLES = [
  { value: "moderator", label: "Moderator", description: "Standard staff with page-based access" },
  { value: "administrator", label: "Administrator", description: "Elevated staff with full page access" },
  { value: "support", label: "Support", description: "Support-focused staff (chat + activity access)" },
  { value: "finance", label: "Finance", description: "Finance staff (users + analytics access)" },
  { value: "owner", label: "Owner", description: "Full platform owner access" },
];

export default function AdminModerators() {
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [selectedModerator, setSelectedModerator] = useState<Moderator | null>(null);
  const [addStep, setAddStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Activity logs
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Add form state
  const [newModEmail, setNewModEmail] = useState("");
  const [newModPassword, setNewModPassword] = useState("");
  const [newModRole, setNewModRole] = useState("moderator");
  const [selectedPages, setSelectedPages] = useState<string[]>(["dashboard", "live-chats"]);
  const [canCreditUsers, setCanCreditUsers] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  
  // Edit state
  const [editPages, setEditPages] = useState<string[]>([]);
  const [editCanCreditUsers, setEditCanCreditUsers] = useState(false);
  const [editRole, setEditRole] = useState("moderator");
  
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchModerators();
  }, []);

  useEffect(() => {
    if (selectedModerator && showViewDialog) {
      fetchActivityLogs(selectedModerator.user_id);
    }
  }, [selectedModerator, showViewDialog]);

  const fetchModerators = async () => {
    setIsLoading(true);
    try {
      const { data: permissionsData, error: permError } = await supabase
        .from("moderator_permissions")
        .select("*");

      if (permError) throw permError;

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, email, first_name, last_name");

      const { data: rolesData } = await (supabase as any)
        .from("user_roles")
        .select("user_id, role")
        .in("role", STAFF_ROLES.map((r) => r.value));

      const roleMap = new Map<string, string>();
      (rolesData || []).forEach((r: { user_id: string; role: string }) => {
        // Last write wins — prefer elevated roles for display
        roleMap.set(r.user_id, r.role);
      });

      const mods: Moderator[] = (permissionsData || []).map(perm => {
        const profile = profilesData?.find(p => p.user_id === perm.user_id);
        return {
          id: perm.id,
          user_id: perm.user_id,
          email: profile?.email || "Unknown",
          first_name: profile?.first_name,
          last_name: profile?.last_name,
          role: roleMap.get(perm.user_id) || null,
          pages: perm.pages || [],
          can_manage_chat: perm.can_manage_chat,
          can_review_submissions: perm.can_review_submissions,
          can_manage_users: perm.can_manage_users,
          can_credit_users: false, // Will be managed separately
          is_suspended: perm.is_suspended,
          suspend_reason: perm.suspend_reason,
          invited_at: perm.invited_at,
        };
      });

      setModerators(mods);
    } catch (error) {
      console.error("Error fetching moderators:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load moderators." });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivityLogs = async (moderatorId: string) => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("moderator_activity_logs")
        .select("*")
        .eq("moderator_id", moderatorId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setActivityLogs((data || []) as ActivityLog[]);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      setActivityLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleAddModerator = async () => {
    if (!newModEmail || !newModPassword) {
      toast({ variant: "destructive", title: "Error", description: "Email and password are required." });
      return;
    }

    if (newModPassword.length < 6) {
      toast({ variant: "destructive", title: "Error", description: "Password must be at least 6 characters." });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: createData, error: createError } = await supabase.functions.invoke("create-moderator", {
        body: {
          email: newModEmail,
          password: newModPassword,
          role: newModRole,
          pages: selectedPages,
          invited_by: user?.id,
        },
      });

      if (createError) throw createError;

      if (createData?.error) {
        throw new Error(createData.error);
      }

      toast({ title: "Success!", description: "Moderator created and invitation sent." });
      setShowAddDialog(false);
      resetAddForm();
      fetchModerators();
    } catch (error: unknown) {
      console.error("Error creating moderator:", error);
      const message = error instanceof Error ? error.message : "Failed to create moderator.";
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateModerator = async () => {
    if (!selectedModerator) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("moderator_permissions")
        .update({
          pages: editPages,
          can_manage_users: editCanCreditUsers, // We'll use can_manage_users for credit permission
        })
        .eq("id", selectedModerator.id);

      if (error) throw error;

      // Update role (user_roles) if it changed
      if (editRole !== (selectedModerator.role || "moderator")) {
        const { error: deleteRoleError } = await (supabase as any)
          .from("user_roles")
          .delete()
          .eq("user_id", selectedModerator.user_id)
          .in("role", STAFF_ROLES.map((r) => r.value));
        if (deleteRoleError) throw deleteRoleError;

        const { error: insertRoleError } = await (supabase as any)
          .from("user_roles")
          .insert({ user_id: selectedModerator.user_id, role: editRole });
        if (insertRoleError) throw insertRoleError;
      }

      toast({ title: "Success!", description: "Moderator permissions updated." });
      setShowEditDialog(false);
      fetchModerators();
    } catch (error) {
      console.error("Error updating moderator:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update moderator." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuspendModerator = async () => {
    if (!selectedModerator) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("moderator_permissions")
        .update({
          is_suspended: !selectedModerator.is_suspended,
          suspended_at: selectedModerator.is_suspended ? null : new Date().toISOString(),
          suspend_reason: selectedModerator.is_suspended ? null : suspendReason,
        })
        .eq("id", selectedModerator.id);

      if (error) throw error;

      toast({ 
        title: "Success!", 
        description: selectedModerator.is_suspended ? "Moderator reinstated." : "Moderator suspended." 
      });
      setShowSuspendDialog(false);
      setSuspendReason("");
      fetchModerators();
    } catch (error) {
      console.error("Error updating moderator:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update moderator." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteModerator = async (mod: Moderator) => {
    if (!confirm("Are you sure you want to remove this moderator? They will lose all moderator privileges.")) {
      return;
    }

    try {
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", mod.user_id)
        .eq("role", "moderator");

      await supabase
        .from("moderator_permissions")
        .delete()
        .eq("id", mod.id);

      toast({ title: "Success!", description: "Moderator removed." });
      fetchModerators();
    } catch (error) {
      console.error("Error deleting moderator:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to remove moderator." });
    }
  };

  const openEditDialog = (mod: Moderator) => {
    setSelectedModerator(mod);
    setEditPages([...mod.pages]);
    setEditCanCreditUsers(mod.can_manage_users);
    setEditRole(mod.role || "moderator");
    setShowEditDialog(true);
  };

  const resetAddForm = () => {
    setNewModEmail("");
    setNewModPassword("");
    setNewModRole("moderator");
    setSelectedPages(["dashboard", "live-chats"]);
    setCanCreditUsers(false);
    setAddStep(1);
  };

  const filteredModerators = moderators.filter(mod =>
    mod.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `${mod.first_name} ${mod.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatActivityAction = (action: string) => {
    const actionMap: Record<string, string> = {
      'chat_reply': 'Replied to chat',
      'submission_review': 'Reviewed submission',
      'user_ban': 'Banned user',
      'user_unban': 'Unbanned user',
      'notification_sent': 'Sent notification',
      'login': 'Logged in',
      'logout': 'Logged out',
    };
    return actionMap[action] || action;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Moderators</h1>
          <p className="text-sm text-muted-foreground">Manage moderator accounts and permissions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchModerators} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Moderator
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search moderators..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Moderators Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Shield className="w-5 h-5 text-foreground" />
            <span>Active Moderators</span>
          </CardTitle>
          <CardDescription>List of all moderators with their permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredModerators.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No moderators found</p>
              <p className="text-sm">Add your first moderator to get started</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Moderator</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pages Access</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredModerators.map(mod => (
                      <TableRow key={mod.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Shield className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {mod.first_name ? `${mod.first_name} ${mod.last_name || ""}` : "Pending Setup"}
                              </p>
                              <p className="text-sm text-muted-foreground">{mod.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {mod.role || "moderator"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mod.is_suspended ? (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="w-3 h-3" /> Suspended
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-green-600 text-green-500">
                              <Check className="w-3 h-3" /> Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {mod.pages.slice(0, 3).map(page => (
                              <Badge key={page} variant="outline" className="text-xs">
                                {page}
                              </Badge>
                            ))}
                            {mod.pages.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{mod.pages.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(mod.invited_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedModerator(mod);
                                setShowViewDialog(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditDialog(mod)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedModerator(mod);
                                setShowSuspendDialog(true);
                              }}
                            >
                              <Ban className={`w-4 h-4 ${mod.is_suspended ? "text-green-500" : "text-yellow-500"}`} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteModerator(mod)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <MobileCards>
                {filteredModerators.map(mod => (
                  <MobileCard key={mod.id}>
                    <MobileCardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {mod.first_name ? `${mod.first_name} ${mod.last_name || ""}` : "Pending Setup"}
                          </p>
                          <p className="text-sm text-muted-foreground">{mod.email}</p>
                        </div>
                      </div>
                      {mod.is_suspended ? (
                        <Badge variant="destructive" className="gap-1">
                          <Ban className="w-3 h-3" /> Suspended
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-green-600 text-green-500">
                          <Check className="w-3 h-3" /> Active
                        </Badge>
                      )}
                    </MobileCardHeader>
                    
                    <MobileCardRow label="Pages Access">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {mod.pages.slice(0, 2).map(page => (
                          <Badge key={page} variant="outline" className="text-xs">
                            {page}
                          </Badge>
                        ))}
                        {mod.pages.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{mod.pages.length - 2}
                          </Badge>
                        )}
                      </div>
                    </MobileCardRow>
                    <MobileCardRow label="Invited">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(mod.invited_at).toLocaleDateString()}
                      </div>
                    </MobileCardRow>
                    
                    <MobileCardActions>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedModerator(mod);
                          setShowViewDialog(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(mod)}
                      >
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={mod.is_suspended ? "text-green-500" : "text-yellow-500"}
                        onClick={() => {
                          setSelectedModerator(mod);
                          setShowSuspendDialog(true);
                        }}
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => handleDeleteModerator(mod)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </MobileCardActions>
                  </MobileCard>
                ))}
              </MobileCards>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Moderator Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) { resetAddForm(); } setShowAddDialog(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Moderator</DialogTitle>
            <DialogDescription>
              {addStep === 1 ? "Enter the moderator's login credentials" : "Select which pages they can access"}
            </DialogDescription>
          </DialogHeader>

          {addStep === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="moderator@example.com"
                    value={newModEmail}
                    onChange={(e) => setNewModEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newModPassword}
                  onChange={(e) => setNewModPassword(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg border border-border">
                <Label className="mb-2 block">Role</Label>
                <Select value={newModRole} onValueChange={setNewModRole}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label} — {role.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-[280px] pr-4">
                <div className="space-y-3">
                  {AVAILABLE_PAGES.map(page => (
                    <div
                      key={page.key}
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedPages.includes(page.key) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        if (selectedPages.includes(page.key)) {
                          setSelectedPages(selectedPages.filter(p => p !== page.key));
                        } else {
                          setSelectedPages([...selectedPages, page.key]);
                        }
                      }}
                    >
                      <Checkbox
                        checked={selectedPages.includes(page.key)}
                        onCheckedChange={() => {}}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{page.label}</p>
                        <p className="text-sm text-muted-foreground">{page.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Can Credit/Debit Users</p>
                    <p className="text-sm text-muted-foreground">Allow managing user points</p>
                  </div>
                </div>
                <Switch
                  checked={canCreditUsers}
                  onCheckedChange={setCanCreditUsers}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {addStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => setAddStep(2)}
                  disabled={!newModEmail || !newModPassword}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAddStep(1)}>
                  Back
                </Button>
                <Button onClick={handleAddModerator} disabled={isSubmitting || selectedPages.length === 0}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    "Create Moderator"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Moderator Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Moderator Permissions</DialogTitle>
            <DialogDescription>
              Update page access and permissions for {selectedModerator?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-border">
              <Label className="mb-2 block">Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label} — {role.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-3">
                {AVAILABLE_PAGES.map(page => (
                  <div
                    key={page.key}
                    className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      editPages.includes(page.key) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      if (editPages.includes(page.key)) {
                        setEditPages(editPages.filter(p => p !== page.key));
                      } else {
                        setEditPages([...editPages, page.key]);
                      }
                    }}
                  >
                    <Checkbox
                      checked={editPages.includes(page.key)}
                      onCheckedChange={() => {}}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{page.label}</p>
                      <p className="text-sm text-muted-foreground">{page.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Can Credit/Debit Users</p>
                  <p className="text-sm text-muted-foreground">Allow managing user points</p>
                </div>
              </div>
              <Switch
                checked={editCanCreditUsers}
                onCheckedChange={setEditCanCreditUsers}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateModerator} disabled={isSubmitting || editPages.length === 0}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Moderator Dialog with Activity Logs */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Moderator Details</DialogTitle>
          </DialogHeader>
          {selectedModerator && (
            <Tabs defaultValue="details" className="w-full flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="activity">Activity Logs</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4 mt-4 overflow-auto">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedModerator.first_name 
                        ? `${selectedModerator.first_name} ${selectedModerator.last_name || ""}` 
                        : "Pending Setup"}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedModerator.email}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  {selectedModerator.is_suspended ? (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="font-medium text-destructive">Suspended</p>
                      {selectedModerator.suspend_reason && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Reason: {selectedModerator.suspend_reason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="border-green-600 text-green-500">Active</Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Page Access</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedModerator.pages.map(page => (
                      <Badge key={page} variant="secondary">{page}</Badge>
                    ))}
                    {selectedModerator.pages.length === 0 && (
                      <span className="text-sm text-muted-foreground">No pages assigned</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Invited On</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedModerator.invited_at).toLocaleString()}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-4 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <Label>Recent Activity</Label>
                </div>
                
                {loadingLogs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No activity recorded yet</p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="space-y-3 pr-4">
                      {activityLogs.map(log => (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                          <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                          <div className="flex-1">
                            <p className="font-medium text-sm text-foreground">{formatActivityAction(log.action)}</p>
                            {log.target_type && (
                              <p className="text-xs text-muted-foreground">
                                {log.target_type}: {log.target_id}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(log.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedModerator?.is_suspended ? "Reinstate Moderator" : "Suspend Moderator"}
            </DialogTitle>
            <DialogDescription>
              {selectedModerator?.is_suspended 
                ? "This will restore their access to the admin panel."
                : "This will prevent them from accessing the admin panel."}
            </DialogDescription>
          </DialogHeader>

          {selectedModerator && !selectedModerator.is_suspended && (
            <div className="space-y-2">
              <Label>Reason for Suspension (optional)</Label>
              <Textarea
                placeholder="Enter reason..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspendDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant={selectedModerator?.is_suspended ? "default" : "destructive"}
              onClick={handleSuspendModerator}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {selectedModerator?.is_suspended ? "Reinstate" : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
