import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  ArrowUpRight,
  CreditCard,
  UserPlus,
  MessageSquare,
  Gift,
  Megaphone,
  Zap,
  CalendarCheck,
  ArrowUpLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchActivities, Activity } from "./lib/reports";
import AnalyticsPanel from "./components/AnalyticsPanel";

const ACTIVITY_ICONS: Record<Activity["kind"], any> = {
  submission: MessageSquare,
  purchase: CreditCard,
  reward: Gift,
  spend: ArrowUpLeft,
  boost: Megaphone,
  raid_post: Zap,
  checkin: CalendarCheck,
  new_user: UserPlus,
};

const ACTIVITY_COLORS: Record<Activity["kind"], string> = {
  submission: "text-blue-500",
  purchase: "text-green-500",
  reward: "text-yellow-500",
  spend: "text-neutral-500",
  boost: "text-purple-500",
  raid_post: "text-orange-500",
  checkin: "text-cyan-500",
  new_user: "text-pink-500",
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

export default function AdminDashboard() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();
      const to = now.toISOString();
      const data = await fetchActivities(from, to, 8);
      setActivities(data);
    } catch (error) {
      console.error("Error fetching activities:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load activities." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform overview — pick a period, compare charts or tile cards</p>
      </div>

      <AnalyticsPanel />

      {/* Recent Activities */}
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Recent Activities</h2>
            <p className="text-sm text-muted-foreground">Latest platform activity (last 30 days)</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/baki/stage/admin/activities">
              View All
              <ArrowUpRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>
        </div>
        <div>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No activity recorded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {activities.map((item) => {
                const Icon = ACTIVITY_ICONS[item.kind];
                return (
                  <div key={item.id} className="flex items-center gap-3 p-4">
                    <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[item.kind]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(item.at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}