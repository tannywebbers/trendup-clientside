import type { ReactNode } from "react";
import {
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  DollarSign,
  Flame,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformStats, pctChange, nairaToUsd } from "../lib/reports";

function Delta({ current, prev }: { current: number; prev: number }) {
  if (current === 0 && prev === 0) return <span className="text-xs text-muted-foreground">no change</span>;
  const pct = pctChange(current, prev);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center text-xs font-semibold ${up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function fmtNaira(naira: number): string {
  return `₦${Math.round(naira).toLocaleString()}`;
}

export function fmtMoneyNairaUsd(naira: number, currency: "NGN" | "USD"): string {
  return currency === "USD"
    ? `$${nairaToUsd(naira).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : fmtNaira(naira);
}

export function StatCards({
  stats,
  currency,
  onToggleCurrency,
  periodLabel,
}: {
  stats: PlatformStats | null;
  currency: "NGN" | "USD";
  onToggleCurrency?: () => void;
  periodLabel?: string;
}) {
  const cards: {
    icon: any;
    label: string;
    value: string;
    color: string;
    sub?: ReactNode;
    action?: ReactNode;
  }[] = [
    {
      icon: Users,
      label: "Total Users",
      value: stats?.totalUsers.toLocaleString() || "0",
      color: "text-blue-500",
      sub: stats ? (
        <span className="text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-0.5 font-semibold text-green-600 dark:text-green-400">
            <UserPlus className="w-3 h-3" /> +{stats.newUsers}
          </span>{" "}
          new in period
        </span>
      ) : null,
    },
    {
      icon: Wallet,
      label: "Points Purchased",
      value: fmtMoneyNairaUsd(stats?.pointsPurchasedNaira || 0, currency),
      color: "text-green-500",
      sub: stats ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Delta current={stats.pointsPurchased} prev={stats.pointsPurchasedPrev} />
          <span className="text-xs text-muted-foreground font-medium">{stats.pointsPurchased.toLocaleString()} SP</span>
        </div>
      ) : null,
    },
    {
      icon: Flame,
      label: "Active Users",
      value: stats?.activeUsers.toLocaleString() || "0",
      color: "text-orange-500",
      sub: <span className="text-xs text-muted-foreground">{periodLabel?.toLowerCase() || "current period"}</span>,
    },
    {
      icon: DollarSign,
      label: "Ad Revenue",
      value: fmtMoneyNairaUsd(stats?.adRevenueNaira || 0, currency),
      color: "text-violet-500",
      sub: stats ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Delta current={stats.adRevenueNaira} prev={stats.adRevenuePrev} />
          <span className="text-xs text-muted-foreground">boosts & promo</span>
        </div>
      ) : null,
      action: onToggleCurrency ? (
        <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={onToggleCurrency}>
          {currency}
        </Button>
      ) : undefined,
    },
    {
      icon: Sparkles,
      label: "Points Rewarded",
      value: stats?.pointsRewarded.toLocaleString() || "0",
      color: "text-cyan-500",
      sub: stats ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Delta current={stats.pointsRewarded} prev={stats.pointsRewardedPrev} />
          <span className="text-xs text-muted-foreground">bonuses</span>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-5 relative">
          {card.action && <div className="absolute top-4 right-4">{card.action}</div>}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-semibold truncate">{card.value}</div>
              <div className="text-sm text-muted-foreground">{card.label}</div>
            </div>
          </div>
          <div className="mt-3">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}