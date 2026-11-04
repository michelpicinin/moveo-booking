import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Header } from "@/components/Header";
import { expireCheckout, getBookingsByCheckoutRef, getCardsByCheckoutRef } from "@/lib/booking";
import { syncCheckout } from "@/lib/checkout";
import { stripeEnabled } from "@/lib/config";
import { t, type Locale } from "@/lib/i18n";
import { expireCheckouts } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** Where Stripe sends the client back to, after paying or cancelling. */
export default async function CheckoutReturn({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ ref?: string; cancelled?: string }>;
}) {
  const { locale } = await params;
  const { ref, cancelled } = await searchParams;
  const d = t(locale);
  if (!ref) redirect(`/${locale}`);

  const bookings = await getBookingsByCheckoutRef(ref);
  const cards = await getCardsByCheckoutRef(ref);

  if (cancelled) {
    // Release the spot right away instead of waiting for Stripe to expire the session.
    if (stripeEnabled) await expireCheckouts([ref]);
    await expireCheckout(ref);
    return (
      <>
        <Header locale={locale} />
        <main className="wrap stack">
          <div className="alert alert-warn">{d.paymentCancelled}</div>
          {bookings[0] ? (
            <Link className="btn btn-primary" href={`/${locale}/class/${bookings[0].classId}`}>{d.tryAgain}</Link>
          ) : (
            <Link className="btn btn-primary" href={`/${locale}/card`}>{d.tryAgain}</Link>
          )}
          <Link className="btn btn-outline" href={`/${locale}`}>{d.back}</Link>
        </main>
      </>
    );
  }

  await syncCheckout(ref).catch(console.error);
  if (bookings[0]) redirect(`/${locale}/b/${bookings[0].code}`);
  if (cards[0]) redirect(`/${locale}/c/${cards[0].code}`);

  return (
    <>
      <Header locale={locale} />
      <main className="wrap stack">
        <AutoRefresh />
        <h1>{d.bookingPending}</h1>
        <p className="muted">{d.bookingPendingHint}</p>
      </main>
    </>
  );
}
