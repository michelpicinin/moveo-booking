import {
  expireCheckout,
  fulfillCheckout,
  getBookingByCode,
  getCardByCode,
} from "./booking";
import { sendBookingConfirmation, sendCardConfirmation } from "./email";
import { checkoutStatus } from "./payments";

/** Confirms a paid checkout and emails the client. Emails go out only the first time. */
export async function completeCheckout(ref: string, paymentRef: string | null) {
  const done = await fulfillCheckout(ref, paymentRef);
  for (const code of done.cardCodes) {
    const c = await getCardByCode(code);
    if (c) await sendCardConfirmation(c).catch((e) => console.error("[email]", e));
  }
  for (const code of done.bookingCodes) {
    const b = await getBookingByCode(code);
    if (b) await sendBookingConfirmation(b).catch((e) => console.error("[email]", e));
  }
  return done;
}

/** Asks Stripe for the latest state of a checkout and applies it (backup for a slow webhook). */
export async function syncCheckout(ref: string) {
  if (ref.startsWith("mock_")) return;
  const s = await checkoutStatus(ref);
  if (s.paid) await completeCheckout(ref, s.paymentRef);
  else if (!s.open) await expireCheckout(ref);
}
