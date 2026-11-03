import { supabase } from "@/integrations/supabase/client";

export type Period = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export interface Range {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  label: string;
}

const DAY = 86_400_000;

export function getRange(period: Period, customFrom: string, customTo: string): Range {
  const now = new Date();
  let from: Date;
  let to: Date;
  const effective: Period = period === "custom" && (!customFrom || !customTo) ? "monthly" : period;
  if (effective === "custom" && customFrom && customTo) {
    from = new Date(`${customFrom}T00:00:00`);
    to = new Date(`${customTo}T23:59:59.999`);
  } else {
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    if (effective === "daily") {
      from = new Date(to.getTime() - DAY);
    } else if (effective === "weekly") {
      from = new Date(to.getTime() - 7 * DAY);
    } else if (effective === "monthly") {
      from = new Date(to.getTime() - 30 * DAY);
    } else {
      from = new Date(to.getTime() - 365 * DAY);
    }
  }
  const span = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - span);
  const prevTo = from;
  const labels: Record<Period, string> = {
    daily: "Today",
    weekly: "Last 7 days",
    monthly: "Last 30 days",
    yearly: "Last 365 days",
    custom: "Custom range",
  };
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    prevFrom: prevFrom.toISOString(),
    prevTo: prevTo.toISOString(),
    label: labels[period],
  };
}

export async function fetchPricingRate(): Promise<number> {
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "pricing_settings")
      .maybeSingle();
    const v: any = (data as any)?.value || {};
    const pa = Number(v.points_amount) || 10;
    const ca = Number(v.currency_amount) || 5;
    return ca / pa;
  } catch {
    return 0.5;
  }
}

const REWARD_RE = /welcome|check-?in|milestone|leaderboard|referral|admin|bonus/i;
const BOOST_RE = /boost|promotion|promote/i;

function isReward(type: string, description: string | null): boolean {
  return (
    type.startsWith("bonus") ||
    type.includes("welcome") ||
    type.includes("checkin") ||
    type.startsWith("leaderboard") ||
    type.startsWith("referral_commission") ||
    type.startsWith("admin_credit") ||
    type === "promotion" ||
    (description !== null && REWARD_RE.test(description))
  );
}

export interface PlatformStats {
  totalUsers: number;
  newUsers: number;
  pointsPurchased: number;
  pointsPurchasedNaira: number;
  pointsPurchasedPrev: number;
  pointsPurchasedNairaPrev: number;
  adRevenueNaira: number;
  adRevenuePrev: number;
  activeUsers: number;
  pointsRewarded: number;
  pointsRewardedPrev: number;
}

interface Tx {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string | null;
}

async function fetchTxs(from: string, to: string): Promise<(Tx & { created_at: string })[]> {
  const { data } = await (supabase as any)
    .from("transactions")
    .select("id, user_id, amount, type, description, created_at")
    .gte("created_at", from)
    .lt("created_at", to)
    .limit(20000);
  return (data as (Tx & { created_at: string })[]) || [];
}

