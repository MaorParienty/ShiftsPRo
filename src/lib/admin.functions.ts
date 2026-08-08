import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { monthRange } from "./time";

// Admin operations run through the admin's own authenticated Supabase session
// (attached by requireSupabaseAuth), relying on the "admins manage X" RLS
// policies already defined in the schema — no service-role key needed.
async function assertAdmin(context: any) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("FORBIDDEN");
  return context.supabase;
}

/* ---------------------------------- auth ---------------------------------- */

export const getAdminSelf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context as any).supabase.rpc("has_role", {
      _user_id: (context as any).userId,
      _role: "admin",
    });
    return { isAdmin: !!data, userId: (context as any).userId };
  });

/* --------------------------------- shifts --------------------------------- */

export const adminMonthShifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { start, end } = monthRange(data.year, data.month);
    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, shift_date, start_time, end_time, min_people, max_people")
      .gte("shift_date", start)
      .lte("shift_date", end)
      .order("start_time");
    const ids = (shifts ?? []).map((s: any) => s.id);
    const { data: signups } = ids.length
      ? await supabase
          .from("shift_signups")
          .select("shift_id, start_actual_ts, end_actual_ts")
          .in("shift_id", ids)
      : { data: [] as any[] };
    const days: Record<
      string,
      { total: number; people: number; needsPeople: number; full: number; inProgress: number }
    > = {};
    for (const s of shifts ?? []) {
      const rows = (signups ?? []).filter((x: any) => x.shift_id === s.id);
      const d = (days[s.shift_date] ??= {
        total: 0,
        people: 0,
        needsPeople: 0,
        full: 0,
        inProgress: 0,
      });
      d.total += 1;
      d.people += rows.length;
      if (rows.length < s.min_people) d.needsPeople += 1;
      if (rows.length >= s.max_people) d.full += 1;
      d.inProgress += rows.filter((r: any) => r.start_actual_ts && !r.end_actual_ts).length;
    }
    return { days, shifts: shifts ?? [] };
  });

export const adminDayDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, shift_date, start_time, end_time, min_people, max_people")
      .eq("shift_date", data.date)
      .order("start_time");
    const ids = (shifts ?? []).map((s: any) => s.id);
    const { data: signups } = ids.length
      ? await supabase
          .from("shift_signups")
          .select(
            "id, shift_id, employee_id, start_actual_ts, end_actual_ts, note, note_updated_at, employees(id, first_name, last_name, phone)",
          )
          .in("shift_id", ids)
      : { data: [] as any[] };
    const { data: rules } = ids.length
      ? await supabase.from("shift_conflict_rules").select("shift_id, rule_id").in("shift_id", ids)
      : { data: [] as any[] };
    return {
      shifts: (shifts ?? []).map((s: any) => ({
        ...s,
        ruleIds: (rules ?? []).filter((r: any) => r.shift_id === s.id).map((r: any) => r.rule_id),
        signups: (signups ?? []).filter((x: any) => x.shift_id === s.id),
      })),
    };
  });

const shiftInput = z.object({
  shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string(),
  end_time: z.string(),
  min_people: z.number().int().min(0),
  max_people: z.number().int().min(1),
  ruleIds: z.array(z.string().uuid()).default([]),
});

export const createShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => shiftInput.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    if (data.max_people < data.min_people) return { status: "invalid" as const };
    const { data: created, error } = await supabase
      .from("shifts")
      .insert({
        shift_date: data.shift_date,
        start_time: data.start_time,
        end_time: data.end_time,
        min_people: data.min_people,
        max_people: data.max_people,
      })
      .select("id")
      .single();
    if (error || !created) return { status: "error" as const };
    if (data.ruleIds.length) {
      await supabase
        .from("shift_conflict_rules")
        .insert(data.ruleIds.map((rule_id) => ({ shift_id: created.id, rule_id })));
    }
    return { status: "ok" as const, id: created.id };
  });

export const updateShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => shiftInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    if (data.max_people < data.min_people) return { status: "invalid" as const };
    const { error } = await supabase
      .from("shifts")
      .update({
        shift_date: data.shift_date,
        start_time: data.start_time,
        end_time: data.end_time,
        min_people: data.min_people,
        max_people: data.max_people,
      })
      .eq("id", data.id);
    if (error) return { status: "error" as const };
    await supabase.from("shift_conflict_rules").delete().eq("shift_id", data.id);
    if (data.ruleIds.length) {
      await supabase
        .from("shift_conflict_rules")
        .insert(data.ruleIds.map((rule_id) => ({ shift_id: data.id, rule_id })));
    }
    return { status: "ok" as const };
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { error } = await supabase.from("shifts").delete().eq("id", data.id);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const duplicateShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { data: src } = await supabase.from("shifts").select("*").eq("id", data.id).maybeSingle();
    if (!src) return { status: "not_found" as const };
    const { data: rules } = await supabase
      .from("shift_conflict_rules")
      .select("rule_id")
      .eq("shift_id", data.id);
    let created = 0;
    for (const date of data.dates) {
      const { data: row } = await supabase
        .from("shifts")
        .insert({
          shift_date: date,
          start_time: src.start_time,
          end_time: src.end_time,
          min_people: src.min_people,
          max_people: src.max_people,
        })
        .select("id")
        .single();
      if (row && (rules ?? []).length) {
        await supabase
          .from("shift_conflict_rules")
          .insert((rules ?? []).map((r: any) => ({ shift_id: row.id, rule_id: r.rule_id })));
      }
      if (row) created += 1;
    }
    return { status: "ok" as const, created };
  });

