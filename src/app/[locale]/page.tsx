import Link from "next/link";
import { Header } from "@/components/Header";
import { classSpotsLeft, listClasses, type ClassRow } from "@/lib/booking";
import { config } from "@/lib/config";
import { dayKey, dayLong, money, time } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";
import { bookingOpen } from "@/lib/policy";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const d = t(locale);
  const now = new Date();
  const from = new Date(now.getTime() - config.bookingCutoffMinutes * 60_000);
  const to = new Date(now.getTime() + 21 * 86400_000);
  const classes = await listClasses({ from, to });

  const days = new Map<string, ClassRow[]>();
  for (const c of classes) {
    const k = dayKey(c.startsAt);
    days.set(k, [...(days.get(k) ?? []), c]);
  }
  const todayKey = dayKey(now);
  const tomorrowKey = dayKey(new Date(now.getTime() + 86400_000));

  return (
    <>
      <Header locale={locale} />
      <main className="wrap">
        <p className="eyebrow">{d.tagline}</p>
        <h1>{d.heroTitle}</h1>
        <p className="lead">{d.heroLead}</p>

        <section aria-labelledby="schedule" className="mt">
          <h2 id="schedule" className="eyebrow" style={{ marginTop: 32 }}>{d.schedule}</h2>
          {classes.length === 0 && <p className="muted">{d.noClasses}</p>}
          {[...days.entries()].map(([key, list]) => (
            <div className="day" key={key}>
              <div className="day-head">
                <h2>{key === todayKey ? d.today : key === tomorrowKey ? d.tomorrow : dayLong(list[0].startsAt, locale)}</h2>
                {(key === todayKey || key === tomorrowKey) && (
                  <span className="muted small">{dayLong(list[0].startsAt, locale)}</span>
                )}
              </div>
              {list.map((c) => {
                const left = classSpotsLeft(c);
                const open = bookingOpen(c.startsAt, config.bookingCutoffMinutes, now);
                const off = !open || left === 0;
                return (
                  <Link key={c.id} href={`/${locale}/class/${c.id}`} className={`class-row${off ? " is-off" : ""}`}>
                    <div className="when">
                      {time(c.startsAt, locale)}
                      <small>{d.minutes(c.durationMin)}</small>
                    </div>
                    <div>
                      <div className="title">{c.title}</div>
                      <div className="meta">{d.with} {c.instructor}</div>
                    </div>
                    <div className="side">
                      {!open ? (
                        <span className="badge badge-off">{d.closed}</span>
                      ) : left === 0 ? (
                        <span className="badge badge-off">{d.full}</span>
                      ) : (
                        <>
                          <span className={`badge${left <= 3 ? " badge-warn" : ""}`}>{d.spotsLeft(left)}</span>
                          <span className="btn btn-primary btn-sm">{d.book}</span>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </section>

        <section aria-labelledby="prices" style={{ marginTop: 48 }}>
          <h2 id="prices" className="eyebrow">{d.prices}</h2>
          <div className="prices">
            <div className="panel price">
              <h3>{d.dropIn}</h3>
              <div className="amount">{money(config.dropInCents, locale)}</div>
              <p className="desc">{d.dropInDesc}</p>
            </div>
            <div className="panel price">
              <h3>{d.card10(config.cardCredits)}</h3>
              <div className="amount">{money(config.cardCents, locale)}</div>
              <p className="desc">{d.card10Desc(config.cardCredits, config.cardValidityDays)}</p>
              <div className="row">
                <Link className="btn btn-outline btn-sm" href={`/${locale}/card`}>{d.buyCard}</Link>
                <Link className="small" href={`/${locale}/card#lookup`}>{d.checkBalance}</Link>
              </div>
            </div>
          </div>
          {config.trialEnabled && <div className="alert alert-ok mt">{d.trialBanner}</div>}
          <p className="small muted mt">{d.policy(config.cancelHours)}</p>
        </section>
      </main>
    </>
  );
}
