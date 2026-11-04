"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  attachCheckoutRef,
  BookingError,
  bookTrial,
  bookWithCard,
  cancelBooking,
  createPendingCard,
  createPendingDropin,
  expireCheckout,
  getBookingByCode,
  getClass,
} from "@/lib/booking";
import { completeCheckout } from "@/lib/checkout";
import { config, mockPaymentsEnabled } from "@/lib/config";
import { dayLong, time } from "@/lib/format";
import { isLocale, t, type ErrorKey, type Locale } from "@/lib/i18n";
import { expireCheckouts, refundMoney, startCheckout } from "@/lib/payments";


export type FormState = { error?: string; fieldErrors?: Partial<Record<"name" | "email" | "cardCode", true>> };

const localeOf = (fd: FormData): Locale => {
  const l = String(fd.get("locale") ?? "en");
  return isLocale(l) ? l : "en";
};

const person = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
});

function errorMessage(locale: Locale, e: unknown): string {
  const d = t(locale);
  if (e instanceof BookingError) return d.errors[e.code as ErrorKey] ?? d.errors.payment;
  console.error(e);
  return d.errors.payment;
}

export async function bookClassAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = localeOf(fd);
  const d = t(locale);
  const method = String(fd.get("method") ?? "dropin");
  const classId = String(fd.get("classId") ?? "");
  const cardCodeRaw = String(fd.get("cardCode") ?? "").trim();

  const parsed = person.safeParse({ name: fd.get("name"), email: fd.get("email") });
  const fieldErrors: FormState["fieldErrors"] = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as "name" | "email"] = true;
  }
  if (method === "mycard" && cardCodeRaw.length < 6) fieldErrors.cardCode = true;
  // With an existing card we only need the email.
  if (method === "mycard") delete fieldErrors.name;
  if (Object.keys(fieldErrors).length) return { error: d.errors.invalid, fieldErrors };
  const name = parsed.success ? parsed.data.name : String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email")).trim().toLowerCase();

  let target: string;
  try {
    const cls = await getClass(classId);
    if (!cls) throw new BookingError("class_not_found");
    const when = `${dayLong(cls.startsAt, locale)}, ${time(cls.startsAt, locale)}`;

    if (method === "trial") {
      const { bookingCode } = await bookTrial({ classId, name, email });
      const b = await getBookingByCode(bookingCode);
      if (b) await import("@/lib/email").then((m) => Promise.all([m.sendBookingConfirmation(b), m.notifyStudioBooking(b)])).catch(console.error);
      target = `/${locale}/b/${bookingCode}`;
    } else if (method === "mycard") {
      const { bookingCode } = await bookWithCard({ classId, email, cardCode: cardCodeRaw });
      const b = await getBookingByCode(bookingCode);
      if (b) await import("@/lib/email").then((m) => Promise.all([m.sendBookingConfirmation(b), m.notifyStudioBooking(b)])).catch(console.error);
      target = `/${locale}/b/${bookingCode}`;
    } else if (method === "newcard") {
      const pending = await createPendingCard({ name, email, classId });
      await expireCheckouts(pending.supersededRefs);
      const checkout = await startCheckout({
        locale,
        email,
        line: {
          name: `${d.card10(config.cardCredits)} – MOVEO Yoga`,
          description: `${d.payNewCardHint} ${cls.title}, ${when}`,
          amountCents: config.cardCents,
        },
        metadata: { card_id: pending.cardId, booking_id: pending.booking?.bookingId ?? "", kind: "card" },
      });
      await attachCheckoutRef(checkout.ref, { cardId: pending.cardId, bookingId: pending.booking?.bookingId });
      target = checkout.url;
    } else {
      const pending = await createPendingDropin({ classId, name, email });
      await expireCheckouts(pending.supersededRefs);
      const checkout = await startCheckout({
        locale,
        email,
        line: { name: `${cls.title} – ${d.dropIn}`, description: `${when}, ${d.with} ${cls.instructor}`, amountCents: config.dropInCents },
        metadata: { booking_id: pending.bookingId, kind: "dropin" },
      });
      await attachCheckoutRef(checkout.ref, { bookingId: pending.bookingId });
      target = checkout.url;
    }
  } catch (e) {
    return { error: errorMessage(locale, e) };
  }
  redirect(target);
}

export async function buyCardAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = localeOf(fd);
  const d = t(locale);
  const parsed = person.safeParse({ name: fd.get("name"), email: fd.get("email") });
  if (!parsed.success) {
    const fieldErrors: FormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as "name" | "email"] = true;
    return { error: d.errors.invalid, fieldErrors };
  }
  let target: string;
  try {
    const pending = await createPendingCard(parsed.data);
    const checkout = await startCheckout({
      locale,
      email: parsed.data.email,
      line: { name: `${d.card10(config.cardCredits)} – MOVEO Yoga`, description: d.card10Desc(config.cardCredits, config.cardValidityDays), amountCents: config.cardCents },
      metadata: { card_id: pending.cardId, kind: "card" },
    });
    await attachCheckoutRef(checkout.ref, { cardId: pending.cardId });
    target = checkout.url;
  } catch (e) {
    return { error: errorMessage(locale, e) };
  }
  redirect(target);
}

export async function lookupCardAction(fd: FormData) {
  const locale = localeOf(fd);
  const code = String(fd.get("cardCode") ?? "").trim();
  redirect(`/${locale}/c/${encodeURIComponent(code)}`);
}

export async function cancelBookingAction(fd: FormData) {
  const locale = localeOf(fd);
  const code = String(fd.get("code") ?? "");
  let outcome = "none";
  try {
    const r = await cancelBooking(code, refundMoney);
    outcome = r.refund;
  } catch (e) {
    if (!(e instanceof BookingError)) throw e;
  }
  redirect(`/${locale}/b/${code}?cancelled=${outcome}`);
}

/** Simulated payment page (development only). */
export async function mockPayAction(fd: FormData) {
  if (!mockPaymentsEnabled) throw new Error("Mock payments are disabled");
  const locale = localeOf(fd);
  const ref = String(fd.get("ref"));
  if (fd.get("outcome") === "pay") {
    await completeCheckout(ref, ref);
    redirect(`/${locale}/checkout/return?ref=${encodeURIComponent(ref)}`);
  }
  await expireCheckout(ref);
  redirect(`/${locale}/checkout/return?ref=${encodeURIComponent(ref)}&cancelled=1`);
}
