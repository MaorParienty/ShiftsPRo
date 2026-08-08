import { createHmac, timingSafeEqual } from "crypto";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

const COOKIE_NAME = "emp_session";
const MAX_AGE = 60 * 60 * 24 * 365;

function secret(): string {
  return process.env["EMPLOYEE_SESSION_SECRET"] ?? "dev-insecure-secret";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function serializeEmployeeSession(employeeId: string): string {
  const value = `${employeeId}.${sign(employeeId)}`;
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; HttpOnly; Secure`;
}

export function setEmployeeCookie(employeeId: string) {
  setResponseHeader("set-cookie", serializeEmployeeSession(employeeId));
}

export function clearEmployeeCookie() {
  setResponseHeader(
    "set-cookie",
    `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure`,
  );
}

export function readEmployeeId(): string | null {
  const header = getRequest().headers.get("cookie");
  if (!header) return null;
  const raw = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return null;
  const value = decodeURIComponent(raw.slice(COOKIE_NAME.length + 1));
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return null;
  const id = value.slice(0, idx);
  const mac = value.slice(idx + 1);
  const expected = sign(id);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return id;
}

export function requireEmployeeId(): string {
  const id = readEmployeeId();
  if (!id) throw new Error("NOT_AUTHENTICATED");
  return id;
}
