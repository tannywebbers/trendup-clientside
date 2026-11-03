import { useState, useEffect, useCallback } from "react";
import { Loader2, Mail, Eye, RefreshCw, XCircle, CheckCircle2, Clock, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsHeader } from "./components/SettingsList";

interface EmailDelivery {
  id: string;
  to: string;
  subject: string;
  template_key: string | null;
  status: string;
  error: string | null;
  opened_at: string | null;
  idempotency_key: string | null;
  created_at: string | null;
}

const STATUS_STYLE: Record<string, { label: string; icon: any; className: string }> = {
  sent: { label: "Sent", icon: CheckCircle2, className: "text-green-600 border-green-600/30" },
  failed: { label: "Failed", icon: XCircle, className: "text-red-600 border-red-600/30" },
  pending: { label: "Pending", icon: Clock, className: "text-yellow-600 border-yellow-600/30" },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminEmailLogs() {
  const [logs, setLogs] = useState<EmailDelivery[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [limit, setLimit] = useState(50);
  const { toast } = useToast();

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = (supabase as any).from("email_deliveries").select("*").order("created_at", { ascending: false }).limit(limit);
      if (statusFilter !== "all") {
        query = (supabase as any).from("email_deliveries").select("*").eq("status", statusFilter).order("created_at", { ascending: false }).limit(limit);
      }
      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
      setHasMore((data?.length || 0) === limit);
    } catch (error) {
      console.error("Error fetching delivery logs:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load delivery logs. Run the email migration first." });
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, limit, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Email Delivery Logs"
        description="Every email sent by the app, with status and open tracking"
        backHref="/baki/stage/admin/settings/email"
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <Inbox className="w-4 h-4 text-muted-foreground" />
              {logs.length} delivery{logs.length === 1 ? "" : "ies"}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchLogs} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No email deliveries yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Recipient</th>
                    <th className="py-2 pr-4 font-medium">Subject</th>
                    <th className="py-2 pr-4 font-medium">Template</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium text-center">Opened</th>
                    <th className="py-2 pr-4 font-medium">Sent at</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => {
                    const st = STATUS_STYLE[log.status] || STATUS_STYLE.pending;
                    const Icon = st.icon;
                    return (
                      <tr key={log.id} className="hover:bg-muted/50">
                        <td className="py-2.5 pr-4 font-medium">{log.to}</td>
                        <td className="py-2.5 pr-4 max-w-[240px] truncate">{log.subject}</td>
                        <td className="py-2.5 pr-4">
                          {log.template_key ? (
                            <Badge variant="outline" className="font-mono text-xs">{log.template_key}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="outline" className={st.className}>
                            <Icon className="w-3 h-3 mr-1" />
                            {st.label}
                          </Badge>
                          {log.error && <p className="text-xs text-destructive mt-0.5 max-w-[180px] truncate">{log.error}</p>}
                        </td>
                        <td className="py-2.5 pr-4 text-center">
                          {log.opened_at ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <Eye className="w-3.5 h-3.5" />
                              {formatDate(log.opened_at)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(log.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => setLimit((l) => l + 50)} disabled={isLoading}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}