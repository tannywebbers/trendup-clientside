import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  CreditCard,
  Gift,
  ArrowUpLeft,
  Megaphone,
  Zap,
  CalendarCheck,
  UserPlus,
  MessageSquare,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchActivities, Activity as ActivityItem, ActivityKind } from "./lib/reports";

const KIND_META: Record<ActivityKind, { icon: any; color: string; label: string }> = {
  submission: { icon: MessageSquare, color: "text-blue-500", label: "Submissions" },
  purchase: { icon: CreditCard, color: "text-green-500", label: "Purchases" },
  reward: { icon: Gift, color: "text-yellow-500", label: "Rewards" },
  spend: { icon: ArrowUpLeft, color: "text-neutral-500", label: "Spends" },
  boost: { icon: Megaphone, color: "text-purple-500", label: "Boosts" },
  raid_post: { icon: Zap, color: "text-orange-500", label: "Raid posts" },
  checkin: { icon: CalendarCheck, color: "text-cyan-500", label: "Check-ins" },
  new_user: { icon: UserPlus, color: "text-pink-500", label: "New users" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminActivities() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [limit, setLimit] = useState(30);
  const [filter, setFilter] = useState<"all" | ActivityKind>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (per: number) => {
    const data = await fetchActivities(undefined, undefined, per);
    if (mounted.current) setItems(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    load(limit).finally(() => {
      if (mounted.current) setLoading(false);
    });
  }, [limit, load]);

  const loadMore = async () => {
    setLoadingMore(true);
    const next = limit + 30;
    await load(next);
    setLimit(next);
    if (mounted.current) setLoadingMore(false);
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.kind === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Recent Activities</h1>
          <p className="text-sm text-muted-foreground">Full activity log across the platform</p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as "all" | ActivityKind)}>
          <SelectTrigger className="w-48">
            <Activity className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All activities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activities</SelectItem>
            <SelectItem value="submission">Submissions</SelectItem>
            <SelectItem value="purchase">Purchases</SelectItem>
            <SelectItem value="reward">Rewards</SelectItem>
            <SelectItem value="spend">Spends</SelectItem>
            <SelectItem value="boost">Boosts</SelectItem>
            <SelectItem value="raid_post">Raid posts</SelectItem>
            <SelectItem value="checkin">Check-ins</SelectItem>
            <SelectItem value="new_user">New users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-16 text-center">No activities to show.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((item) => {
              const meta = KIND_META[item.kind];
              const Icon = meta.icon;
              return (
                <div key={item.id} className="flex items-center gap-3 p-4">
                  <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 ${meta.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                      {meta.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(item.at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}