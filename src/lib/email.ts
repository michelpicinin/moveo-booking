import { config } from "./config";
import type { BookingView, CardView } from "./booking";
import { dayLong, money, time } from "./format";
import { creditsLeft } from "./policy";

/**
 * Sends email through Resend (https://resend.com) when RESEND_API_KEY is set.
 * Without it, emails are printed to the server log, which is fine for development.
 */
async function send(to: string | null, subject: string, text: string) {
  if (!to) return;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "MOVEO Yoga <yoga@moveo.lu>";
  if (!key) {
    console.log(`[email] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, reply_to: process.env.EMAIL_REPLY_TO || undefined }),
  });
  if (!res.ok) console.error(`[email] failed (${res.status}): ${await res.text()}`);
}

// Emails go out in English + French, the two most common languages at the studio.
export async function sendBookingConfirmation(b: BookingView) {
  const when = `${dayLong(b.startsAt, "en")}, ${time(b.startsAt, "en")}`;
  const link = `${config.appUrl}/en/b/${b.code}`;
  await send(
    b.customerEmail,
    `Booked: ${b.title}, ${when}`,
    [
      `Hi ${b.customerName},`,
      ``,
      `You're booked for ${b.title} with ${b.instructor} on ${when} (${b.durationMin} min) at ${b.location}.`,
      `Reference: ${b.code}`,
      ``,
      `Your ticket, Apple Wallet pass and cancellation: ${link}`,
      `Free cancellation up to ${config.cancelHours} hours before class.`,
      ``,
      `— Réservation confirmée : ${b.title}, ${dayLong(b.startsAt, "fr")} à ${time(b.startsAt, "fr")}. Gérer : ${config.appUrl}/fr/b/${b.code}`,
      ``,
      `See you on the mat,`,
      `MOVEO Belair`,
    ].join("\n"),
  );
}

export async function sendCardConfirmation(c: CardView) {
  const link = `${config.appUrl}/en/c/${c.code}`;
  await send(
    c.customerEmail,
    `Your ${c.creditsTotal}-session yoga card`,
    [
      `Hi ${c.customerName},`,
      ``,
      `Thanks for buying a ${c.creditsTotal}-session card (${money(c.amountCents, "en")}).`,
      `Card code: ${c.code}`,
      `Sessions left: ${creditsLeft(c)} of ${c.creditsTotal}`,
      ``,
      `Book classes with your email and this code at ${config.appUrl}/en.`,
      `Balance and Apple Wallet pass: ${link}`,
      ``,
      `— Votre carte ${c.creditsTotal} séances. Code : ${c.code}. Solde : ${config.appUrl}/fr/c/${c.code}`,
      ``,
      `MOVEO Belair`,
    ].join("\n"),
  );
}

/** Copy for the studio (STUDIO_NOTIFY_EMAIL, e.g. info@moveo.lu) on every booking and card sale. */
const studioInbox = () => process.env.STUDIO_NOTIFY_EMAIL || null;

const KIND_LABEL: Record<BookingView["kind"], string> = {
  dropin: "Drop-in (paid online)",
  card: "10-session card",
  walkin: "Walk-in",
  trial: "Free trial",
};

export async function notifyStudioBooking(b: BookingView) {
  const when = `${dayLong(b.startsAt, "en")}, ${time(b.startsAt, "en")}`;
  await send(
    studioInbox(),
    `New booking: ${b.customerName} – ${b.title}, ${when}`,
    [
      `${b.customerName} (${b.customerEmail ?? "no email"}) booked ${b.title} with ${b.instructor} on ${when}.`,
      `Type: ${KIND_LABEL[b.kind]}${b.kind === "dropin" ? ` · ${money(b.amountCents, "en")}` : ""}`,
      `Reference: ${b.code}`,
      ``,
      `Class list: ${config.appUrl}/staff/class/${b.classId}`,
    ].join("\n"),
  );
}

export async function notifyStudioCard(c: CardView) {
  await send(
    studioInbox(),
    `New ${c.creditsTotal}-session card sold: ${c.customerName}`,
    [
      `${c.customerName} (${c.customerEmail ?? "no email"}) bought a ${c.creditsTotal}-session card for ${money(c.amountCents, "en")}.`,
      `Card code: ${c.code}`,
      c.expiresAt ? `Valid until: ${c.expiresAt.toISOString().slice(0, 10)}` : ``,
    ].join("\n"),
  );
}
