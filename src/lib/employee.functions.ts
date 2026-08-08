import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { isValidIsraeliPhone, monthRange, normalizePhone } from "./time";

async function db() {
  const { supabasePublic } = await import("@/integrations/supabase/client.public-server");
  return supabasePublic as any;
}

function rpcSecret(): string {
  const v = process.env["SUPABASE_RPC_SECRET"];
  if (!v) throw new Error("Missing SUPABASE_RPC_SECRET environment variable.");
  return v;
}

export type EmployeeSession = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
} | null;

export const getEmployeeSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<EmployeeSession> => {
    const { readEmployeeId } = await import("./session.server");
    const id = readEmployeeId();
    if (!id) return null;
    const supabase = await db();
    const { data } = await supabase.rpc("employee_get_by_id", {
      _secret: rpcSecret(),
      _employee_id: id,
    });
    return (data as EmployeeSession) ?? null;
  },
);

export const employeeRegister = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().min(1).max(60),
        phone: z.string().trim().min(1).max(20),
        password: z.string().min(6).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    if (!isValidIsraeliPhone(input.phone)) {
      return { status: "invalid_phone" as const };
    }
    const phone = normalizePhone(input.phone);
    const first = input.firstName.trim();
    const last = input.lastName.trim();
    const supabase = await db();
    const { setEmployeeCookie } = await import("./session.server");
    const { hashPassword } = await import("./password.server");

    const { data: result, error } = await supabase.rpc("employee_register", {
      _secret: rpcSecret(),
      _first_name: first,
      _last_name: last,
      _phone: phone,
      _password_hash: hashPassword(input.password),
    });
    if (error || !result) return { status: "error" as const };
    const parsed = result as { status: string; employee?: EmployeeSession };
    if (parsed.status === "exists") return { status: "exists" as const };
    if (parsed.status !== "ok" || !parsed.employee) return { status: "error" as const };
    setEmployeeCookie(parsed.employee.id);
    return { status: "ok" as const, employee: parsed.employee };
  });

export const employeeLogin = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().min(1).max(60),
        password: z.string().min(1).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    const first = input.firstName.trim();
    const last = input.lastName.trim();
    const supabase = await db();
    const { setEmployeeCookie } = await import("./session.server");
    const { verifyPassword } = await import("./password.server");

    const { data: rows } = await supabase.rpc("employee_find_candidates", {
      _secret: rpcSecret(),
      _first_name: first,
      _last_name: last,
    });
    const candidates = (rows as any[]) ?? [];
    if (!candidates.length) return { status: "not_found" as const };

    const match = candidates.find((c: any) => verifyPassword(input.password, c.password_hash));
    if (!match) return { status: "wrong_password" as const };

    setEmployeeCookie(match.id);
    const { password_hash: _omit, ...employee } = match;
    return { status: "ok" as const, employee: employee as EmployeeSession };
  });

export const employeeLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { clearEmployeeCookie } = await import("./session.server");
  clearEmployeeCookie();
  return { ok: true };
});

export const getMonthOverview = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { readEmployeeId } = await import("./session.server");
    const employeeId = readEmployeeId();
    const supabase = await db();
    const { start, end } = monthRange(data.year, data.month);

    const { data: shifts } = await supabase.rpc("employee_select_shifts_range", {
      _secret: rpcSecret(),
      _start: start,
      _end: end,
    });

    const ids = (shifts ?? []).map((s: any) => s.id);
    const { data: signups } = ids.length
      ? await supabase.rpc("employee_select_signups_by_shift_ids", {
          _secret: rpcSecret(),
          _shift_ids: ids,
        })
      : { data: [] as any[] };

    const days: Record<
      string,
      { total: number; mine: number; needsPeople: number; full: number }
    > = {};
    for (const s of shifts ?? []) {
      const taken = (signups ?? []).filter((x: any) => x.shift_id === s.id);
      const mine = employeeId && taken.some((x: any) => x.employee_id === employeeId) ? 1 : 0;
      const d = (days[s.shift_date] ??= { total: 0, mine: 0, needsPeople: 0, full: 0 });
      d.total += 1;
      d.mine += mine;
      if (taken.length < s.min_people) d.needsPeople += 1;
      if (taken.length >= s.max_people) d.full += 1;
    }
    return { days };
  });

type DayShift = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  min_people: number;
  max_people: number;
  taken: number;
  signedUp: boolean;
  blocked: boolean;
  past: boolean;
  started: boolean;
  ended: boolean;
  start_actual_ts: string | null;
  end_actual_ts: string | null;
  note: string | null;
};

