import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { isValidIsraeliPhone, monthRange, normalizePhone } from "./time";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
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
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, phone")
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  },
);

export const employeeLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().min(1).max(60),
        phone: z.string().trim().min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!isValidIsraeliPhone(data.phone)) {
      return { status: "invalid_phone" as const };
    }
    const phone = normalizePhone(data.phone);
    const first = data.firstName.trim();
    const last = data.lastName.trim();
    const supabase = await db();
    const { setEmployeeCookie } = await import("./session.server");

    const { data: matches } = await supabase
      .from("employees")
      .select("id, first_name, last_name, phone")
      .ilike("first_name", first)
      .ilike("last_name", last);

    const existing = (matches ?? [])[0];
    if (existing) {
      if (normalizePhone(existing.phone) !== phone) {
        return { status: "phone_mismatch" as const };
      }
      setEmployeeCookie(existing.id);
      return { status: "ok" as const, employee: existing };
    }

    const { data: created, error } = await supabase
      .from("employees")
      .insert({ first_name: first, last_name: last, phone })
      .select("id, first_name, last_name, phone")
      .single();
    if (error || !created) return { status: "error" as const };
    setEmployeeCookie(created.id);
    return { status: "ok" as const, employee: created, isNew: true };
  });

export const employeeLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { clearEmployeeCookie } = await import("./session.server");
  clearEmployeeCookie();
  return { ok: true };
});

export const getMonthOverview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { readEmployeeId } = await import("./session.server");
    const employeeId = readEmployeeId();
    const supabase = await db();
    const { start, end } = monthRange(data.year, data.month);

    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, shift_date, min_people, max_people")
      .gte("shift_date", start)
      .lte("shift_date", end);

    const ids = (shifts ?? []).map((s: any) => s.id);
    const { data: signups } = ids.length
      ? await supabase.from("shift_signups").select("shift_id, employee_id").in("shift_id", ids)
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
  .inputValidator((input: unknown) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ shifts: DayShift[] }> => {
    const { readEmployeeId } = await import("./session.server");
    const employeeId = readEmployeeId();
    const supabase = await db();

    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, shift_date, start_time, end_time, min_people, max_people")
      .eq("shift_date", data.date)
      .order("start_time");

    const ids = (shifts ?? []).map((s: any) => s.id);
    if (!ids.length) return { shifts: [] };

    const { data: signups } = await supabase
      .from("shift_signups")
      .select("shift_id, employee_id, start_actual_ts, end_actual_ts, note")
      .in("shift_id", ids);

    const { data: shiftRules } = await supabase
      .from("shift_conflict_rules")
      .select("shift_id, conflict_rules(employee_id_a, employee_id_b)")
      .in("shift_id", ids);

    const now = Date.now();
    const result: DayShift[] = (shifts ?? []).map((s: any) => {
      const rows = (signups ?? []).filter((x: any) => x.shift_id === s.id);
      const mine = employeeId ? rows.find((x: any) => x.employee_id === employeeId) : null;
      const rules = (shiftRules ?? [])
        .filter((r: any) => r.shift_id === s.id)
        .map((r: any) => r.conflict_rules)
        .filter(Boolean);
      const blocked =
        !!employeeId &&
        !mine &&
        rules.some((rule: any) =>
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
  .inputValidator((input: unknown) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { data: result, error } = await supabase.rpc("signup_for_shift", {
      _shift_id: data.shiftId,
      _employee_id: employeeId,
      _override: false,
    });
    if (error) return { status: "error" as const };
    return { status: result as "ok" | "full" | "conflict" | "past" | "already" | "not_found" };
  });

export const cancelSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { data: row } = await supabase
      .from("shift_signups")
      .select("id, start_actual_ts")
      .eq("shift_id", data.shiftId)
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (!row) return { status: "not_found" as const };
    if (row.start_actual_ts) return { status: "started" as const };
    await supabase.from("shift_signups").delete().eq("id", row.id);
    return { status: "ok" as const };
  });

export const startShift = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { error } = await supabase
      .from("shift_signups")
      .update({ start_actual_ts: new Date().toISOString() })
      .eq("shift_id", data.shiftId)
      .eq("employee_id", employeeId)
      .is("start_actual_ts", null);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const endShift = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { error } = await supabase
      .from("shift_signups")
      .update({ end_actual_ts: new Date().toISOString() })
      .eq("shift_id", data.shiftId)
      .eq("employee_id", employeeId)
      .not("start_actual_ts", "is", null)
      .is("end_actual_ts", null);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const saveShiftNote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ shiftId: z.string().uuid(), note: z.string().max(1000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { error } = await supabase
      .from("shift_signups")
      .update({ note: data.note.trim() || null, note_updated_at: new Date().toISOString() })
      .eq("shift_id", data.shiftId)
      .eq("employee_id", employeeId);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const getMyShifts = createServerFn({ method: "GET" }).handler(async () => {
  const { readEmployeeId } = await import("./session.server");
  const employeeId = readEmployeeId();
  if (!employeeId) return { shifts: [] as any[] };
  const supabase = await db();
  const { data } = await supabase
    .from("shift_signups")
    .select(
      "id, start_actual_ts, end_actual_ts, note, note_updated_at, shifts(id, shift_date, start_time, end_time)",
    )
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []).filter((r: any) => r.shifts);
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
  const { data } = await supabase
    .from("employee_projects")
    .select("id, order_index, status, completed_at, projects(id, name, description)")
    .eq("employee_id", employeeId)
    .order("order_index");
  const rows = data ?? [];
  return {
    current: rows.find((r: any) => r.status === "assigned") ?? null,
    completed: rows
      .filter((r: any) => r.status === "completed")
      .sort((a: any, b: any) => (a.completed_at < b.completed_at ? 1 : -1)),
  };
});

export const completeCurrentProject = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ employeeProjectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireEmployeeId } = await import("./session.server");
    const employeeId = requireEmployeeId();
    const supabase = await db();
    const { error } = await supabase
      .from("employee_projects")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", data.employeeProjectId)
      .eq("employee_id", employeeId)
      .eq("status", "assigned");
    return { status: error ? ("error" as const) : ("ok" as const) };
  });
