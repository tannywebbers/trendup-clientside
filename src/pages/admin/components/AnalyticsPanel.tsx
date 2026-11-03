import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart3, LayoutGrid, Loader2, RefreshCw } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Period,
  getRange,
  fetchPricingRate,
  fetchPlatformStats,
  fetchAnalyticsSeries,
  PlatformStats,
  SeriesBucket,
  nairaToUsd,
} from "../lib/reports";
import { StatCards } from "./StatCards";

const NGX = "var(--muted-foreground)";
const GRID = "var(--border)";
const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
} as const;

export default function AnalyticsPanel() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [view, setView] = useState<"cards" | "charts">("cards");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [series, setSeries] = useState<SeriesBucket[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => getRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const rate = await fetchPricingRate();
      const [statsData, seriesData] = await Promise.all([
        fetchPlatformStats(range.from, range.to, range.prevFrom, range.prevTo, rate),
        fetchAnalyticsSeries(range.from, range.to, rate),
      ]);
      setStats(statsData);
      setSeries(seriesData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load analytics." });
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmtMoney = (naira: number) =>
    currency === "USD"
      ? `$${nairaToUsd(naira).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : `₦${Math.round(naira).toLocaleString()}`;

  const revenueSeries = series.map((b) => ({ ...b, revenue: currency === "USD" ? nairaToUsd(b.revenueNaira) : b.revenueNaira }));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>

        {period === "custom" && (
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-auto" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-auto" />
          </div>
        )}

        <Badge variant="secondary">
          {range.label} · {new Date(range.from).toLocaleDateString()} – {new Date(range.to).toLocaleDateString()}
        </Badge>

        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        <div className="ml-auto flex items-center gap-1 p-1 rounded-lg bg-muted">
          <button
            type="button"
            onClick={() => setView("charts")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "charts" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Charts
          </button>
          <button
            type="button"
            onClick={() => setView("cards")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Tile Card
          </button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : view === "cards" ? (
        <StatCards
          stats={stats}
          currency={currency}
          onToggleCurrency={() => setCurrency((c) => (c === "NGN" ? "USD" : "NGN"))}
          periodLabel={range.label}
        />
      ) : (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="mb-4">
              <h2 className="text-base font-medium">Points Overview</h2>
              <p className="text-sm text-muted-foreground">Streak points purchased vs rewarded (bonuses)</p>
            </div>
            <div className="h-72">
              {series.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">No data in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="purchased" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="rewarded" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} strokeDasharray="4 4" />
                    <XAxis dataKey="label" tick={{ fill: NGX, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: NGX, fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                    <Area type="monotone" dataKey="purchased" name="Purchased (SP)" stroke="#22c55e" fill="url(#purchased)" strokeWidth={2} />
                    <Area type="monotone" dataKey="rewarded" name="Rewarded (SP)" stroke="#06b6d4" fill="url(#rewarded)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium">Ad Revenue</h2>
                <p className="text-sm text-muted-foreground">
                  From boosts & promotions {currency === "USD" ? "in USD" : "in Naira"}
                </p>
              </div>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrency((c) => (c === "NGN" ? "USD" : "NGN"))}>
                {currency}
              </Button>
            </div>
            <div className="h-64">
              {revenueSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">No revenue in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} strokeDasharray="4 4" />
                    <XAxis dataKey="label" tick={{ fill: NGX, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: NGX, fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [fmtMoney(v), n]} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="mb-4">
              <h2 className="text-base font-medium">Growth</h2>
              <p className="text-sm text-muted-foreground">New users vs content submissions</p>
            </div>
            <div className="h-64">
              {series.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">No data in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} strokeDasharray="4 4" />
                    <XAxis dataKey="label" tick={{ fill: NGX, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: NGX, fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                    <Bar dataKey="newUsers" name="New users" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={42} />
                    <Bar dataKey="submissions" name="Submissions" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}