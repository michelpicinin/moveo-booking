import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { mockPaymentsEnabled } from "@/lib/config";
import { money } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { mockPayAction } from "../../actions";

export const dynamic = "force-dynamic";

/** Stand-in for Stripe Checkout while no Stripe key is configured (dev / demo only). */
export default async function MockCheckout({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ ref?: string; amount?: string; name?: string }>;
}) {
  if (!mockPaymentsEnabled) notFound();
  const { locale } = await params;
  const { ref = "", amount = "0", name = "" } = await searchParams;
  return (
    <>
      <Header locale={locale} />
      <main className="wrap stack">
        <div className="alert alert-warn">Test mode: no real payment. With Stripe configured, this is the Stripe payment page.</div>
        <div className="panel stack">
          <p className="eyebrow">{name}</p>
          <h1>{money(Number(amount), locale)}</h1>
          <form action={mockPayAction} className="stack">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="ref" value={ref} />
            <button className="btn btn-primary btn-block" name="outcome" value="pay"> Pay (simulated Apple Pay)</button>
            <button className="btn btn-outline btn-block" name="outcome" value="cancel">Cancel</button>
          </form>
        </div>
      </main>
    </>
  );
}
