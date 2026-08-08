import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ClipboardList, FolderKanban, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LoginScreen } from "@/components/LoginScreen";
import { EmployeeCalendar } from "@/components/employee/EmployeeCalendar";
import { MyProjects } from "@/components/employee/MyProjects";
import { MyShifts } from "@/components/employee/MyShifts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { employeeLogout, getEmployeeSession } from "@/lib/employee.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "סידור משמרות — אזור העובדים" },
      {
        name: "description",
        content: "לוח משמרות חודשי, הרשמה למשמרות, דיווח שעות ופרוייקטים אישיים.",
      },
      { property: "og:title", content: "סידור משמרות — אזור העובדים" },
      {
        property: "og:description",
        content: "לוח משמרות חודשי, הרשמה למשמרות, דיווח שעות ופרוייקטים אישיים.",
      },
    ],
  }),
  component: EmployeeApp,
});

function EmployeeApp() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("calendar");
  const session = useQuery({ queryKey: ["employee-session"], queryFn: () => getEmployeeSession() });

  const logout = useMutation({
    mutationFn: () => employeeLogout(),
    onSuccess: () => {
      toast.success("התנתקת מהמערכת");
      qc.clear();
      qc.invalidateQueries();
    },
  });

  if (session.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!session.data) {
    return <LoginScreen onSuccess={() => session.refetch()} />;
  }

  const employee = session.data;

  return (
    <div className="min-h-screen bg-muted/30 pb-10">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold">
              שלום, {employee.first_name} {employee.last_name}
            </h1>
            <p className="truncate text-xs text-muted-foreground">{employee.phone}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="תפריט">
                <UserRound className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>
                {employee.first_name} {employee.last_name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/admin">כניסת מנהל</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout.mutate()}>
                <LogOut className="ml-2 h-4 w-4" />
                התנתקות / החלפת משתמש
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid h-12 w-full grid-cols-3">
            <TabsTrigger value="calendar" className="h-10 gap-1 text-sm">
              <CalendarDays className="h-4 w-4" />
              לוח שנה
            </TabsTrigger>
            <TabsTrigger value="shifts" className="h-10 gap-1 text-sm">
              <ClipboardList className="h-4 w-4" />
              המשמרות שלי
            </TabsTrigger>
            <TabsTrigger value="projects" className="h-10 gap-1 text-sm">
              <FolderKanban className="h-4 w-4" />
              פרוייקטים
            </TabsTrigger>
          </TabsList>
          <TabsContent value="calendar" className="mt-4">
            <EmployeeCalendar />
          </TabsContent>
          <TabsContent value="shifts" className="mt-4">
            <MyShifts />
          </TabsContent>
          <TabsContent value="projects" className="mt-4">
            <MyProjects />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
