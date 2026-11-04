import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CancelForm } from "@/components/CancelForm";
import { Header } from "@/components/Header";
import { Qr } from "@/components/Qr";
import { WalletButton } from "@/components/WalletButton";
import { getBookingByCode } from "@/lib/booking";
import { syncCheckout } from "@/lib/checkout";
import { config, walletEnabled } from "@/lib/config";
import { dayLong, money, time } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";
import { freeCancellation } from "@/lib/policy";
import { scanUrl } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; code: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { locale, code } = await params;
  const { cancelled } = await searchParams;
  const d = t(locale);
  let b = await getBookingByCode(code);
  if (!b) notFound();
  if (b.status === "pending" && b.checkoutRef) {
    await syncCheckout(b.checkoutRef).catch(console.error);
    b = (await getBookingByCode(code))!;
  }

  const inTime = freeCancellation(b.startsAt, config.cancelHours);
  const upcoming = b.startsAt.getTime() > Date.now();
  const what = b.kind === "card" ? d.theSession : d.yourMoney;
  const paidWith = b.kind === "card" ? `${d.card10(config.cardCredits)} (${b.cardCode})` : b.kind === "trial" ? d.payTrial : b.kind === "dropin" ? `${d.dropIn} · ${money(b.amountCents, locale)}` : d.dropIn;

  return (
    <>
      <Header locale={locale} path={`/b/${b.code}`} />
      <main className="wrap stack">
        {b.status === "pending" && <AutoRefresh />}
        {cancelled && (
          <div className="alert alert-ok" role="status">
            {cancelled === "credit" ? d.cancelledCredit : cancelled === "money" ? d.cancelledMoney : d.cancelledNone}
          </div>
        )}

        <div className="panel ticket">
          {b.status === "confirmed" && (
            <>
              <div className="check-big" aria-hidden="true">✓</div>
              <h1>{d.bookingConfirmed}</h1>
            </>
          )}
          {b.status === "pending" && (
            <>
              <h1>{d.bookingPending}</h1>
              <p className="muted">{d.bookingPendingHint}</p>
            </>
          )}
          {b.status === "cancelled" && <h1>{b.classCancelled ? d.classCancelledNotice : d.bookingCancelled}</h1>}
          {b.status === "expired" && <h1>{d.bookingExpired}</h1>}

          {b.status === "confirmed" && (
            <>
              <Qr value={scanUrl(b.code)} label={`${d.reference} ${b.code}`} />
              <div className="code mono">{b.code}</div>
              <p className="small muted">{d.showAtDesk}</p>
              {b.checkedInAt && <span className="badge badge-ok">{d.checkedIn}</span>}
            </>
          )}

          <dl className="ticket-details">
            <dt>{b.title}</dt>
            <dd>{dayLong(b.startsAt, locale)}, {time(b.startsAt, locale)}</dd>
            <dt>{d.with}</dt>
            <dd>{b.instructor} · {d.minutes(b.durationMin)}</dd>
            <dt>{d.yourName}</dt>
            <dd>{b.customerName}</dd>
            <dt>{d.paidWith}</dt>
            <dd>{paidWith}</dd>
          </dl>
        </div>

        {b.status === "confirmed" && upcoming && (
          <div className="stack">
            <div className="row" style={{ justifyContent: "center" }}>
              {walletEnabled && <WalletButton href={`/api/wallet/booking/${b.code}`} label={d.addToWallet} />}
              <a className="btn btn-outline" href={`/api/ics/${b.code}`}>{d.addToCalendar}</a>
            </div>
            <div className="panel stack">
              <p className="small muted" style={{ margin: 0 }}>
                {inTime ? `${d.policy(config.cancelHours)} ${d.cancelFree(what)}` : d.cancelLate(config.cancelHours)}
              </p>
              <CancelForm locale={locale} code={b.code} label={d.cancelBooking}
                confirm={`${d.cancelConfirm} ${inTime ? d.cancelFree(what) : d.cancelLate(config.cancelHours)}`} />
            </div>
          </div>
        )}
        {b.kind === "card" && b.cardCode && (
          <Link className="small" href={`/${locale}/c/${b.cardCode}`}>{d.yourCard} →</Link>
        )}
        <Link className="btn btn-outline" href={`/${locale}`}>{d.bookAnother}</Link>
      </main>
    </>
  );
}
