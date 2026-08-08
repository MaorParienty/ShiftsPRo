import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";

import { ConflictRulesSection } from "@/components/admin/ConflictRulesSection";
import { EmployeesSection } from "@/components/admin/EmployeesSection";
import { HoursReportSection } from "@/components/admin/HoursReportSection";
import { ProjectAssignmentSection } from "@/components/admin/ProjectAssignmentSection";
import { ShiftsSection } from "@/components/admin/ShiftsSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { adminBootstrapStatus, bootstrapAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "ניהול סידור משמרות — מנהל" },
      { name: "description", content: "ניהול משמרות, עובדים, כללי התנגשות, שעות ופרוייקטים." },
      { property: "og:title", content: "ניהול סידור משמרות — מנהל" },
      {
        property: "og:description",
        content: "ניהול משמרות, עובדים, כללי התנגשות, שעות ופרוייקטים.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!signedIn) return <AdminLogin />;

  return (
    <div className="min-h-screen bg-muted/30 pb-10">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <h1 className="truncate text-lg font-extrabold">ניהול משמרות</h1>
          <Button
            variant="outline"
            className="h-11 shrink-0"
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("התנתקת");
            }}
          >
            <LogOut className="ml-1 h-4 w-4" />
            יציאה
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <Tabs defaultValue="shifts" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="shifts">משמרות</TabsTrigger>
            <TabsTrigger value="employees">עובדים</TabsTrigger>
            <TabsTrigger value="conflicts">התנגשויות</TabsTrigger>
            <TabsTrigger value="hours">שעות</TabsTrigger>
            <TabsTrigger value="projects">פרוייקטים</TabsTrigger>
          </TabsList>
          <TabsContent value="shifts">
            <ShiftsSection />
          </TabsContent>
          <TabsContent value="employees">
            <EmployeesSection />
          </TabsContent>
          <TabsContent value="conflicts">
            <ConflictRulesSection />
          </TabsContent>
          <TabsContent value="hours">
            <HoursReportSection />
          </TabsContent>
          <TabsContent value="projects">
            <ProjectAssignmentSection />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const status = useQuery({ queryKey: ["admin-bootstrap"], queryFn: () => adminBootstrapStatus() });
  const needsSetup = status.data?.needsSetup;

  const submit = useMutation({
    mutationFn: async () => {
      if (needsSetup) {
        const res = await bootstrapAdmin({ data: { email: email.trim(), password } });
        if (res.status === "error") throw new Error(res.message ?? "שגיאה");
      }
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
    },
    onError: () => setError("פרטי ההתחברות שגויים או שאירעה שגיאה"),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold">כניסת מנהל</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {needsSetup
            ? "הגדרת חשבון המנהל הראשון במערכת"
            : "התחברות עם דוא״ל וסיסמה לניהול המערכת"}
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            submit.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>דוא״ל</Label>
            <Input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>סיסמה</Label>
            <Input
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
              required
              minLength={8}
            />
          </div>
          {error && <p className="rounded-lg bg-danger-soft p-2 text-sm text-danger">{error}</p>}
          <Button type="submit" className="h-12 w-full text-base" disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            {needsSetup ? "יצירת חשבון מנהל" : "כניסה"}
          </Button>
        </form>
        <Link to="/" className="mt-4 block text-center text-sm text-primary underline">
          חזרה לאזור העובדים
        </Link>
      </div>
    </div>
  );
}
