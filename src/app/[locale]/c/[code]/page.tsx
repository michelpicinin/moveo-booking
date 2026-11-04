import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Header } from "@/components/Header";
import { Qr } from "@/components/Qr";
import { WalletButton } from "@/components/WalletButton";
import { cardBookings, getCardByCode } from "@/lib/booking";
import { syncCheckout } from "@/lib/checkout";
import { walletEnabled } from "@/lib/config";
import { dateShort, dayLong, time } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";
import { creditsLeft } from "@/lib/policy";
import { scanUrl } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ locale: Locale; code: string }> }) {
  const { locale, code: rawCode } = await params;
  const d = t(locale);
  let card = await getCardByCode(decodeURIComponent(rawCode));
  if (card?.status === "pending" && card.checkoutRef) {
    await syncCheckout(card.checkoutRef).catch(console.error);
    card = await getCardByCode(card.code);
  }

  if (!card || card.status === "expired_checkout" || card.status === "refunded") {
    return (
      <>
        <Header locale={locale} />
        <main className="wrap stack">
          <div className="alert alert-error">{d.errors.card_not_found}</div>
          <Link className="btn btn-outline" href={`/${locale}/card#lookup`}>{d.lookupCard}</Link>
        </main>
      </>
    );
  }

  const left = creditsLeft(card);
  const expired = card.expiresAt !== null && card.expiresAt < new Date();
  const history = card.status === "active" ? await cardBookings(card.id) : [];

  return (
    <>
      <Header locale={locale} path={`/c/${card.code}`} />
      <main className="wrap stack">
        {card.status === "pending" && <AutoRefresh />}
        <div className="panel ticket">
          <p className="eyebrow">{d.yourCard}</p>
          {card.status === "pending" ? (
            <h1>{d.cardPending}</h1>
          ) : (
            <>
              <h1>{d.sessionsLeft(left, card.creditsTotal)}</h1>
              <div className="meter" aria-hidden="true"><span style={{ width: `${(left / card.creditsTotal) * 100}%` }} /></div>
              <Qr value={scanUrl(card.code)} label={card.code} />
              <div className="code mono">{card.code}</div>
              <p className="small muted">{d.keepCode}</p>
              {expired ? (
                <div className="alert alert-warn">{d.cardExpired}</div>
              ) : (
                card.expiresAt && <p className="small">{d.validUntil(dateShort(card.expiresAt, locale))}</p>
              )}
            </>
          )}
          <p className="small muted">{card.customerName}</p>
        </div>

        {card.status === "active" && !expired && (
          <div className="row" style={{ justifyContent: "center" }}>
            {walletEnabled && <WalletButton href={`/api/wallet/card/${card.code}`} label={d.addToWallet} />}
            <Link className="btn btn-primary" href={`/${locale}`}>{d.bookAnother}</Link>
          </div>
        )}

        {history.length > 0 && (
          <section>
            <h2 className="eyebrow">{d.cardHistory}</h2>
            {history.map((b) => (
              <Link key={b.code} href={`/${locale}/b/${b.code}`} className="class-row">
                <div className="when">{time(b.startsAt, locale)}</div>
                <div>
                  <div className="title">{b.title}</div>
                  <div className="meta">{dayLong(b.startsAt, locale)}</div>
                </div>
                <div className="side">{b.checkedInAt && <span className="badge badge-ok">{d.checkedIn}</span>}</div>
              </Link>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
