import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { HE_MONTHS, HE_WEEKDAYS_SHORT, firstWeekday, isoDate, israelToday } from "@/lib/time";

type Props = {
  year: number;
  month: number;
  selected?: string | null;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect: (iso: string) => void;
  renderBadges?: (iso: string) => ReactNode;
};

export function MonthCalendar({
  year,
  month,
  selected,
  loading,
  onPrev,
  onNext,
  onToday,
  onSelect,
  renderBadges,
}: Props) {
  const lead = firstWeekday(year, month);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = israelToday();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => isoDate(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="חודש קודם"
          onClick={onPrev}
          className="h-11 w-11 shrink-0"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        <div className="min-w-0 text-center">
          <div className="truncate text-lg font-bold">
            {HE_MONTHS[month - 1]} {year}
          </div>
          <button
            onClick={onToday}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            היום
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="חודש הבא"
          onClick={onNext}
          className="h-11 w-11 shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
        {HE_WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg sm:h-16" />
          ))}
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((iso, i) =>
            iso === null ? (
              <div key={`e-${i}`} className="h-14 sm:h-16" />
            ) : (
              <button
                key={iso}
                onClick={() => onSelect(iso)}
                className={cn(
                  "flex h-14 flex-col items-center justify-start gap-1 rounded-lg border border-transparent bg-muted/40 p-1 text-sm transition-colors hover:bg-accent sm:h-16",
                  iso === today && "border-primary font-bold",
                  selected === iso && "bg-primary/10 border-primary",
                )}
              >
                <span className="leading-none">{Number(iso.slice(-2))}</span>
                <span className="flex flex-wrap items-center justify-center gap-0.5">
                  {renderBadges?.(iso)}
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn("block h-1.5 w-1.5 rounded-full", className)} />;
}
