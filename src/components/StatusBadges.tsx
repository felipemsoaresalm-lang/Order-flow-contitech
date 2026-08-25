import { cn } from "@/lib/utils";
import { toneClass, type ItemStatus, type OrderStatus } from "@/lib/domain";
import { itemStatusLabels, itemStatusTone, orderStatusDisplay } from "@/lib/domain";

export function ItemStatusBadge({ status, className }: { status: ItemStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[itemStatusTone[status]],
        className,
      )}
    >
      {itemStatusLabels[status]}
    </span>
  );
}

export function OrderStatusBadge({
  status,
  sapInserted,
  className,
}: {
  status: OrderStatus;
  sapInserted?: boolean;
  className?: string;
}) {
  const { label, tone } = orderStatusDisplay(status, sapInserted);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function AgingBadge({ days, limit }: { days: number; limit: number }) {
  const late = days >= limit;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        late ? "border-destructive/40 bg-destructive/12 text-destructive" : "border-border bg-muted text-muted-foreground",
      )}
    >
      {days === 0 ? "hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`}
    </span>
  );
}
