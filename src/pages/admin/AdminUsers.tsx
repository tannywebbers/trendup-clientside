import { useState, useEffect } from "react";
import { 
  Users, 
  Search,
  Coins,
  Loader2,
  CheckCircle,
  XCircle
} from "lucide-react";
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
} from "@/components/ui/responsive-table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface User {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  tiktok_username: string;
  tik_points: number;
  created_at: string;
  avatar_url: string | null;
  is_banned: boolean;
}

function Avatar({ user, className = "" }: { user: User; className?: string }) {
  const emoji = user.avatar_url && /\p{Emoji}/u.test(user.avatar_url) ? user.avatar_url : null;
  return (
    <div className={`rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm shrink-0 ${className}`}>
      {emoji ? emoji : (user.first_name?.[0] || user.email[0]).toUpperCase()}
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "moderator"]);

      const adminModeratorIds = new Set((rolesData || []).map(r => r.user_id));

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const regularUsers = (data || []).filter(user => !adminModeratorIds.has(user.user_id));
      setUsers(regularUsers as User[]);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load users." });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.tiktok_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.first_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openUser = (user: User) => navigate(`/baki/stage/admin/users/${user.user_id}`);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} registered users</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by username, name or email..."
            className="pl-10 w-72"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-foreground">Username</TableHead>
                <TableHead className="text-foreground">Email</TableHead>
                <TableHead className="text-foreground">Balance</TableHead>
                <TableHead className="text-foreground">Status</TableHead>
                <TableHead className="text-foreground">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => (
                <TableRow
                  key={user.id}
                  className={`border-border hover:bg-muted/50 cursor-pointer ${user.is_banned ? 'opacity-60' : ''}`}
                  onClick={() => openUser(user)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar user={user} className="w-9 h-9" />
                      <span className="font-medium text-foreground">
                        @{user.tiktok_username || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      className="text-muted-foreground hover:text-primary hover:underline text-left"
                      onClick={(e) => { e.stopPropagation(); openUser(user); }}
                    >
                      {user.email}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <Coins className="w-3 h-3" /> {user.tik_points}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.is_banned ? (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="w-3 h-3" /> Banned
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-green-700 text-green-500">
                        <CheckCircle className="w-3 h-3" /> Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <MobileCards className="p-4">
          {filteredUsers.map(user => (
            <MobileCard key={user.id} className={`cursor-pointer ${user.is_banned ? 'opacity-60' : ''}`} onClick={() => openUser(user)}>
              <MobileCardHeader>
                <div className="flex items-center gap-3">
                  <Avatar user={user} className="w-10 h-10" />
                  <div>
                    <div className="font-medium text-foreground">@{user.tiktok_username || "—"}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
                {user.is_banned ? (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" /> Banned
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-green-700 text-green-500">
                    <CheckCircle className="w-3 h-3" /> Active
                  </Badge>
                )}
              </MobileCardHeader>
              <MobileCardRow label="Balance">
                <Badge variant="outline" className="gap-1">
                  <Coins className="w-3 h-3" /> {user.tik_points}
                </Badge>
              </MobileCardRow>
              <MobileCardRow label="Joined">
                <span className="text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</span>
              </MobileCardRow>
            </MobileCard>
          ))}
        </MobileCards>
      </div>
    </div>
  );
}