export const getDayShifts = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ shifts: DayShift[] }> => {
    const { readEmployeeId } = await import("./session.server");
    const employeeId = readEmployeeId();
    const supabase = await db();

    const { data: shifts } = await supabase.rpc("employee_select_shifts_by_date", {
      _secret: rpcSecret(),
      _date: data.date,
    });

    const ids = (shifts ?? []).map((s: any) => s.id);
    if (!ids.length) return { shifts: [] };

    const { data: signups } = await supabase.rpc("employee_select_signups_by_shift_ids", {
      _secret: rpcSecret(),
      _shift_ids: ids,
    });

    const { data: shiftRules } = await supabase.rpc("employee_select_shift_conflict_rules", {
      _secret: rpcSecret(),
      _shift_ids: ids,
    });

    const now = Date.now();
    const result: DayShift[] = (shifts ?? [])
      .slice()
      .sort((a: any, b: any) => String(a.start_time).localeCompare(String(b.start_time)))
      .map((s: any) => {
        const rows = (signups ?? []).filter((x: any) => x.shift_id === s.id);
        const mine = employeeId ? rows.find((x: any) => x.employee_id === employeeId) : null;
        const rules = (shiftRules ?? []).filter((r: any) => r.shift_id === s.id);
        const blocked =
          !!employeeId &&
          !mine &&
          rules.some(
            (rule: any) =>
              rows.some(
                (row: any) =>
                  (rule.employee_id_a === employeeId && rule.employee_id_b === row.employee_id) ||
                  (rule.employee_id_b === employeeId && rule.employee_id_a === row.employee_id),
              ),
          );
        const startTs = new Date(`${s.shift_date}T${s.start_time}+02:00`).getTime();
        return {
          id: s.id,
          shift_date: s.shift_date,
          start_time: s.start_time,
          end_time: s.end_time,
          min_people: s.min_people,
          max_people: s.max_people,
          taken: rows.length,
          signedUp: !!mine,
          blocked,
          past: startTs <= now,
          started: !!mine?.start_actual_ts,
          ended: !!mine?.end_actual_ts,
          start_actual_ts: mine?.start_actual_ts ?? null,
          end_actual_ts: mine?.end_actual_ts ?? null,
          note: mine?.note ?? null,
        };
      });
    return { shifts: result };
  });

export const signupForShift = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { data: result, error } = await supabase.rpc("employee_signup_for_shift", {
      _secret: rpcSecret(),
      _employee_id: employeeId,
      _shift_id: data.shiftId,
    });
    if (error) return { status: "error" as const };
    return { status: result as "ok" | "full" | "conflict" | "past" | "already" | "not_found" };
  });

export const cancelSignup = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { data: result, error } = await supabase.rpc("employee_cancel_signup", {
      _secret: rpcSecret(),
      _employee_id: employeeId,
      _shift_id: data.shiftId,
    });
    if (error) return { status: "error" as const };
    return { status: result as "ok" | "not_found" | "started" };
  });

export const startShift = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { error } = await supabase.rpc("employee_start_shift", {
      _secret: rpcSecret(),
      _employee_id: employeeId,
      _shift_id: data.shiftId,
    });
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const endShift = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { error } = await supabase.rpc("employee_end_shift", {
      _secret: rpcSecret(),
      _employee_id: employeeId,
      _shift_id: data.shiftId,
    });
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const saveShiftNote = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ shiftId: z.string().uuid(), note: z.string().max(1000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { error } = await supabase.rpc("employee_save_note", {
      _secret: rpcSecret(),
      _employee_id: employeeId,
      _shift_id: data.shiftId,
      _note: data.note,
    });
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const getMyShifts = createServerFn({ method: "GET" }).handler(async () => {
  const { readEmployeeId } = await import("./session.server");
  const employeeId = readEmployeeId();
  if (!employeeId) return { shifts: [] as any[] };
  const supabase = await db();
  const { data } = await supabase.rpc("employee_select_my_shifts", {
    _secret: rpcSecret(),
    _employee_id: employeeId,
  });
  const rows = ((data as any[]) ?? []).filter((r: any) => r.shifts);
  rows.sort((a: any, b: any) =>
    a.shifts.shift_date < b.shifts.shift_date
      ? 1
      : a.shifts.shift_date > b.shifts.shift_date
        ? -1
        : 0,
  );
  return { shifts: rows };
});

export const getMyProjects = createServerFn({ method: "GET" }).handler(async () => {
  const { readEmployeeId } = await import("./session.server");
  const employeeId = readEmployeeId();
  if (!employeeId) return { current: null as any, completed: [] as any[] };
  const supabase = await db();
  const { data } = await supabase.rpc("employee_select_my_projects", {
    _secret: rpcSecret(),
    _employee_id: employeeId,
  });
  const rows = (data as any[]) ?? [];
  return {
    current: rows.find((r: any) => r.status === "assigned") ?? null,
    completed: rows
      .filter((r: any) => r.status === "completed")
      .sort((a: any, b: any) => (a.completed_at < b.completed_at ? 1 : -1)),
  };
});

export const completeCurrentProject = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ employeeProjectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { error } = await supabase.rpc("employee_complete_project", {
      _secret: rpcSecret(),
      _employee_id: employeeId,
      _employee_project_id: data.employeeProjectId,
    });
    return { status: error ? ("error" as const) : ("ok" as const) };
  });
