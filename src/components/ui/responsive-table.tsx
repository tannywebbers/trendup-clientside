import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveTableRowProps {
  children: React.ReactNode;
  className?: string;
  mobileCard?: React.ReactNode;
}

const ResponsiveTable = React.forwardRef<
  HTMLDivElement,
  ResponsiveTableProps
>(({ className, children, ...props }, ref) => {
  const isMobile = useIsMobile();

  return (
    <div ref={ref} className={cn("w-full", className)} {...props}>
      {children}
    </div>
  );
});
ResponsiveTable.displayName = "ResponsiveTable";

// Desktop table wrapper - hidden on mobile
const DesktopTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => {
  return (
    <div className="hidden md:block relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
});
DesktopTable.displayName = "DesktopTable";

// Mobile cards wrapper - shown only on mobile
const MobileCards = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("md:hidden space-y-3", className)}
      {...props}
    />
  );
});
MobileCards.displayName = "MobileCards";

// Mobile card item
interface MobileCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const MobileCard = React.forwardRef<HTMLDivElement, MobileCardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-card border border-border rounded-lg p-4 space-y-3",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MobileCard.displayName = "MobileCard";

// Mobile card row - label/value pair
interface MobileCardRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  children: React.ReactNode;
}

const MobileCardRow = React.forwardRef<HTMLDivElement, MobileCardRowProps>(
  ({ className, label, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center justify-between gap-2", className)}
        {...props}
      >
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="text-right">{children}</div>
      </div>
    );
  }
);
MobileCardRow.displayName = "MobileCardRow";

// Mobile card header - for main content like user info
const MobileCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-between gap-3 pb-2 border-b border-border", className)}
      {...props}
    />
  );
});
MobileCardHeader.displayName = "MobileCardHeader";

// Mobile card actions
const MobileCardActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-end gap-2 pt-2 border-t border-border", className)}
      {...props}
    />
  );
});
MobileCardActions.displayName = "MobileCardActions";

export {
  ResponsiveTable,
  DesktopTable,
  MobileCards,
  MobileCard,
  MobileCardRow,
  MobileCardHeader,
  MobileCardActions,
};
