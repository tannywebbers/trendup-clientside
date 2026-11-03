import AnalyticsPanel from "./components/AnalyticsPanel";

export default function AdminAnalytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Charts and metrics for the selected period</p>
      </div>
      <AnalyticsPanel />
    </div>
  );
}