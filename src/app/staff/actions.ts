"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addWalkIn,
  BookingError,
  cancelBooking,
  cancelClass,
  createClasses,
  setCheckIn,
} from "@/lib/booking";
import { zonedToUtc } from "@/lib/format";
import { refundMoney } from "@/lib/payments";
import { endStaffSession, passwordMatches, requireStaff, startStaffSession } from "@/lib/staff-auth";

export type StaffState = { error?: string; ok?: string };

const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/staff") ? n : "/staff");

export async function loginAction(_prev: StaffState, fd: FormData): Promise<StaffState> {
  // Small delay makes password guessing slow.
  await new Promise((r) => setTimeout(r, 400));
  if (!passwordMatches(String(fd.get("password") ?? ""))) return { error: "Wrong password." };
  await startStaffSession();
  redirect(safeNext(fd.get("next")));
}

export async function logoutAction() {
  await endStaffSession();
  redirect("/staff/login");
}

export async function toggleCheckInAction(fd: FormData) {
  await requireStaff();
  await setCheckIn(String(fd.get("bookingId")), fd.get("present") === "1");
  revalidatePath(`/staff/class/${fd.get("classId")}`);
  const back = fd.get("back");
  if (typeof back === "string" && back.startsWith("/staff")) redirect(back);
}

function bookingErrorText(e: unknown) {
  if (e instanceof BookingError) {
    const map: Record<string, string> = {
      card_not_found: "Card code not found.",
      card_not_active: "This card isn't active.",
      card_expired: "This card has expired.",
      card_empty: "This card has no sessions left.",
      already_booked: "This person is already on the list.",
      class_cancelled: "This class is cancelled.",
    };
    return map[e.code] ?? e.code;
  }
  console.error(e);
  return "Something went wrong.";
}

export async function walkInAction(_prev: StaffState, fd: FormData): Promise<StaffState> {
  await requireStaff();
  const classId = String(fd.get("classId"));
  const name = String(fd.get("name") ?? "").trim();
  const cardCode = String(fd.get("cardCode") ?? "").trim();
  if (!cardCode && name.length < 2) return { error: "Enter a name (or a card code)." };
  try {
    await addWalkIn({ classId, name, email: String(fd.get("email") ?? "") || null, cardCode: cardCode || null });
  } catch (e) {
    return { error: bookingErrorText(e) };
  }
  revalidatePath(`/staff/class/${classId}`);
  return { ok: cardCode ? "Checked in with card (1 session used)." : `${name} added and checked in. Collect the drop-in fee.` };
}

export async function cardCheckInAction(fd: FormData) {
  await requireStaff();
  const classId = String(fd.get("classId"));
  const cardCode = String(fd.get("cardCode"));
  let err = "";
  try {
    await addWalkIn({ classId, name: "", cardCode });
  } catch (e) {
    err = bookingErrorText(e);
  }
  redirect(err ? `/staff/scan/${encodeURIComponent(cardCode)}?error=${encodeURIComponent(err)}` : `/staff/class/${classId}?ok=card`);
}

export async function staffCancelBookingAction(fd: FormData) {
  await requireStaff();
  const code = String(fd.get("code"));
  await cancelBooking(code, refundMoney, { forceRefund: fd.get("refund") === "1" }).catch((e) => {
    if (!(e instanceof BookingError)) throw e;
  });
  revalidatePath(`/staff/class/${fd.get("classId")}`);
}

export async function addClassesAction(_prev: StaffState, fd: FormData): Promise<StaffState> {
  await requireStaff();
  const title = String(fd.get("title") ?? "").trim();
  const instructor = String(fd.get("instructor") ?? "").trim();
  const date = String(fd.get("date") ?? "");
  const at = String(fd.get("time") ?? "");
  const durationMin = Number(fd.get("duration"));
  const capacity = Number(fd.get("capacity"));
  const weeks = Math.min(Math.max(Number(fd.get("weeks") ?? 1), 1), 52);
  if (!title || !instructor || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(at))
    return { error: "Please fill in title, teacher, date and time." };
  if (!(durationMin > 0) || !(capacity > 0)) return { error: "Duration and capacity must be positive." };

  const rows = [];
  for (let w = 0; w < weeks; w++) {
    const day = new Date(`${date}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + 7 * w);
    rows.push({ title, instructor, startsAt: zonedToUtc(day.toISOString().slice(0, 10), at), durationMin, capacity });
  }
  await createClasses(rows);
  revalidatePath("/staff/schedule");
  return { ok: `Added ${rows.length} class${rows.length > 1 ? "es" : ""}.` };
}

export async function cancelClassAction(fd: FormData) {
  await requireStaff();
  await cancelClass(String(fd.get("classId")), refundMoney);
  revalidatePath("/staff/schedule");
  revalidatePath("/staff");
}
