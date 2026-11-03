import {
  Bell, Check, CheckCheck, Trash2, X, Gift, AlertCircle, Info, Megaphone,
  Sparkles, Coins, ArrowDownLeft, ArrowUpRight, Flame, Zap, Trophy, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useNotifications, Notification } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

const notificationMeta: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  task_approved: { icon: Check, color: "text-success bg-success/10", label: "Verification passed" },
  task_rejected: { icon: X, color: "text-destructive bg-destructive/10", label: "Submission rejected" },
  task_completed: { icon: CheckCheck, color: "text-success bg-success/10", label: "Task completed" },
  points_earned: { icon: ArrowDownLeft, color: "text-success bg-success/10", label: "Points earned" },
  points_spent: { icon: ArrowUpRight, color: "text-warning bg-warning/10", label: "Points spent" },
  admin_credit: { icon: Gift, color: "text-primary bg-primary/10", label: "Bonus" },
  admin_debit: { icon: Coins, color: "text-warning bg-warning/10", label: "Adjustment" },
  announcement: { icon: Megaphone, color: "text-primary bg-primary/10", label: "Announcement" },
  feature_update: { icon: Sparkles, color: "text-accent bg-accent/10", label: "New feature" },
  checkin: { icon: Flame, color: "text-orange-500 bg-orange-500/10", label: "Check-in" },
  checkin_milestone: { icon: Flame, color: "text-orange-500 bg-orange-500/10", label: "Milestone reached" },
  raid: { icon: Zap, color: "text-purple-500 bg-purple-500/10", label: "Raid" },
  raid_reminder: { icon: Zap, color: "text-purple-500 bg-purple-500/10", label: "Raid reminder" },
  leaderboard: { icon: Trophy, color: "text-yellow-500 bg-yellow-500/10", label: "Leaderboard" },
  referral: { icon: UserPlus, color: "text-blue-500 bg-blue-500/10", label: "Referral" },
  wallet: { icon: Coins, color: "text-success bg-success/10", label: "Wallet" },
  promotion: { icon: Sparkles, color: "text-pink-500 bg-pink-500/10", label: "Promotion" },
  warning: { icon: AlertCircle, color: "text-warning bg-warning/10", label: "Warning" },
  info: { icon: Info, color: "text-muted-foreground bg-muted", label: "Info" },
};

export default function Notifications() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, isLoading } = useNotifications();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            {notifications.length > 0 && ` · ${notifications.length} total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-1.5" /> Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="icon" onClick={clearAll}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Bell className="w-12 h-12 mb-3 opacity-40" />
              <p className="font-medium">No notifications yet</p>
              <p className="text-sm mt-1">Check in, join raids and engage with contents to get started.</p>
            </div>
          ) : (
            <motion.div layout className="divide-y divide-border">
              {notifications.map((n: Notification) => {
                const meta = notificationMeta[n.type] || notificationMeta.info;
                const Icon = meta.icon;
                return (
                  <motion.button
                    key={n.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => markAsRead(n.id)}
                    className={`w-full text-left flex gap-3 p-4 transition-colors hover:bg-muted/50 ${
                      !n.is_read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-px">
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground/70">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className={`text-sm font-medium mt-1 ${n.is_read ? "text-muted-foreground" : ""}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    </div>
                    {!n.is_read && <span className="w-2.5 h-2.5 bg-primary rounded-full mt-1.5 shrink-0" />}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}