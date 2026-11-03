import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface SettingsListItem {
  label: string;
  description?: string;
  href: string;
  icon?: any;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

export function SettingsHeader({
  title,
  description,
  backHref,
}: {
  title: string;
  description?: string;
  backHref: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" asChild>
        <Link to={backHref} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: SettingsListItem }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors"
    >
      {Icon ? (
        <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0 text-primary">
          <Icon className="w-5 h-5" />
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{item.label}</p>
          {item.badge && (
            <Badge variant={item.badgeVariant || "secondary"} className="shrink-0">
              {item.badge}
            </Badge>
          )}
        </div>
        {item.description && <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>}
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
    </Link>
  );
}

export function SettingsList({
  items,
  className = "",
}: {
  items: SettingsListItem[];
  className?: string;
}) {
  return (
    <>
      {/* Mobile: compact list */}
      <div className={`sm:hidden space-y-3 ${className}`}>
        {items.map((item) => (
          <ItemCard key={item.href} item={item} />
        ))}
      </div>
      {/* Desktop: cards grid */}
      <div className={`hidden sm:grid sm:grid-cols-2 xl:grid-cols-3 gap-4 ${className}`}>
        {items.map((item) => (
          <ItemCard key={item.href} item={item} />
        ))}
      </div>
    </>
  );
}