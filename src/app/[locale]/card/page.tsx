import Link from "next/link";
import { BuyCardForm } from "@/components/BuyCardForm";
import { Header } from "@/components/Header";
import { config } from "@/lib/config";
import { money } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";
import { lookupCardAction } from "../actions";

export default async function BuyCardPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const d = t(locale);
  return (
    <>
      <Header locale={locale} path="/card" />
      <main className="wrap stack">
        <Link href={`/${locale}`} className="small muted">← {d.back}</Link>
        <div>
          <p className="eyebrow">{money(config.cardCents, locale)}</p>
          <h1>{d.buyCardTitle(config.cardCredits)}</h1>
          <p className="lead">{d.card10Desc(config.cardCredits, config.cardValidityDays)}</p>
        </div>
        <div className="panel">
          <BuyCardForm locale={locale} price={money(config.cardCents, locale)} />
        </div>

        <div className="panel" id="lookup">
          <h2>{d.haveCard}</h2>
          <form action={lookupCardAction} className="stack">
            <input type="hidden" name="locale" value={locale} />
            <div className="field">
              <label htmlFor="cardCode">{d.cardCode}</label>
              <input id="cardCode" name="cardCode" type="text" className="mono" autoCapitalize="characters" placeholder="C-XXXX-XXXX-XX" required />
              <span className="hint">{d.cardCodeHint}</span>
            </div>
            <button className="btn btn-outline">{d.checkBalance}</button>
          </form>
        </div>
      </main>
    </>
  );
}
