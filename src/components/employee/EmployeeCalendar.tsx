import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CalendarX2, Loader2, Users } from "lucide-react";

import { Dot, MonthCalendar } from "@/components/MonthCalendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelSignup,
  endShift,
  getDayShifts,
  getMonthOverview,
  saveShiftNote,
  signupForShift,
  startShift,
} from "@/lib/employee.functions";
import {
  durationHours,
  formatDuration,
  formatHeDate,
  formatHeTime,
  israelNowParts,
  israelToday,
  trimTime,
} from "@/lib/time";

const SIGNUP_ERRORS: Record<string, string> = {
  full: "המשמרת מלאה",
  conflict: "לא ניתן להצטרף למשמרת זו עקב התנגשות בסידור",
  past: "המשמרת כבר התחילה או הסתיימה",
  already: "כבר נרשמת למשמרת זו",
  not_found: "המשמרת לא נמצאה",
  error: "אירעה שגיאה, נסו שוב",
};

export function EmployeeCalendar() {
  const now = israelNowParts();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [selected, setSelected] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["month-overview", year, month],
    queryFn: () => getMonthOverview({ data: { year, month } }),
  });

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  }

  const days = overview.data?.days ?? {};

  return (
    <div className="space-y-4">
      <MonthCalendar
        year={year}
        month={month}
        selected={selected}
        loading={overview.isLoading}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        onToday={() => {
          const t = israelNowParts();
          setYear(t.year);
          setMonth(t.month);
        }}
        onSelect={setSelected}
        renderBadges={(iso) => {
          const d = days[iso];
          if (!d) return null;
          return (
            <>
              {d.mine > 0 && <Dot className="bg-success" />}
              {d.needsPeople > 0 && <Dot className="bg-warning" />}
              {d.total > 0 && d.mine === 0 && d.needsPeople === 0 && (
                <Dot className={d.full === d.total ? "bg-danger" : "bg-muted-foreground"} />
              )}
              <span className="text-[10px] leading-none text-muted-foreground">{d.total}</span>
            </>
          );
        }}
      />

      <Legend />

      <DaySheet date={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Dot className="bg-success" /> משובץ/ת
      </span>
      <span className="flex items-center gap-1">
        <Dot className="bg-warning" /> חסרים אנשים
      </span>
      <span className="flex items-center gap-1">
        <Dot className="bg-muted-foreground" /> פתוח
      </span>
      <span className="flex items-center gap-1">
        <Dot className="bg-danger" /> מלא
      </span>
    </div>
  );
}