export async function fetchPlatformStats(
  from: string,
  to: string,
  prevFrom: string,
  prevTo: string,
  nairaPerPoint: number
): Promise<PlatformStats> {
  const [adminRoles, txs, prevTxs, totalCount, newCount, subs, raids, boostRows, checkins] = await Promise.all([
    supabase.from("user_roles").select("user_id").in("role", ["admin", "moderator"]),
    fetchTxs(from, to),
    fetchTxs(prevFrom, prevTo),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", from)
      .lt("created_at", to),
    (supabase as any).from("task_submissions").select("user_id").gte("created_at", from).lt("created_at", to),
    (supabase as any).from("raid_posts").select("user_id").gte("created_at", from).lt("created_at", to),
    (supabase as any).from("post_boosts").select("creator_id as user_id").gte("created_at", from).lt("created_at", to),
    (supabase as any).from("daily_checkins").select("user_id").gte("created_at", from).lt("created_at", to),
  ]);

  const adminIds = new Set((adminRoles.data || []).map((r: any) => r.user_id));
  const purchases = (list: Tx[]) =>
    list.reduce((sum, t) => (t.type === "purchase" && t.amount > 0 ? sum + t.amount : sum), 0);
  const rewards = (list: Tx[]) =>
    list.reduce((sum, t) => (t.amount > 0 && isReward(t.type, t.description) ? sum + t.amount : sum), 0);
  const boosts = (list: Tx[]) =>
    list.reduce((sum, t) => (t.type === "spend" && t.amount < 0 && t.description && BOOST_RE.test(t.description) ? sum + Math.abs(t.amount) : sum), 0);

  const activeIds = new Set<string>();
  [subs, raids, boostRows, checkins].forEach((res: any) => {
    (res.data || []).forEach((r: any) => r.user_id && activeIds.add(r.user_id));
  });

  const pointsPurchased = purchases(txs);
  const pointsPurchasedPrev = purchases(prevTxs);
  const adRevenueNaira = boosts(txs) * nairaPerPoint;
  const adRevenuePrev = boosts(prevTxs) * nairaPerPoint;

  return {
    totalUsers: Math.max(0, (totalCount.count || 0) - adminIds.size),
    newUsers: newCount.count || 0,
    pointsPurchased,
    pointsPurchasedNaira: pointsPurchased * nairaPerPoint,
    pointsPurchasedPrev,
    pointsPurchasedNairaPrev: pointsPurchasedPrev * nairaPerPoint,
    adRevenueNaira,
    adRevenuePrev,
    activeUsers: activeIds.size,
    pointsRewarded: rewards(txs),
    pointsRewardedPrev: rewards(prevTxs),
  };
}

export type ActivityKind =
  | "submission"
  | "purchase"
  | "reward"
  | "spend"
  | "boost"
  | "raid_post"
  | "checkin"
  | "new_user";

export interface Activity {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  at: string;
}

export async function fetchActivities(from?: string, to?: string, per = 10): Promise<Activity[]> {
  const range = (q: any) => (from && to ? q.gte("created_at", from).lt("created_at", to) : q);

  const [subs, txs, raids, boostsRes, checks, newProfiles] = await Promise.all([
    range((supabase as any).from("task_submissions").select("id, user_id, status, created_at").limit(per)).order("created_at", { ascending: false }),
    range((supabase as any).from("transactions").select("id, user_id, amount, type, description, created_at").limit(per)).order("created_at", { ascending: false }),
    range((supabase as any).from("raid_posts").select("id, user_id, post_url, created_at").limit(per)).order("created_at", { ascending: false }),
    range((supabase as any).from("post_boosts").select("id, creator_id as user_id, plan_days, created_at").limit(per)).order("created_at", { ascending: false }),
    range((supabase as any).from("daily_checkins").select("id, user_id, created_at").limit(per)).order("created_at", { ascending: false }),
    range((supabase as any).from("profiles").select("id, user_id, tiktok_username, created_at").limit(per)).order("created_at", { ascending: false }),
  ]);

  const userIds = new Set<string>();
  const push = (rows: any[]) => rows.forEach((r: any) => r.user_id && userIds.add(r.user_id));
  push((subs.data as any) || []);
  push((txs.data as any) || []);
  push((raids.data as any) || []);
  push((boostsRes.data as any) || []);
  push((checks.data as any) || []);
  push((newProfiles.data as any) || []);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, tiktok_username")
    .in("user_id", userIds.size ? Array.from(userIds) : ["__none__"]);
  const names: Record<string, string> = {};
  (profiles || []).forEach((p: any) => { names[p.user_id] = p.tiktok_username; });
  const uname = (id: string) => names[id] || "member";

  const out: Activity[] = [];

  ((subs.data as any) || []).forEach((s: any) => {
    out.push({
      id: `sub-${s.id}`,
      kind: "submission",
      title: `@${uname(s.user_id)} submitted a post`,
      detail: s.status === "approved" ? "Approved" : s.status === "rejected" ? "Rejected" : "Pending review",
      at: s.created_at,
    });
  });

  ((txs.data as any) || []).forEach((t: any) => {
    const abs = Math.abs(t.amount);
    let item: Activity;
    if (t.type === "purchase") {
      item = { id: `tx-${t.id}`, kind: "purchase", title: `@${uname(t.user_id)} purchased points`, detail: `${abs.toLocaleString()} SP`, at: t.created_at };
    } else if (t.type === "spend" && t.description && BOOST_RE.test(t.description)) {
      item = { id: `tx-${t.id}`, kind: "boost", title: `@${uname(t.user_id)} boosted a post`, detail: `${abs.toLocaleString()} SP`, at: t.created_at };
    } else if (t.amount > 0 && isReward(t.type, t.description)) {
      item = { id: `tx-${t.id}`, kind: "reward", title: `@${uname(t.user_id)} earned points`, detail: t.description || `${abs.toLocaleString()} SP`, at: t.created_at };
    } else {
      item = { id: `tx-${t.id}`, kind: "spend", title: `@${uname(t.user_id)} spent points`, detail: `${abs.toLocaleString()} SP`, at: t.created_at };
    }
    out.push(item);
  });

  ((raids.data as any) || []).forEach((r: any) => {
    out.push({
      id: `raid-${r.id}`,
      kind: "raid_post",
      title: `@${uname(r.user_id)} submitted a raid post`,
      detail: r.post_url,
      at: r.created_at,
    });
  });

  ((boostsRes.data as any) || []).forEach((b: any) => {
    out.push({
      id: `boost-${b.id}`,
      kind: "boost",
      title: `@${uname(b.user_id)} boosted a post`,
      detail: `${b.plan_days}-day boost`,
      at: b.created_at,
    });
  });

  ((checks.data as any) || []).forEach((c: any) => {
    out.push({
      id: `check-${c.id}`,
      kind: "checkin",
      title: `@${uname(c.user_id)} checked in`,
      detail: "Daily check-in",
      at: c.created_at,
    });
  });

  ((newProfiles.data as any) || []).forEach((p: any) => {
    out.push({
      id: `user-${p.id}`,
      kind: "new_user",
      title: `${p.tiktok_username ? `@${p.tiktok_username}` : "A new member"} joined`,
      detail: "New sign-up",
      at: p.created_at,
    });
  });

  return out
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, per);
}

