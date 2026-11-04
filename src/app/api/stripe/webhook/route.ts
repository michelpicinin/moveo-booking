import type Stripe from "stripe";
import { expireCheckout } from "@/lib/booking";
import { completeCheckout } from "@/lib/checkout";
import { sql } from "@/lib/db";
import { stripe } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * Stripe → this endpoint. Configure in Stripe Dashboard → Developers → Webhooks with events:
 * checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook secret not configured", { status: 500 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const [fresh] = await sql`insert into processed_events (id) values (${event.id}) on conflict do nothing returning id`;
  if (!fresh) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object;
        if (s.payment_status === "paid") {
          const pi = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null);
          await completeCheckout(s.id, pi);
        }
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await expireCheckout(event.data.object.id);
        break;
    }
  } catch (e) {
    // Let Stripe retry.
    await sql`delete from processed_events where id = ${event.id}`;
    console.error("[webhook]", e);
    return new Response("Processing failed", { status: 500 });
  }
  return Response.json({ received: true });
}
