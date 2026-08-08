import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, Trash2, Users } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createConflictRule,
  deleteConflictRule,
  listConflictRules,
  listEmployees,
} from "@/lib/admin.functions";

export function ConflictRulesSection() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const rules = useQuery({ queryKey: ["conflict-rules"], queryFn: () => listConflictRules() });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["conflict-rules"] });
  }

  const remove = useMutation({
    mutationFn: (id: string) => deleteConflictRule({ data: { id } }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("כלל ההתנגשות נמחק");
        setDeleteTarget(null);
        refresh();
      } else {
        toast.error("מחיקת הכלל נכשלה");
      }
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold">כללי התנגשות</h2>
        <Button className="h-11" onClick={() => setAddOpen(true)}>
          <Plus className="ml-1 h-4 w-4" />
          כלל חדש
        </Button>
      </div>

      {rules.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      )}

      {!rules.isLoading && (rules.data?.rules.length ?? 0) === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-14 text-center text-muted-foreground">
          <Users className="h-8 w-8" />
          <p className="text-sm">לא הוגדרו כללי התנגשות</p>
          <p className="text-xs">
            כללי התנגשות מונעים מעובדים מסוימים לעבוד יחד באותה משמרת
          </p>
        </div>
      )}

      {!rules.isLoading && (rules.data?.rules.length ?? 0) > 0 && (
        <div className="space-y-2">
          {rules.data?.rules.map((rule: any) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onDelete={() => setDeleteTarget(rule)}
            />
          ))}
        </div>
      )}

      <AddRuleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        employees={employees.data?.employees ?? []}
        onAdded={refresh}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת כלל התנגשות</AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק את הכלל שמונע מ-
              <strong>
                {" "}
                {deleteTarget?.a?.first_name} {deleteTarget?.a?.last_name}
              </strong>{" "}
              ו-
              <strong>
                {" "}
                {deleteTarget?.b?.first_name} {deleteTarget?.b?.last_name}
              </strong>{" "}
              לעבוד יחד?
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

function RuleCard({ rule, onDelete }: { rule: any; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
        <div className="font-medium">
          {rule.a?.first_name} {rule.a?.last_name} ↔ {rule.b?.first_name} {rule.b?.last_name}
        </div>
      </div>
      <Button variant="ghost" size="icon" aria-label="מחיקה" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-danger" />
      </Button>
    </div>
  );
}

function AddRuleDialog({
  open,
  onOpenChange,
  employees,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: any[];
  onAdded: () => void;
}) {
  const [employeeA, setEmployeeA] = useState("");
  const [employeeB, setEmployeeB] = useState("");

  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: () =>
      createConflictRule({ data: { a: employeeA, b: employeeB } }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("כלל ההתנגשות נוצר");
        setEmployeeA("");
        setEmployeeB("");
        onOpenChange(false);
        onAdded();
      } else if (res.status === "invalid") {
        toast.error("לא ניתן ליצור כלל עם אותו עובד פעמיים");
      } else if (res.status === "duplicate") {
        toast.error("כלל זה כבר קיים");
      } else {
        toast.error("יצירת הכלל נכשלה");
      }
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  function submit() {
    if (!employeeA || !employeeB) {
      toast.error("יש לבחור שני עובדים");
      return;
    }
    if (employeeA === employeeB) {
      toast.error("לא ניתן לבחור את אותו עובד פעמיים");
      return;
    }
    add.mutate();
  }

  const availableForB = employees.filter((e) => e.id !== employeeA);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-right">
        <DialogHeader>
          <DialogTitle>כלל התנגשות חדש</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">עובד ראשון</label>
            <Select value={employeeA} onValueChange={setEmployeeA}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="בחרו עובד" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">עובד שני</label>
            <Select value={employeeB} onValueChange={setEmployeeB} disabled={!employeeA}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="בחרו עובד" />
              </SelectTrigger>
              <SelectContent>
                {availableForB.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            שני העובדים לא יוכלו להירשם לאותה משמרת
          </p>
        </div>
        <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <Button disabled={!employeeA || !employeeB || add.isPending} onClick={submit}>
            {add.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            יצירה
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
