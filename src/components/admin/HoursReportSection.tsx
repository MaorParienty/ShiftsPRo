import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Clock, Loader2, Plus, Settings2, Trash2, TrendingUp } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  addHoursAdjustment,
  deleteHoursAdjustment,
  hoursReport,
  listHoursAdjustments,
} from "@/lib/admin.functions";
import { formatHeDateTime, israelNowParts } from "@/lib/time";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
];

export function HoursReportSection() {
  const now = israelNowParts();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [sortBy, setSortBy] = useState<"name" | "hours">("hours");
  const [adjustingEmployee, setAdjustingEmployee] = useState<{ id: string; name: string } | null>(
    null,
  );

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
                  <TableHead className="text-right">התאמה ידנית</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <span className="font-bold">{row.hours.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">שעות</span>
                      </div>
                      {row.adjustmentHours !== 0 && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          מחושב: {row.computedHours.toFixed(1)} · התאמה:{" "}
                          {row.adjustmentHours > 0 ? "+" : ""}
                          {row.adjustmentHours.toFixed(1)}
                        </div>
                      )}
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
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => setAdjustingEmployee({ id: row.id, name: row.name })}
                      >
                        <Settings2 className="ml-1 h-3 w-3" />
                        התאמה
                      </Button>
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

      <AdjustmentDialog
        employee={adjustingEmployee}
        year={year}
        month={month}
        onOpenChange={(open) => !open && setAdjustingEmployee(null)}
      />
    </div>
  );
}

function AdjustmentDialog({
  employee,
  year,
  month,
  onOpenChange,
}: {
  employee: { id: string; name: string } | null;
  year: number;
  month: number;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const list = useQuery({
    queryKey: ["hours-adjustments", employee?.id, year, month],
    queryFn: () => listHoursAdjustments({ data: { employeeId: employee!.id, year, month } }),
    enabled: !!employee,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["hours-adjustments", employee?.id, year, month] });
    qc.invalidateQueries({ queryKey: ["hours-report"] });
  }

  const add = useMutation({
    mutationFn: () =>
      addHoursAdjustment({
        data: { employeeId: employee!.id, year, month, hours: Number(hours), reason: reason.trim() },
      }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("ההתאמה נוספה");
        setHours("");
        setReason("");
        refresh();
      } else {
        toast.error("הוספת ההתאמה נכשלה");
      }
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteHoursAdjustment({ data: { id } }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("ההתאמה נמחקה");
        setDeleteTarget(null);
        refresh();
      } else {
        toast.error("מחיקת ההתאמה נכשלה");
      }
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  function submit() {
    const n = Number(hours);
    if (!Number.isFinite(n) || n === 0) {
      toast.error("יש להזין מספר שעות שונה מאפס");
      return;
    }
    if (!reason.trim()) {
      toast.error("יש להזין סיבה להתאמה");
      return;
    }
    add.mutate();
  }

  return (
    <>
      <Dialog open={!!employee} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto text-right">
          <DialogHeader>
            <DialogTitle>התאמת שעות ידנית — {employee?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              ההתאמה מתווספת לסך השעות המחושב אוטומטית מהמשמרות בפועל, ואינה מוחקת או מחליפה אותו.
              ניתן להזין מספר חיובי (הוספת שעות) או שלילי (הפחתת שעות).
            </p>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="space-y-1.5">
                <Label>שעות (ניתן שלילי)</Label>
                <Input
                  type="number"
                  step="0.25"
                  dir="ltr"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="לדוגמה 2 או 2-"
                  className="h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>סיבה</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="לדוגמה: תיקון שכחת שעון נוכחות"
                className="h-11"
              />
            </div>
            <Button className="h-11 w-full" disabled={add.isPending} onClick={submit}>
              {add.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              <Plus className="ml-1 h-4 w-4" />
              הוספת התאמה
            </Button>

            <div className="space-y-2">
              <Label>התאמות קיימות בחודש זה</Label>
              {list.isLoading && <Skeleton className="h-16 w-full rounded-xl" />}
              {!list.isLoading && (list.data?.adjustments.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">אין התאמות ידניות בחודש זה</p>
              )}
              {!list.isLoading && (list.data?.adjustments.length ?? 0) > 0 && (
                <div className="space-y-2">
                  {list.data?.adjustments.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-start justify-between gap-2 rounded-lg border bg-muted/40 p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {Number(a.hours) > 0 ? "+" : ""}
                          {Number(a.hours).toFixed(2)} שעות
                        </div>
                        <div className="text-sm text-muted-foreground">{a.reason}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatHeDateTime(a.created_at)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="מחיקה"
                        onClick={() => setDeleteTarget(a)}
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              סגירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת התאמה</AlertDialogTitle>
            <AlertDialogDescription>האם למחוק התאמה זו?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
            >
              מחיקה
            </AlertDialogAction>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
