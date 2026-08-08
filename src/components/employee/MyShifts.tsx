import { useQuery } from "@tanstack/react-query";
import { CalendarX2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyShifts } from "@/lib/employee.functions";
import {
  durationHours,
  formatDuration,
  formatHeDate,
  formatHeTime,
  trimTime,
} from "@/lib/time";

export function MyShifts() {
  const query = useQuery({ queryKey: ["my-shifts"], queryFn: () => getMyShifts() });

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const shifts = query.data?.shifts ?? [];
  if (!shifts.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-14 text-center text-muted-foreground">
        <CalendarX2 className="h-8 w-8" />
        <p className="text-sm">עדיין לא נרשמת למשמרות</p>
        <p className="text-xs">בחרו יום בלוח השנה כדי להירשם למשמרת ראשונה</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shifts.map((row: any) => {
        const hours = durationHours(row.start_actual_ts, row.end_actual_ts);
        const inProgress = row.start_actual_ts && !row.end_actual_ts;
        return (
          <div key={row.id} className="rounded-2xl border bg-card p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <div className="min-w-0">
                <div className="font-bold">{formatHeDate(row.shifts.shift_date)}</div>
                <div className="text-sm text-muted-foreground">
                  {trimTime(row.shifts.start_time)} – {trimTime(row.shifts.end_time)}
                </div>
              </div>
              {row.end_actual_ts ? (
                <Badge className="shrink-0 bg-success text-success-foreground">
                  {formatDuration(hours)}
                </Badge>
              ) : inProgress ? (
                <Badge className="shrink-0 bg-warning text-warning-foreground">בתהליך</Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0">
                  משובץ/ת
                </Badge>
              )}
            </div>
            {row.start_actual_ts && (
              <p className="mt-2 text-xs text-muted-foreground">
                התחלה: {formatHeTime(row.start_actual_ts)} · סיום:{" "}
                {row.end_actual_ts ? formatHeTime(row.end_actual_ts) : "—"}
              </p>
            )}
            {row.note && (
              <div className="mt-2 rounded-lg bg-muted p-2 text-sm">
                <span className="font-semibold">הערה: </span>
                {row.note}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
