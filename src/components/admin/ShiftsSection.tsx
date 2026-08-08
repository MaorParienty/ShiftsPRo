import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarX2,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { Dot, MonthCalendar } from "@/components/MonthCalendar";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  adminAddSignup,
  adminDayDetail,
  adminMonthShifts,
  adminRemoveSignup,
  adminUpdateSignupTimes,
  createShift,
  deleteShift,
  duplicateShift,
  listConflictRules,
  listEmployees,
  updateShift,
} from "@/lib/admin.functions";
import {
  durationHours,
  formatDuration,
  formatHeDate,
  formatHeTime,
  israelNowParts,
  trimTime,
} from "@/lib/time";

const SIGNUP_ERRORS: Record<string, string> = {
  full: "המשמרת מלאה",
  conflict: "קיימת התנגשות בין העובדים במשמרת זו",
  past: "המשמרת כבר התחילה",
  already: "העובד כבר רשום למשמרת",
  not_found: "המשמרת לא נמצאה",
  error: "אירעה שגיאה",
};

function toLocalInput(ts: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${pad(Number(get("hour")))}:${get("minute")}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}:00+02:00`).toISOString();
}

export function ShiftsSection() {
  const qc = useQueryClient();
  const now = israelNowParts();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [dupTarget, setDupTarget] = useState<any | null>(null);

  const overview = useQuery({
    queryKey: ["admin-month", year, month],
    queryFn: () => adminMonthShifts({ data: { year, month } }),
  });
  const day = useQuery({
    queryKey: ["admin-day", selected],
    queryFn: () => adminDayDetail({ data: { date: selected! } }),
    enabled: !!selected,
  });
  const rules = useQuery({ queryKey: ["conflict-rules"], queryFn: () => listConflictRules() });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-month"] });
    qc.invalidateQueries({ queryKey: ["admin-day"] });
    qc.invalidateQueries({ queryKey: ["hours-report"] });
  }

  const remove = useMutation({
    mutationFn: (id: string) => deleteShift({ data: { id } }),
    onSuccess: () => {
      toast.success("המשמרת נמחקה");
      setDeleteTarget(null);
      refresh();
    },
    onError: () => toast.error("מחיקת המשמרת נכשלה"),
  });

  const days = overview.data?.days ?? {};

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">לוח משמרות</h2>
        <Button
          className="h-11"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="ml-1 h-4 w-4" />
          משמרת חדשה
        </Button>
      </div>

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
              {d.needsPeople > 0 && <Dot className="bg-warning" />}
              {d.full > 0 && <Dot className="bg-success" />}
              {d.inProgress > 0 && <Dot className="bg-warning" />}
              <span className="text-[10px] leading-none text-muted-foreground">
                {d.total}·{d.people}
              </span>
            </>
          );
        }}
      />

      {!selected && (
        <p className="text-center text-sm text-muted-foreground">
          בחרו יום בלוח כדי לראות את פירוט המשמרות
        </p>
      )}

      {selected && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">{formatHeDate(selected)}</h3>
          {day.isLoading && <Skeleton className="h-40 w-full rounded-2xl" />}
          {!day.isLoading && (day.data?.shifts.length ?? 0) === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-10 text-center text-muted-foreground">
              <CalendarX2 className="h-8 w-8" />
              <p className="text-sm">אין משמרות ביום זה</p>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing({ shift_date: selected });
                  setFormOpen(true);
                }}
              >
                יצירת משמרת ליום זה
              </Button>
            </div>
          )}
          {(day.data?.shifts ?? []).map((s: any) => (
            <AdminShiftCard
              key={s.id}
              shift={s}
              employees={employees.data?.employees ?? []}
              onEdit={() => {
                setEditing(s);
                setFormOpen(true);
              }}
              onDelete={() => setDeleteTarget(s)}
              onDuplicate={() => setDupTarget(s)}
              onChanged={refresh}
            />
          ))}
        </div>
      )}

      <ShiftFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        shift={editing}
        rules={rules.data?.rules ?? []}
        defaultDate={selected ?? undefined}
        onSaved={refresh}
      />

      <DuplicateDialog shift={dupTarget} onClose={() => setDupTarget(null)} onSaved={refresh} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת משמרת</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.signups?.length
                ? `למשמרת זו רשומים ${deleteTarget.signups.length} עובדים. מחיקת המשמרת תסיר גם את ההרשמות שלהם.`
                : "האם למחוק את המשמרת?"}
            </AlertDialogDescription>
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
    </div>
  );
}

function AdminShiftCard({
  shift,
  employees,
  onEdit,
  onDelete,
  onDuplicate,
  onChanged,
}: {
  shift: any;
  employees: any[];
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onChanged: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [override, setOverride] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);
  const [timesTarget, setTimesTarget] = useState<any | null>(null);

  const add = useMutation({
    mutationFn: () => adminAddSignup({ data: { shiftId: shift.id, employeeId, override } }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("העובד נוסף למשמרת");
        setAddOpen(false);
        setEmployeeId("");
        setOverride(false);
        onChanged();
      } else {
        toast.error(SIGNUP_ERRORS[res.status] ?? "אירעה שגיאה");
      }
    },
  });

  const removeSignup = useMutation({
    mutationFn: (id: string) => adminRemoveSignup({ data: { signupId: id } }),
    onSuccess: () => {
      toast.success("העובד הוסר מהמשמרת");
      setRemoveTarget(null);
      onChanged();
    },
  });

  const taken = shift.signups.length;
  const full = taken >= shift.max_people;
  const needs = taken < shift.min_people;
  const available = employees.filter(
    (e) => !shift.signups.some((s: any) => s.employee_id === e.id),
  );

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <div className="text-lg font-bold">
            {trimTime(shift.start_time)} – {trimTime(shift.end_time)}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4 shrink-0" />
            {taken}/{shift.max_people} · מינימום {shift.min_people}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" aria-label="שכפול" onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="עריכה" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="מחיקה" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {full && <Badge className="bg-danger text-danger-foreground">מלא</Badge>}
        {needs && <Badge className="bg-warning text-warning-foreground">חסרים אנשים</Badge>}
        {!full && !needs && <Badge variant="secondary">פתוח</Badge>}
      </div>

      <div className="mt-3 space-y-2">
        {taken === 0 && <p className="text-sm text-muted-foreground">אף עובד לא נרשם למשמרת זו</p>}
        {shift.signups.map((s: any) => {
          const inProgress = s.start_actual_ts && !s.end_actual_ts;
          const done = s.start_actual_ts && s.end_actual_ts;
          return (
            <div key={s.id} className="rounded-xl bg-muted/60 p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {s.employees?.first_name} {s.employees?.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    התחלה: {formatHeTime(s.start_actual_ts)} · סיום: {formatHeTime(s.end_actual_ts)}
                    {done &&
                      ` · ${formatDuration(durationHours(s.start_actual_ts, s.end_actual_ts))}`}
                  </div>
                  {s.note && (
                    <div className="mt-1 rounded-lg bg-background p-2 text-xs">
                      <span className="font-semibold">הערה: </span>
                      {s.note}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {inProgress && (
                    <Badge className="bg-warning text-warning-foreground">בתהליך</Badge>
                  )}
                  {done && <Badge className="bg-success text-success-foreground">הושלמה</Badge>}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="עריכת שעות"
                      onClick={() => setTimesTarget(s)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="הסרה"
                      onClick={() => setRemoveTarget(s)}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button variant="outline" className="mt-3 h-10 w-full" onClick={() => setAddOpen(true)}>
        <UserPlus className="ml-1 h-4 w-4" />
        הוספת עובד למשמרת
      </Button>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="text-right">
          <DialogHeader>
            <DialogTitle>הוספת עובד למשמרת</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">כל העובדים כבר רשומים למשמרת זו</p>
            ) : (
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="בחרו עובד" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={override} onCheckedChange={(v) => setOverride(!!v)} />
              עקיפת חסימות (תפוסה מלאה או התנגשות)
            </label>
            {override && (
              <p className="flex items-start gap-1 rounded-lg bg-warning-soft p-2 text-xs text-warning-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                העקיפה תוסיף את העובד גם אם המשמרת מלאה או שקיימת התנגשות.
              </p>
            )}
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button disabled={!employeeId || add.isPending} onClick={() => add.mutate()}>
              {add.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              הוספה
            </Button>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TimesDialog signup={timesTarget} onClose={() => setTimesTarget(null)} onSaved={onChanged} />

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>הסרת עובד מהמשמרת</AlertDialogTitle>
            <AlertDialogDescription>
              הסרת העובד תמחק גם את השעות וההערות שנרשמו למשמרת זו. להמשיך?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => removeTarget && removeSignup.mutate(removeTarget.id)}
            >
              הסרה
            </AlertDialogAction>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TimesDialog({
  signup,
  onClose,
  onSaved,
}: {
  signup: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [initialized, setInitialized] = useState<string | null>(null);

  if (signup && initialized !== signup.id) {
    setInitialized(signup.id);
    setStart(toLocalInput(signup.start_actual_ts));
    setEnd(toLocalInput(signup.end_actual_ts));
  }

  const save = useMutation({
    mutationFn: () =>
      adminUpdateSignupTimes({
        data: {
          signupId: signup.id,
          start: fromLocalInput(start),
          end: fromLocalInput(end),
        },
      }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("השעות עודכנו");
        onSaved();
        onClose();
      } else if (res.status === "invalid") {
        toast.error("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
      } else {
        toast.error("אירעה שגיאה");
      }
    },
  });

  return (
    <Dialog open={!!signup} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="text-right">
        <DialogHeader>
          <DialogTitle>עדכון שעות בפועל</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>שעת התחלה בפועל</Label>
            <Input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>שעת סיום בפועל</Label>
            <Input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-11"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            סך השעות מחושב אוטומטית מהפרש הזמנים ואינו ניתן להזנה ידנית.
          </p>
        </div>
        <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            שמירה
          </Button>
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateDialog({
  shift,
  onClose,
  onSaved,
}: {
  shift: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dates, setDates] = useState("");

  const dup = useMutation({
    mutationFn: () =>
      duplicateShift({
        data: {
          id: shift.id,
          dates: dates
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success(`נוצרו ${res.created} משמרות`);
        setDates("");
        onSaved();
        onClose();
      } else {
        toast.error("אירעה שגיאה בשכפול");
      }
    },
    onError: () => toast.error("יש לבחור תאריכים תקינים"),
  });

  return (
    <Dialog open={!!shift} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="text-right">
        <DialogHeader>
          <DialogTitle>שכפול משמרת לתאריכים נוספים</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            בחרו תאריך והוסיפו לרשימה. המשמרת תשוכפל עם אותן שעות, מינימום, מקסימום וכללי התנגשות.
          </p>
          <DateAdder onAdd={(d) => setDates((prev) => (prev ? `${prev}, ${d}` : d))} />
          {dates ? (
            <div className="rounded-lg bg-muted p-2 text-sm">{dates}</div>
          ) : (
            <p className="text-xs text-muted-foreground">לא נבחרו תאריכים</p>
          )}
        </div>
        <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <Button disabled={!dates || dup.isPending} onClick={() => dup.mutate()}>
            {dup.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            שכפול
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDates("");
              onClose();
            }}
          >
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DateAdder({ onAdd }: { onAdd: (d: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-11"
      />
      <Button
        type="button"
        variant="outline"
        className="h-11 shrink-0"
        disabled={!value}
        onClick={() => {
          onAdd(value);
          setValue("");
        }}
      >
        הוספה
      </Button>
    </div>
  );
}

function ShiftFormDialog({
  open,
  onOpenChange,
  shift,
  rules,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shift: any | null;
  rules: any[];
  defaultDate?: string | undefined;
  onSaved: () => void;
}) {
  const [key, setKey] = useState<string>("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [minPeople, setMinPeople] = useState("1");
  const [maxPeople, setMaxPeople] = useState("3");
  const [ruleIds, setRuleIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const identity = `${open}-${shift?.id ?? "new"}-${defaultDate ?? ""}`;
  if (open && key !== identity) {
    setKey(identity);
    setDate(shift?.shift_date ?? defaultDate ?? "");
    setStartTime(shift?.start_time ? shift.start_time.slice(0, 5) : "08:00");
    setEndTime(shift?.end_time ? shift.end_time.slice(0, 5) : "16:00");
    setMinPeople(String(shift?.min_people ?? 1));
    setMaxPeople(String(shift?.max_people ?? 3));
    setRuleIds(shift?.ruleIds ?? []);
    setError(null);
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        shift_date: date,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        min_people: Number(minPeople),
        max_people: Number(maxPeople),
        ruleIds,
      };
      return shift?.id
        ? updateShift({ data: { ...payload, id: shift.id } })
        : createShift({ data: payload });
    },
    onSuccess: (res: any) => {
      if (res.status === "ok") {
        toast.success(shift?.id ? "המשמרת עודכנה" : "המשמרת נוצרה");
        onOpenChange(false);
        onSaved();
      } else if (res.status === "invalid") {
        setError("מספר המקסימום חייב להיות גדול או שווה למינימום");
      } else {
        toast.error("שמירת המשמרת נכשלה");
      }
    },
    onError: () => toast.error("שמירת המשמרת נכשלה"),
  });

  function submit() {
    setError(null);
    if (!date) return setError("יש לבחור תאריך");
    if (!startTime || !endTime) return setError("יש להזין שעות");
    const min = Number(minPeople);
    const max = Number(maxPeople);
    if (!Number.isFinite(min) || min < 0) return setError("מינימום עובדים אינו תקין");
    if (!Number.isFinite(max) || max < 1) return setError("מקסימום עובדים אינו תקין");
    if (max < min) return setError("מספר המקסימום חייב להיות גדול או שווה למינימום");
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto text-right">
        <DialogHeader>
          <DialogTitle>{shift?.id ? "עריכת משמרת" : "משמרת חדשה"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>תאריך</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>שעת התחלה</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>שעת סיום</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>מינימום עובדים</Label>
              <Input
                type="number"
                min={0}
                value={minPeople}
                onChange={(e) => setMinPeople(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>מקסימום עובדים</Label>
              <Input
                type="number"
                min={1}
                value={maxPeople}
                onChange={(e) => setMaxPeople(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>כללי התנגשות שחלים על משמרת זו</Label>
            {rules.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                לא הוגדרו כללי התנגשות. ניתן להוסיף אותם בלשונית "כללי התנגשות".
              </p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-2">
                {rules.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={ruleIds.includes(r.id)}
                      onCheckedChange={(v) =>
                        setRuleIds((prev) =>
                          v ? [...prev, r.id] : prev.filter((x) => x !== r.id),
                        )
                      }
                    />
                    {r.a?.first_name} {r.a?.last_name} ↔ {r.b?.first_name} {r.b?.last_name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-danger-soft p-2 text-sm text-danger">{error}</p>
          )}
        </div>
        <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <Button disabled={save.isPending} onClick={submit}>
            {save.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            שמירה
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
