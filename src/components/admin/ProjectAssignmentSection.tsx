import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FolderOpen, Loader2, Pencil, Plus, Trash2, User } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  assignProject,
  createProject,
  deleteProject,
  employeeQueue,
  listEmployees,
  listProjects,
  removeQueueItem,
  reorderQueue,
  updateProject,
} from "@/lib/admin.functions";
import { formatHeDateTime } from "@/lib/time";

export function ProjectAssignmentSection() {
  const qc = useQueryClient();
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<any | null>(null);
  const [assigningEmployee, setAssigningEmployee] = useState<any | null>(null);
  const [viewingEmployeeQueue, setViewingEmployeeQueue] = useState<any | null>(null);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["employee-queue"] });
  }

  const create = useMutation({
    mutationFn: (data: any) => createProject({ data }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("הפרוייקט נוצר");
        setProjectFormOpen(false);
        setEditingProject(null);
        refresh();
      } else {
        toast.error("יצירת הפרוייקט נכשלה");
      }
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  const update = useMutation({
    mutationFn: (data: any) => updateProject({ data }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("הפרוייקט עודכן");
        setProjectFormOpen(false);
        setEditingProject(null);
        refresh();
      } else {
        toast.error("עדכון הפרוייקט נכשל");
      }
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  const removeProject = useMutation({
    mutationFn: (id: string) => deleteProject({ data: { id } }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("הפרוייקט נמחק");
        setDeleteProjectTarget(null);
        refresh();
      } else {
        toast.error("מחיקת הפרוייקט נכשלה");
      }
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold">ניהול פרוייקטים</h2>
        <Button className="h-11" onClick={() => {
          setEditingProject(null);
          setProjectFormOpen(true);
        }}>
          <Plus className="ml-1 h-4 w-4" />
          פרוייקט חדש
        </Button>
      </div>

      {/* Projects List */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold">פרוייקטים זמינים</h3>
        {projects.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        )}
        {!projects.isLoading && (projects.data?.projects.length ?? 0) === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-10 text-center text-muted-foreground">
            <FolderOpen className="h-8 w-8" />
            <p className="text-sm">אין פרוייקטים במערכת</p>
          </div>
        )}
        {!projects.isLoading && (projects.data?.projects.length ?? 0) > 0 && (
          <div className="space-y-2">
            {projects.data?.projects.map((project: any) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => {
                  setEditingProject(project);
                  setProjectFormOpen(true);
                }}
                onDelete={() => setDeleteProjectTarget(project)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Employee Assignment */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold">שיוך פרוייקטים לעובדים</h3>
        {employees.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        )}
        {!employees.isLoading && (employees.data?.employees.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">אין עובדים במערכת</p>
        )}
        {!employees.isLoading && (employees.data?.employees.length ?? 0) > 0 && (
          <div className="space-y-2">
            {employees.data?.employees.map((emp: any) => (
              <EmployeeAssignmentCard
                key={emp.id}
                employee={emp}
                onAssign={() => setAssigningEmployee(emp)}
                onViewQueue={() => setViewingEmployeeQueue(emp)}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectFormDialog
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        project={editingProject}
        projects={projects.data?.projects ?? []}
        onSave={(data) => {
          if (editingProject?.id) {
            update.mutate({ ...data, id: editingProject.id });
          } else {
            create.mutate(data);
          }
        }}
      />

      <AssignProjectDialog
        employee={assigningEmployee}
        projects={projects.data?.projects ?? []}
        open={!!assigningEmployee}
        onOpenChange={(open) => !open && setAssigningEmployee(null)}
        onAssigned={refresh}
      />

      <EmployeeQueueDialog
        employee={viewingEmployeeQueue}
        open={!!viewingEmployeeQueue}
        onOpenChange={(open) => !open && setViewingEmployeeQueue(null)}
        onRefresh={refresh}
      />

      <AlertDialog open={!!deleteProjectTarget} onOpenChange={(o) => !o && setDeleteProjectTarget(null)}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת פרוייקט</AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק את הפרוייקט "{deleteProjectTarget?.name}"? פעולה זו תסיר את הפרוייקט מכל תורי העובדים.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => deleteProjectTarget && removeProject.mutate(deleteProjectTarget.id)}
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

function ProjectCard({ project, onEdit, onDelete }: { project: any; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="font-bold">{project.name}</div>
          {project.description && (
            <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" aria-label="עריכה" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="מחיקה" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmployeeAssignmentCard({ employee, onAssign, onViewQueue }: { employee: any; onAssign: () => void; onViewQueue: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-muted-foreground" />
        <span className="font-medium">
          {employee.first_name} {employee.last_name}
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onAssign}>
          <Plus className="ml-1 h-3 w-3" />
          שיוך פרוייקט
        </Button>
        <Button variant="outline" size="sm" onClick={onViewQueue}>
          צפייה בתור
        </Button>
      </div>
    </div>
  );
}

function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  projects,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  projects: any[];
  onSave: (data: any) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [initialized, setInitialized] = useState<string | null>(null);

  if (open && initialized !== (project?.id ?? "new")) {
    setInitialized(project?.id ?? "new");
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
  }

  function submit() {
    if (!name.trim()) {
      toast.error("יש להזין שם לפרוייקט");
      return;
    }
    onSave({ name: name.trim(), description: description.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-right">
        <DialogHeader>
          <DialogTitle>{project?.id ? "עריכת פרוייקט" : "פרוייקט חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>שם הפרוייקט</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>תיאור</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
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

function AssignProjectDialog({
  employee,
  projects,
  open,
  onOpenChange,
  onAssigned,
}: {
  employee: any;
  projects: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}) {
  const [projectId, setProjectId] = useState("");

  const qc = useQueryClient();
  const assign = useMutation({
    mutationFn: () => assignProject({ data: { employeeId: employee.id, projectId } }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("הפרוייקט נוסף לתור");
        setProjectId("");
        onOpenChange(false);
        onAssigned();
      } else {
        toast.error("שיוך הפרוייקט נכשל");
      }
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-right">
        <DialogHeader>
          <DialogTitle>שיוך פרוייקט לעובד</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            שיוך פרוייקט ל-
            <strong>
              {" "}
              {employee?.first_name} {employee?.last_name}
            </strong>
          </p>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="בחרו פרוייקט" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <Button disabled={!projectId} onClick={() => assign.mutate()}>
            שיוך
          </Button>
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
  onRefresh,
}: {
  employee: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const queue = useQuery({
    queryKey: ["employee-queue", employee?.id],
    queryFn: () => employeeQueue({ data: { employeeId: employee.id } }),
    enabled: !!employee,
  });

  const [removeTarget, setRemoveTarget] = useState<any | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => removeQueueItem({ data: { id } }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("הפרוייקט הוסר מהתור");
        setRemoveTarget(null);
        qc.invalidateQueries({ queryKey: ["employee-queue", employee.id] });
        onRefresh();
      } else {
        toast.error("הסרת הפרוייקט נכשלה");
      }
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderQueue({ data: { ids } }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        qc.invalidateQueries({ queryKey: ["employee-queue", employee.id] });
        onRefresh();
      }
    },
  });

  const assigned = queue.data?.assigned ?? [];
  const completed = queue.data?.completed ?? [];

  function moveUp(index: number) {
    if (index === 0) return;
    const newOrder = [...assigned];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorder.mutate(newOrder.map((item) => item.id));
  }

  function moveDown(index: number) {
    if (index === assigned.length - 1) return;
    const newOrder = [...assigned];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorder.mutate(newOrder.map((item) => item.id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto text-right">
        <DialogHeader>
          <DialogTitle>תור הפרוייקטים</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {queue.isLoading && <Skeleton className="h-32 w-full rounded-xl" />}
          {!queue.isLoading && (
            <>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-muted-foreground">פרוייקטים בתור</div>
                {assigned.length === 0 ? (
                  <p className="text-sm text-muted-foreground">אין פרוייקטים בתור</p>
                ) : (
                  <div className="space-y-2">
                    {assigned.map((item: any, index: number) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-lg border bg-card p-3">
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === 0}
                            onClick={() => moveUp(index)}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === assigned.length - 1}
                            onClick={() => moveDown(index)}
                          >
                            ↓
                          </Button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{item.projects?.name}</div>
                          {item.projects?.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {item.projects.description}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-danger"
                          onClick={() => setRemoveTarget(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {completed.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-muted-foreground">פרוייקטים שהושלמו</div>
                  <div className="space-y-1">
                    {completed.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{item.projects?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            הושלם ב־{formatHeDateTime(item.completed_at)}
                          </div>
                        </div>
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

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>הסרת פרוייקט מהתור</AlertDialogTitle>
            <AlertDialogDescription>
              האם להסיר את הפרוייקט "{removeTarget?.projects?.name}" מהתור?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => removeTarget && remove.mutate(removeTarget.id)}
            >
              הסרה
            </AlertDialogAction>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