/* --------------------------- signups management --------------------------- */

export const adminAddSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        shiftId: z.string().uuid(),
        employeeId: z.string().uuid(),
        override: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { data: result, error } = await supabase.rpc("signup_for_shift", {
      _shift_id: data.shiftId,
      _employee_id: data.employeeId,
      _override: data.override,
    });
    if (error) return { status: "error" as const };
    return { status: result as "ok" | "full" | "conflict" | "past" | "already" | "not_found" };
  });

export const adminRemoveSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ signupId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { error } = await supabase.from("shift_signups").delete().eq("id", data.signupId);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const adminUpdateSignupTimes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        signupId: z.string().uuid(),
        start: z.string().nullable(),
        end: z.string().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    if (data.start && data.end && new Date(data.end) <= new Date(data.start)) {
      return { status: "invalid" as const };
    }
    const { error } = await supabase
      .from("shift_signups")
      .update({ start_actual_ts: data.start, end_actual_ts: data.end })
      .eq("id", data.signupId);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

/* ------------------------------ conflict rules ----------------------------- */

export const listConflictRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = await assertAdmin(context);
    const { data } = await supabase
      .from("conflict_rules")
      .select(
        "id, employee_id_a, employee_id_b, a:employees!conflict_rules_employee_id_a_fkey(id, first_name, last_name), b:employees!conflict_rules_employee_id_b_fkey(id, first_name, last_name)",
      )
      .order("created_at");
    return { rules: data ?? [] };
  });

export const createConflictRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ a: z.string().uuid(), b: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    if (data.a === data.b) return { status: "invalid" as const };
    const { error } = await supabase
      .from("conflict_rules")
      .insert({ employee_id_a: data.a, employee_id_b: data.b });
    if (error) return { status: "duplicate" as const };
    return { status: "ok" as const };
  });

export const deleteConflictRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { error } = await supabase.from("conflict_rules").delete().eq("id", data.id);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

/** Upcoming shifts where both employees of a rule are signed up together. */
export const conflictRuleViolations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = await assertAdmin(context);
    const today = new Date().toISOString().slice(0, 10);
    const { data: rules } = await supabase
      .from("conflict_rules")
      .select("id, employee_id_a, employee_id_b");
    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, shift_date, start_time, shift_signups(employee_id)")
      .gte("shift_date", today);
    const map: Record<string, { shift_date: string; start_time: string }[]> = {};
    for (const rule of rules ?? []) {
      for (const s of shifts ?? []) {
        const ids = (s.shift_signups ?? []).map((x: any) => x.employee_id);
        if (ids.includes(rule.employee_id_a) && ids.includes(rule.employee_id_b)) {
          (map[rule.id] ??= []).push({ shift_date: s.shift_date, start_time: s.start_time });
        }
      }
    }
    return { violations: map };
  });

/* -------------------------------- employees -------------------------------- */

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = await assertAdmin(context);
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, phone, created_at")
      .order("first_name");
    return { employees: data ?? [] };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        first_name: z.string().trim().min(1).max(60),
        last_name: z.string().trim().min(1).max(60),
        phone: z.string().trim().min(9).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { error } = await supabase
      .from("employees")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone.replace(/\D/g, ""),
      })
      .eq("id", data.id);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { error } = await supabase.from("employees").delete().eq("id", data.id);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const employeeShiftHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ employeeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { data: rows } = await supabase
      .from("shift_signups")
      .select(
        "id, start_actual_ts, end_actual_ts, note, shifts(id, shift_date, start_time, end_time)",
      )
      .eq("employee_id", data.employeeId);
    const list = (rows ?? []).filter((r: any) => r.shifts);
    list.sort((a: any, b: any) => (a.shifts.shift_date < b.shifts.shift_date ? 1 : -1));
    return { shifts: list };
  });

/* ------------------------------- hours report ------------------------------ */

