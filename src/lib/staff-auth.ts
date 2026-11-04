import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "moveo_staff";
const MAX_AGE_DAYS = 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (at least 16 characters)");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function passwordMatches(input: string) {
  const expected = process.env.STAFF_PASSWORD;
  if (!expected) return false;
  return safeEqual(sign(input), sign(expected));
}

export async function startStaffSession() {
  const payload = `staff.${Date.now()}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_DAYS * 86400,
  });
}

export async function endStaffSession() {
  (await cookies()).delete(COOKIE);
}

export async function isStaff(): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const i = v.lastIndexOf(".");
  const payload = v.slice(0, i);
  const sig = v.slice(i + 1);
  if (!safeEqual(sig, sign(payload))) return false;
  const issued = Number(payload.split(".")[1]);
  return Date.now() - issued < MAX_AGE_DAYS * 86400_000;
}

/** Use at the top of every staff page and action. */
export async function requireStaff(next = "/staff") {
  if (!(await isStaff())) redirect(`/staff/login?next=${encodeURIComponent(next)}`);
}
