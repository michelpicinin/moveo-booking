import Stripe from "stripe";
import { config, mockPaymentsEnabled, stripeEnabled } from "./config";
import type { Locale } from "./i18n";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!stripeEnabled) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

export type CheckoutLine = { name: string; description?: string; amountCents: number };

/**
 * Starts a hosted payment page. Stripe Checkout shows Apple Pay, Google Pay and cards
 * automatically (enable them under Settings → Payment methods in the Stripe dashboard).
 * Returns the checkout reference and the URL to send the client to.
 */
export async function startCheckout(input: {
  locale: Locale;
  email: string;
  line: CheckoutLine;
  metadata: Record<string, string>;
}): Promise<{ ref: string; url: string }> {
  if (stripeEnabled) {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: input.email,
      locale: input.locale,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: config.currency,
            unit_amount: input.line.amountCents,
            product_data: { name: input.line.name, description: input.line.description },
          },
        },
      ],
      metadata: input.metadata,
      payment_intent_data: { metadata: input.metadata, description: input.line.name },
      expires_at: Math.floor(Date.now() / 1000) + config.holdMinutes * 60,
      success_url: `${config.appUrl}/${input.locale}/checkout/return?ref={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.appUrl}/${input.locale}/checkout/return?ref={CHECKOUT_SESSION_ID}&cancelled=1`,
    });
    return { ref: session.id, url: session.url! };
  }
  if (mockPaymentsEnabled) {
    const ref = `mock_${crypto.randomUUID()}`;
    const qs = new URLSearchParams({ ref, amount: String(input.line.amountCents), name: input.line.name });
    return { ref, url: `/${input.locale}/checkout/mock?${qs}` };
  }
  throw new Error("Payments are not configured: set STRIPE_SECRET_KEY");
}

/** Status of a checkout, used by the return page so we don't depend only on the webhook. */
export async function checkoutStatus(ref: string): Promise<{ paid: boolean; open: boolean; paymentRef: string | null }> {
  if (ref.startsWith("mock_")) return { paid: false, open: true, paymentRef: null };
  const s = await stripe().checkout.sessions.retrieve(ref);
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null);
  return { paid: s.payment_status === "paid", open: s.status === "open", paymentRef: pi };
}

/** Closes checkouts the client abandoned, so they can't be paid twice. */
export async function expireCheckouts(refs: string[]) {
  for (const ref of refs) {
    if (!stripeEnabled || !ref.startsWith("cs_")) continue;
    try {
      await stripe().checkout.sessions.expire(ref);
    } catch {
      // Already completed or expired: nothing to do.
    }
  }
}

export async function refundMoney(paymentRef: string, amountCents: number) {
  if (paymentRef.startsWith("mock_")) return;
  if (!stripeEnabled) throw new Error("Cannot refund: Stripe is not configured");
  await stripe().refunds.create({ payment_intent: paymentRef, amount: amountCents });
}
