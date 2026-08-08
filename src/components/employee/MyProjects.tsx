import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { completeCurrentProject, getMyProjects } from "@/lib/employee.functions";
import { formatHeDateTime } from "@/lib/time";

export function MyProjects() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["my-projects"], queryFn: () => getMyProjects() });

  const complete = useMutation({
    mutationFn: (id: string) => completeCurrentProject({ data: { employeeProjectId: id } }),
    onSuccess: (res) => {
      if (res.status === "ok") toast.success("הפרוייקט סומן כהושלם");
      else toast.error("אירעה שגיאה");
      qc.invalidateQueries({ queryKey: ["my-projects"] });
    },
    onError: () => toast.error("אירעה שגיאה"),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  const current = query.data?.current as any;
  const completed = (query.data?.completed ?? []) as any[];

  return (
    <div className="space-y-4">
      {current ? (
        <div className="rounded-2xl border border-primary/40 bg-card p-5 shadow-sm">
          <div className="text-xs font-semibold text-primary">הפרוייקט הנוכחי</div>
          <h2 className="mt-1 text-xl font-extrabold">{current.projects?.name}</h2>
          {current.projects?.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {current.projects.description}
            </p>
          )}
          <Button
            className="mt-5 h-12 w-full bg-success text-base text-success-foreground hover:bg-success/90"
            disabled={complete.isPending}
            onClick={() => complete.mutate(current.id)}
          >
            {complete.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            סיימתי פרוייקט
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-14 text-center text-muted-foreground">
          <FolderOpen className="h-8 w-8" />
          <p className="text-sm">אין כרגע פרוייקטים משויכים</p>
          <p className="text-xs">ממתינים לכך שהמנהל יוסיף פרוייקטים נוספים</p>
        </div>
      )}

      {completed.length > 0 && (
        <Accordion type="single" collapsible className="rounded-2xl border bg-card px-4">
          <AccordionItem value="history" className="border-none">
            <AccordionTrigger className="text-sm font-semibold">
              פרוייקטים שהושלמו ({completed.length})
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pb-2">
                {completed.map((row) => (
                  <li key={row.id} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <div className="min-w-0">
                      <div className="font-medium">{row.projects?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        הושלם ב־{formatHeDateTime(row.completed_at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