export const hoursReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { start, end } = monthRange(data.year, data.month);
    const { data: employees } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .order("first_name");
    const { data: rows } = await supabase
      .from("shift_signups")
      .select("employee_id, start_actual_ts, end_actual_ts, shifts!inner(shift_date)")
      .gte("shifts.shift_date", start)
      .lte("shifts.shift_date", end);
    const { data: adjustments } = await supabase
      .from("hours_adjustments")
      .select("employee_id, hours")
      .eq("year", data.year)
      .eq("month", data.month);
    return {
      report: (employees ?? []).map((e: any) => {
        const mine = (rows ?? []).filter((r: any) => r.employee_id === e.id);
        const computedHours = mine.reduce((acc: number, r: any) => {
          if (!r.start_actual_ts || !r.end_actual_ts) return acc;
          const ms = new Date(r.end_actual_ts).getTime() - new Date(r.start_actual_ts).getTime();
          return acc + Math.max(0, ms) / 3600000;
        }, 0);
        const adjustmentHours = (adjustments ?? [])
          .filter((a: any) => a.employee_id === e.id)
          .reduce((acc: number, a: any) => acc + Number(a.hours), 0);
        return {
          id: e.id,
          name: `${e.first_name} ${e.last_name}`,
          computedHours,
          adjustmentHours,
          hours: computedHours + adjustmentHours,
          completed: mine.filter((r: any) => r.start_actual_ts && r.end_actual_ts).length,
          inProgress: mine.filter((r: any) => r.start_actual_ts && !r.end_actual_ts).length,
          signups: mine.length,
        };
      }),
    };
  });

export const listHoursAdjustments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        employeeId: z.string().uuid(),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { data: rows } = await supabase
      .from("hours_adjustments")
      .select("id, hours, reason, created_at")
      .eq("employee_id", data.employeeId)
      .eq("year", data.year)
      .eq("month", data.month)
      .order("created_at", { ascending: false });
    return { adjustments: rows ?? [] };
  });

export const addHoursAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        employeeId: z.string().uuid(),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
        hours: z.number().refine((n) => n !== 0, "hours must not be zero"),
        reason: z.string().trim().min(1).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { error } = await supabase.from("hours_adjustments").insert({
      employee_id: data.employeeId,
      year: data.year,
      month: data.month,
      hours: data.hours,
      reason: data.reason,
    });
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const deleteHoursAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { error } = await supabase.from("hours_adjustments").delete().eq("id", data.id);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

/* --------------------------------- projects -------------------------------- */

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = await assertAdmin(context);
    const { data } = await supabase
      .from("projects")
      .select("id, name, description, created_at")
      .order("created_at");
    return { projects: data ?? [] };
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ name: z.string().trim().min(1).max(120), description: z.string().max(2000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { error } = await supabase
      .from("projects")
      .insert({ name: data.name, description: data.description || null });
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        description: z.string().max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { error } = await supabase
      .from("projects")
      .update({ name: data.name, description: data.description || null })
      .eq("id", data.id);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { error } = await supabase.from("projects").delete().eq("id", data.id);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const employeeQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ employeeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { data: rows } = await supabase
      .from("employee_projects")
      .select("id, order_index, status, completed_at, projects(id, name, description)")
      .eq("employee_id", data.employeeId)
      .order("order_index");
    return {
      assigned: (rows ?? []).filter((r: any) => r.status === "assigned"),
      completed: (rows ?? []).filter((r: any) => r.status === "completed"),
    };
  });

export const assignProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ employeeId: z.string().uuid(), projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { data: rows } = await supabase
      .from("employee_projects")
      .select("order_index")
      .eq("employee_id", data.employeeId)
      .order("order_index", { ascending: false })
      .limit(1);
    const next = ((rows ?? [])[0]?.order_index ?? -1) + 1;
    const { error } = await supabase.from("employee_projects").insert({
      employee_id: data.employeeId,
      project_id: data.projectId,
      order_index: next,
    });
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const removeQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    const { error } = await supabase.from("employee_projects").delete().eq("id", data.id);
    return { status: error ? ("error" as const) : ("ok" as const) };
  });

export const reorderQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    for (let i = 0; i < data.ids.length; i++) {
      await supabase.from("employee_projects").update({ order_index: i }).eq("id", data.ids[i]);
    }
    return { status: "ok" as const };
  });

/* ---------------------------------- notes ---------------------------------- */

export const listNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        employeeId: z.string().uuid().nullable().default(null),
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .default(null),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = await assertAdmin(context);
    let query = supabase
      .from("shift_signups")
      .select(
        "id, note, note_updated_at, employee_id, employees(first_name, last_name), shifts!inner(id, shift_date, start_time, end_time)",
      )
      .not("note", "is", null);
    if (data.employeeId) query = query.eq("employee_id", data.employeeId);
    if (data.from) query = query.gte("shifts.shift_date", data.from);
    if (data.to) query = query.lte("shifts.shift_date", data.to);
    const { data: rows } = await query;
    const list = (rows ?? []).filter((r: any) => r.shifts && r.note);
    list.sort((a: any, b: any) => (a.shifts.shift_date < b.shifts.shift_date ? 1 : -1));
    return { notes: list };
  });

/* ------------------------- first-time admin setup -------------------------- */

// Whether any admin exists yet — checked via a SECURITY DEFINER function since
// the caller isn't signed in yet and RLS would otherwise hide the answer.
export const adminBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabasePublic } = await import("@/integrations/supabase/client.public-server");
  const { data } = await (supabasePublic as any).rpc("admin_bootstrap_needed");
  return { needsSetup: !!data };
});
