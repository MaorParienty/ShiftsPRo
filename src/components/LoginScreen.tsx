import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { employeeLogin, employeeRegister } from "@/lib/employee.functions";
import { isValidIsraeliPhone } from "@/lib/time";

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold">סידור משמרות</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "התחברו עם שם וסיסמה" : "צרו חשבון עובד חדש"}
          </p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")} className="mt-6">
          <TabsList className="grid h-11 w-full grid-cols-2">
            <TabsTrigger value="login" className="text-sm">
              כניסה
            </TabsTrigger>
            <TabsTrigger value="register" className="text-sm">
              הרשמה
            </TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="mt-5">
            <LoginForm onSuccess={onSuccess} onSwitchToRegister={() => setMode("register")} />
          </TabsContent>
          <TabsContent value="register" className="mt-5">
            <RegisterForm onSuccess={onSuccess} onSwitchToLogin={() => setMode("login")} />
          </TabsContent>
        </Tabs>
      </div>

      <Link
        to="/admin"
        className="mt-6 text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        כניסת מנהל
      </Link>
    </div>
  );
}

function LoginForm({
  onSuccess,
  onSwitchToRegister,
}: {
  onSuccess: () => void;
  onSwitchToRegister: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notFound, setNotFound] = useState(false);

  const mutation = useMutation({
    mutationFn: (vars: { firstName: string; lastName: string; password: string }) =>
      employeeLogin({ data: vars }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("ברוך הבא!");
        onSuccess();
      } else if (res.status === "wrong_password") {
        setErrors({ password: "סיסמה שגויה" });
      } else if (res.status === "not_found") {
        setNotFound(true);
      } else {
        toast.error("אירעה שגיאה בהתחברות, נסו שוב.");
      }
    },
    onError: () => toast.error("אירעה שגיאה בהתחברות, נסו שוב."),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotFound(false);
    const next: Record<string, string> = {};
    if (!firstName.trim()) next["firstName"] = "יש להזין שם פרטי";
    if (!lastName.trim()) next["lastName"] = "יש להזין שם משפחה";
    if (!password) next["password"] = "יש להזין סיסמה";
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate({ firstName: firstName.trim(), lastName: lastName.trim(), password });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="login-firstName">שם פרטי</Label>
        <Input
          id="login-firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="h-12 text-base"
          autoComplete="given-name"
        />
        {errors["firstName"] && <p className="text-sm text-danger">{errors["firstName"]}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-lastName">שם משפחה</Label>
        <Input
          id="login-lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="h-12 text-base"
          autoComplete="family-name"
        />
        {errors["lastName"] && <p className="text-sm text-danger">{errors["lastName"]}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-password">סיסמה</Label>
        <Input
          id="login-password"
          type="password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 text-base"
          autoComplete="current-password"
        />
        {errors["password"] && <p className="text-sm text-danger">{errors["password"]}</p>}
      </div>

      {notFound && (
        <Alert className="border-warning bg-warning-soft">
          <AlertDescription className="text-sm text-warning-foreground">
            לא נמצא עובד בשם זה.{" "}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-semibold underline underline-offset-2"
            >
              לחצו כאן כדי להירשם
            </button>
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-12 w-full text-base" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
        כניסה
      </Button>
    </form>
  );
}

function RegisterForm({
  onSuccess,
  onSwitchToLogin,
}: {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [exists, setExists] = useState(false);

  const mutation = useMutation({
    mutationFn: (vars: {
      firstName: string;
      lastName: string;
      phone: string;
      password: string;
    }) => employeeRegister({ data: vars }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("החשבון נוצר בהצלחה!");
        onSuccess();
      } else if (res.status === "exists") {
        setExists(true);
      } else if (res.status === "invalid_phone") {
        setErrors({ phone: "מספר הטלפון אינו תקין" });
      } else {
        toast.error("אירעה שגיאה בהרשמה, נסו שוב.");
      }
    },
    onError: () => toast.error("אירעה שגיאה בהרשמה, נסו שוב."),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setExists(false);
    const next: Record<string, string> = {};
    if (!firstName.trim()) next["firstName"] = "יש להזין שם פרטי";
    if (!lastName.trim()) next["lastName"] = "יש להזין שם משפחה";
    if (!phone.trim()) next["phone"] = "יש להזין מספר טלפון";
    else if (!isValidIsraeliPhone(phone))
      next["phone"] = "מספר טלפון ישראלי לא תקין (לדוגמה 0501234567)";
    if (!password) next["password"] = "יש להזין סיסמה";
    else if (password.length < 6) next["password"] = "הסיסמה חייבת להכיל לפחות 6 תווים";
    if (confirmPassword !== password) next["confirmPassword"] = "הסיסמאות אינן תואמות";
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate({ firstName: firstName.trim(), lastName: lastName.trim(), phone, password });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reg-firstName">שם פרטי</Label>
        <Input
          id="reg-firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="h-12 text-base"
          autoComplete="given-name"
        />
        {errors["firstName"] && <p className="text-sm text-danger">{errors["firstName"]}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-lastName">שם משפחה</Label>
        <Input
          id="reg-lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="h-12 text-base"
          autoComplete="family-name"
        />
        {errors["lastName"] && <p className="text-sm text-danger">{errors["lastName"]}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-phone">מספר טלפון</Label>
        <Input
          id="reg-phone"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="0501234567"
          className="h-12 text-base"
          autoComplete="tel"
        />
        {errors["phone"] && <p className="text-sm text-danger">{errors["phone"]}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-password">סיסמה</Label>
        <Input
          id="reg-password"
          type="password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 text-base"
          autoComplete="new-password"
        />
        {errors["password"] && <p className="text-sm text-danger">{errors["password"]}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-confirmPassword">אימות סיסמה</Label>
        <Input
          id="reg-confirmPassword"
          type="password"
          dir="ltr"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="h-12 text-base"
          autoComplete="new-password"
        />
        {errors["confirmPassword"] && (
          <p className="text-sm text-danger">{errors["confirmPassword"]}</p>
        )}
      </div>

      {exists && (
        <Alert className="border-warning bg-warning-soft">
          <AlertDescription className="text-sm text-warning-foreground">
            כבר קיים חשבון עם שם וטלפון אלה.{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-semibold underline underline-offset-2"
            >
              לחצו כאן כדי להתחבר
            </button>
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-12 w-full text-base" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
        הרשמה
      </Button>
    </form>
  );
}
