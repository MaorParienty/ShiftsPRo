import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Clock, History, Loader2, Pencil, User, UserX } from "lucide-react";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deleteEmployee,
  employeeQueue,
  employeeShiftHistory,
  listEmployees,
  updateEmployee,
} from "@/lib/admin.functions";
import { durationHours, formatDuration, formatHeDate, trimTime } from "@/lib/time";

export function EmployeesSection() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [viewingQueue, setViewingQueue] = useState<any | null>(null);
  const [viewingHistory, setViewingHistory] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const employees = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["employees"] });
  }

  const update = useMutation({
    mutationFn: (data: any) => updateEmployee({ data }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("העובד עודכן");
        setEditing(null);
        refresh();
      } else {
        toast.error("עדכון העובד נכשל");
      }
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEmployee({ data: { id } }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("העובד נמחק");
        setDeleteTarget(null);
        refresh();
      } else {
        toast.error("מחיקת העובד נכשלה");
      }
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold">עובדים</h2>
      </div>

      {employees.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      )}

      {!employees.isLoading && (employees.data?.employees.length ?? 0) === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-14 text-center text-muted-foreground">
          <User className="h-8 w-8" />
          <p className="text-sm">אין עובדים במערכת</p>
        </div>
      )}

      {!employees.isLoading && (employees.data?.employees.length ?? 0) > 0 && (
        <ScrollArea className="h-[calc(100vh-300px)] rounded-2xl border bg-card">
          <div className="p-4">
            <div className="space-y-2">
              {employees.data?.employees.map((emp: any) => (
                <EmployeeCard
                  key={emp.id}
                  employee={emp}
                  onEdit={() => setEditing(emp)}
                  onViewQueue={() => setViewingQueue(emp)}
                  onViewHistory={() => setViewingHistory(emp)}
                  onDelete={() => setDeleteTarget(emp)}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      )}

      <EditEmployeeDialog
        employee={editing}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={(data) => update.mutate(data)}
      />

      <EmployeeQueueDialog
        employee={viewingQueue}
        open={!!viewingQueue}
        onOpenChange={(open) => !open && setViewingQueue(null)}
      />

      <EmployeeHistoryDialog
        employee={viewingHistory}
        open={!!viewingHistory}
        onOpenChange={(open) => !open && setViewingHistory(null)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת עובד</AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק את {deleteTarget?.first_name} {deleteTarget?.last_name}? פעולה זו תמחק גם
              את כל ההרשמות למשמרות, השעות והפרוייקטים המשויכים לעובד זה, ולא ניתן לבטל אותה.
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

function EmployeeCard({
  employee,
  onEdit,
  onViewQueue,
  onViewHistory,
  onDelete,
}: {
  employee: any;
  onEdit: () => void;
  onViewQueue: () => void;
  onViewHistory: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="font-bold">
            {employee.first_name} {employee.last_name}
          </div>
          <div className="text-sm text-muted-foreground">{employee.phone}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" aria-label="עריכה" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="מחיקת עובד" onClick={onDelete}>
            <UserX className="h-4 w-4 text-danger" />
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="h-9" onClick={onViewQueue}>
          <Clock className="ml-1 h-3 w-3" />
          פרוייקט נוכחי
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={onViewHistory}>
          <History className="ml-1 h-3 w-3" />
          היסטוריית משמרות
        </Button>
      </div>
    </div>
  );
}

function EditEmployeeDialog({
  employee,
  open,
  onOpenChange,
  onSave,
}: {
  employee: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [initialized, setInitialized] = useState<string | null>(null);

  if (employee && initialized !== employee.id) {
    setInitialized(employee.id);
    setFirstName(employee.first_name);
    setLastName(employee.last_name);
    setPhone(employee.phone);
  }

  function submit() {
    if (!firstName.trim() || !lastName.trim()) return;
    if (phone.replace(/\D/g, "").length < 9) {
      toast.error("מספר הטלפון חייב להכיל לפחות 9 ספרות");
      return;
    }
    onSave({
      id: employee.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.replace(/\D/g, ""),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-right">
        <DialogHeader>
          <DialogTitle>עריכת עובד</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>שם פרטי</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>שם משפחה</Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>מספר טלפון</Label>
            <Input
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
        <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <Button onClick={submit}>שמירה</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeQueueDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queue = useQuery({
    queryKey: ["employee-queue", employee?.id],
    queryFn: () => employeeQueue({ data: { employeeId: employee.id } }),
    enabled: !!employee,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-right">
        <DialogHeader>
          <DialogTitle>תור הפרוייקטים</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {queue.isLoading && <Skeleton className="h-32 w-full rounded-xl" />}
          {!queue.isLoading && (
            <>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-muted-foreground">פרוייקט נוכחי</div>
                {queue.data?.assigned && queue.data.assigned.length > 0 ? (
                  queue.data.assigned.map((item: any) => (
                    <div key={item.id} className="rounded-lg bg-muted p-3">
                      <div className="font-medium">{item.projects?.name}</div>
                      {item.projects?.description && (
                        <div className="mt-1 text-sm text-muted-foreground">
                          {item.projects.description}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">אין פרוייקטים בתור</p>
                )}
              </div>
              {queue.data?.completed && queue.data.completed.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-muted-foreground">פרוייקטים שהושלמו</div>
                  <div className="space-y-1">
                    {queue.data.completed.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="bg-success text-success-foreground">
                          הושלם
                        </Badge>
                        {item.projects?.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeHistoryDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const history = useQuery({
    queryKey: ["employee-history", employee?.id],
    queryFn: () => employeeShiftHistory({ data: { employeeId: employee.id } }),
    enabled: !!employee,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto text-right">
        <DialogHeader>
          <DialogTitle>היסטוריית משמרות</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {history.isLoading && (
            <>
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </>
          )}
          {!history.isLoading && history.data?.shifts && history.data.shifts.length > 0 ? (
            <div className="space-y-2">
              {history.data.shifts.map((shift: any) => {
                const hours = shift.start_actual_ts && shift.end_actual_ts
                  ? durationHours(shift.start_actual_ts, shift.end_actual_ts)
                  : 0;
                return (
                  <div key={shift.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {formatHeDate(shift.shifts.shift_date)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {trimTime(shift.shifts.start_time)} – {trimTime(shift.shifts.end_time)}
                      </div>
                    </div>
                    {shift.start_actual_ts && shift.end_actual_ts && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        עבד {formatDuration(hours)}
                      </div>
                    )}
                    {shift.note && (
                      <div className="mt-2 rounded-lg bg-muted p-2 text-xs">
                        <span className="font-semibold">הערה: </span>
                        {shift.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !history.isLoading && (
              <p className="text-sm text-muted-foreground">אין היסטוריית משמרות</p>
            )
          )}
        </div>
        <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