function DaySheet({ date, onClose }: { date: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["day-shifts", date],
    queryFn: () => getDayShifts({ data: { date: date! } }),
    enabled: !!date,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["day-shifts"] });
    qc.invalidateQueries({ queryKey: ["month-overview"] });
    qc.invalidateQueries({ queryKey: ["my-shifts"] });
  }

  const signup = useMutation({
    mutationFn: (shiftId: string) => signupForShift({ data: { shiftId } }),
    onSuccess: (res) => {
      if (res.status === "ok") toast.success("נרשמת למשמרת בהצלחה");
      else toast.error(SIGNUP_ERRORS[res.status] ?? "אירעה שגיאה");
      refresh();
    },
    onError: () => toast.error("אירעה שגיאה, נסו שוב"),
  });

  const cancel = useMutation({
    mutationFn: (shiftId: string) => cancelSignup({ data: { shiftId } }),
    onSuccess: (res) => {
      if (res.status === "ok") toast.success("ההרשמה בוטלה");
      else if (res.status === "started") toast.error("לא ניתן לבטל לאחר תחילת המשמרת");
      else if (res.status === "too_close")
        toast.error("לא ניתן לבטל הרשמה פחות מ-12 שעות לפני תחילת המשמרת");
      else toast.error("אירעה שגיאה");
      refresh();
    },
  });

  const start = useMutation({
    mutationFn: (shiftId: string) => startShift({ data: { shiftId } }),
    onSuccess: () => {
      toast.success("המשמרת התחילה");
      refresh();
    },
  });

  const end = useMutation({
    mutationFn: (shiftId: string) => endShift({ data: { shiftId } }),
    onSuccess: () => {
      toast.success("המשמרת הסתיימה");
      refresh();
    },
  });

  const shifts = query.data?.shifts ?? [];
  const today = israelToday();

  return (
    <Sheet open={!!date} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-right">
          <SheetTitle>{date ? formatHeDate(date) : ""}</SheetTitle>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-8">
          {query.isLoading && (
            <>
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </>
          )}

          {!query.isLoading && shifts.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <CalendarX2 className="h-8 w-8" />
              <p className="text-sm">אין משמרות ביום זה</p>
            </div>
          )}

          {shifts.map((s) => {
            const full = s.taken >= s.max_people;
            const needs = s.taken < s.min_people;
            const isToday = s.shift_date === today;
            const busy =
              signup.isPending || cancel.isPending || start.isPending || end.isPending;
            return (
              <div
                key={s.id}
                className={`rounded-2xl border p-4 ${
                  s.signedUp ? "border-success bg-success-soft/40" : "bg-card"
                }`}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <div className="text-lg font-bold">
                      {trimTime(s.start_time)} – {trimTime(s.end_time)}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4 shrink-0" />
                      {s.taken}/{s.max_people} נרשמו · מינימום {s.min_people}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {s.signedUp && <Badge className="bg-success text-success-foreground">משובץ/ת</Badge>}
                    {!s.signedUp && full && (
                      <Badge className="bg-danger text-danger-foreground">מלא</Badge>
                    )}
                    {!full && needs && (
                      <Badge className="bg-warning text-warning-foreground">חסרים אנשים</Badge>
                    )}
                    {s.started && !s.ended && (
                      <Badge className="bg-warning text-warning-foreground">בתהליך</Badge>
                    )}
                    {s.ended && (
                      <Badge className="bg-success text-success-foreground">הושלמה</Badge>
                    )}
                  </div>
                </div>

                {s.blocked && !s.signedUp && (
                  <p className="mt-3 flex items-start gap-1 rounded-lg bg-danger-soft p-2 text-sm text-danger">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    לא ניתן להצטרף למשמרת זו עקב התנגשות בסידור
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {!s.signedUp && (
                    <Button
                      className="h-11 flex-1"
                      disabled={busy || full || s.blocked || s.past}
                      onClick={() => signup.mutate(s.id)}
                    >
                      {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                      {full
                        ? "המשמרת מלאה"
                        : s.blocked
                          ? "חסום עקב התנגשות"
                          : s.past
                            ? "המשמרת חלפה"
                            : "הרשמה למשמרת"}
                    </Button>
                  )}

                  {s.signedUp && !s.started && (
                    <Button
                      variant="outline"
                      className="h-11 flex-1"
                      disabled={busy || s.cancelLocked}
                      onClick={() => cancel.mutate(s.id)}
                    >
                      {s.cancelLocked ? "לא ניתן לבטל (פחות מ-12 שעות)" : "ביטול הרשמה"}
                    </Button>
                  )}

                  {s.signedUp && isToday && !s.ended && (
                    <>
                      <Button
                        className="h-11 flex-1"
                        disabled={busy || s.started}
                        onClick={() => start.mutate(s.id)}
                      >
                        התחל משמרת
                      </Button>
                      <Button
                        className="h-11 flex-1 bg-success text-success-foreground hover:bg-success/90"
                        disabled={busy || !s.started}
                        onClick={() => end.mutate(s.id)}
                      >
                        סיים משמרת
                      </Button>
                    </>
                  )}
                </div>

                {s.started && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    התחלה: {formatHeTime(s.start_actual_ts)}
                    {s.ended && ` · סיום: ${formatHeTime(s.end_actual_ts)}`}
                    {s.ended &&
                      ` · עבדת ${formatDuration(durationHours(s.start_actual_ts, s.end_actual_ts))}`}
                  </p>
                )}

                {s.signedUp && <NoteEditor shiftId={s.id} note={s.note} editable={isToday} />}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NoteEditor({
  shiftId,
  note,
  editable,
}: {
  shiftId: string;
  note: string | null;
  editable: boolean;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState(note ?? "");
  const save = useMutation({
    mutationFn: () => saveShiftNote({ data: { shiftId, note: value } }),
    onSuccess: () => {
      toast.success("ההערה נשמרה");
      qc.invalidateQueries({ queryKey: ["day-shifts"] });
      qc.invalidateQueries({ queryKey: ["my-shifts"] });
    },
    onError: () => toast.error("שמירת ההערה נכשלה"),
  });

  if (!editable) {
    return note ? (
      <div className="mt-3 rounded-lg bg-muted p-2 text-sm">
        <span className="font-semibold">הערה: </span>
        {note}
      </div>
    ) : null;
  }

  return (
    <div className="mt-3 space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={1000}
        placeholder="הערה למשמרת (למשל: עבדתי שעתיים נוספות)"
        className="min-h-20 text-base"
      />
      <Button
        variant="outline"
        className="h-10 w-full"
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        שמירת הערה
      </Button>
    </div>
  );
}