export function pctChange(current: number, prev: number): number {
  if (prev <= 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}

export interface SeriesBucket {
  label: string;
  purchased: number;
  rewarded: number;
  revenueNaira: number;
  newUsers: number;
  submissions: number;
}

export async function fetchAnalyticsSeries(
  from: string,
  to: string,
  nairaPerPoint: number
): Promise<SeriesBucket[]> {
  const [txs, profiles, subs] = await Promise.all([
    fetchTxs(from, to),
    supabase
      .from("profiles")
      .select("id, created_at")
      .gte("created_at", from)
      .lt("created_at", to)
      .limit(20000),
    (supabase as any)
      .from("task_submissions")
      .select("id, created_at")
      .gte("created_at", from)
      .lt("created_at", to)
      .limit(20000),
  ]);

  const span = new Date(to).getTime() - new Date(from).getTime();
  const DAY = 86_400_000;
  const WEEK = 7 * DAY;
  const bucketMs = span <= 32 * DAY ? DAY : span <= 26 * WEEK ? WEEK : 30 * DAY;
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const fmtMonth = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });

  const buckets = new Map<number, SeriesBucket>();
  const idx = (t: string) => Math.floor(new Date(t).getTime() / bucketMs) * bucketMs;
  const labelFor = (start: number) => (bucketMs === 30 * DAY ? fmtMonth.format(start) : fmt.format(start));
  const getBucket = (t: string) => {
    const start = idx(t);
    let b = buckets.get(start);
    if (!b) {
      b = { label: labelFor(start), purchased: 0, rewarded: 0, revenueNaira: 0, newUsers: 0, submissions: 0 };
      buckets.set(start, b);
    }
    return b;
  };

  txs.forEach((t) => {
    const b = getBucket(t.created_at);
    if (t.type === "purchase" && t.amount > 0) b.purchased += t.amount;
    else if (t.amount > 0 && isReward(t.type, t.description)) b.rewarded += t.amount;
    else if (t.type === "spend" && t.amount < 0 && t.description && BOOST_RE.test(t.description)) {
      b.revenueNaira += Math.abs(t.amount) * nairaPerPoint;
    }
  });

  (profiles.data || []).forEach((p: any) => getBucket(p.created_at).newUsers += 1);
  ((subs.data as any) || []).forEach((s: any) => getBucket(s.created_at).submissions += 1);

  return Array.from(buckets.values()).sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
}

export function nairaToUsd(naira: number): number {
  return naira / 1500;
}