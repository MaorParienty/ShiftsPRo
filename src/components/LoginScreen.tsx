import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { employeeLogin } from "@/lib/employee.functions";
import { isValidIsraeliPhone } from "@/lib/time";

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: { firstName: string; lastName: string; phone: string }) =>
      employeeLogin({ data: vars }),
    onSuccess: (res) => {
      if (res.status === "ok") {
        toast.success("ברוך הבא!");
        onSuccess();
      } else if (res.status === "phone_mismatch") {
        setWarning(
          "עובד בשם זה כבר קיים במערכת עם מספר טלפון אחר — יש לפנות למנהל כדי לעדכן את הפרטים.",
        );
      } else if (res.status === "invalid_phone") {
        setErrors({ phone: "מספר הטלפון אינו תקין" });
      } else {
        toast.error("אירעה שגיאה בהתחברות, נסו שוב.");
      }
    },
    onError: () => toast.error("אירעה שגיאה בהתחברות, נסו שוב."),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setWarning(null);
    const next: Record<string, string> = {};
    if (!firstName.trim()) next["firstName"] = "יש להזין שם פרטי";
    if (!lastName.trim()) next["lastName"] = "יש להזין שם משפחה";
    if (!phone.trim()) next["phone"] = "יש להזין מספר טלפון";
    else if (!isValidIsraeliPhone(phone))
      next["phone"] = "מספר טלפון ישראלי לא תקין (לדוגמה 0501234567)";
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate({ firstName: firstName.trim(), lastName: lastName.trim(), phone });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold">סידור משמרות</h1>
          <p className="text-sm text-muted-foreground">הזינו את פרטיכם כדי להיכנס</p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">שם פרטי</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="h-12 text-base"
              autoComplete="given-name"
            />
            {errors["firstName"] && (
              <p className="text-sm text-danger">{errors["firstName"]}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">שם משפחה</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="h-12 text-base"
              autoComplete="family-name"
            />
            {errors["lastName"] && <p className="text-sm text-danger">{errors["lastName"]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">מספר טלפון</Label>
            <Input
              id="phone"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="0501234567"
              className="h-12 text-base"
              autoComplete="tel"
            />
            {errors["phone"] && <p className="text-sm text-danger">{errors["phone"]}</p>}
          </div>

          {warning && (
            <Alert className="border-warning bg-warning-soft">
              <AlertDescription className="text-sm text-warning-foreground">
                {warning}
              </AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="h-12 w-full text-base" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            כניסה
          </Button>
        </form>
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
