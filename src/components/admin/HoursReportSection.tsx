import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Loader2, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hoursReport } from "@/lib/admin.functions";
import { israelNowParts } from "@/lib/time";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
];

export function HoursReportSection() {
  const now = israelNowParts();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [sortBy, setSortBy] = useState<"name" | "hours">("hours");

  const report = useQuery({
    queryKey: ["hours-report", year, month],
    queryFn: () => hoursReport({ data: { year, month } }),
  });

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  }

  const sortedData = [...(report.data?.report ?? [])].sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name, "he");
    } else {
      return b.hours - a.hours;
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">דוח שעות</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)}>
            ←
          </Button>
          <span className="min-w-[120px] text-center font-medium">
            {HEBREW_MONTHS[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)}>
            →
          </Button>
          <Button variant="ghost" size="sm" onClick={() => {
            const t = israelNowParts();
            setYear(t.year);
            setMonth(t.month);
          }}>
            היום
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">מיון לפי:</span>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">שם עובד</SelectItem>
            <SelectItem value="hours">שעות עבודה</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {report.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      )}

      {!report.isLoading && sortedData.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-14 text-center text-muted-foreground">
          <Clock className="h-8 w-8" />
          <p className="text-sm">אין נתוני שעות לחודש זה</p>
        </div>
      )}

      {!report.isLoading && sortedData.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">עובד</TableHead>
                  <TableHead className="text-right">שעות עבודה</TableHead>
                  <TableHead className="text-right">משמרות הושלמו</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <span className="font-bold">{row.hours.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">שעות</span>
                      </div>
                    </TableCell>
                    <TableCell>{row.completed}</TableCell>
                    <TableCell>
                      {row.inProgress > 0 ? (
                        <Badge className="bg-warning text-warning-foreground">
                          בתהליך ({row.inProgress})
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-success text-success-foreground">
                          סופי
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {report.data?.report.some((r: any) => r.inProgress > 0) && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            יש עובדים עם משמרות בתהליך. סך השעות עבורם עדיין לא סופי ויתעדכן כאשר המשמרת תסתיים.
          </p>
        </div>
      )}
    </div>
  );
}
