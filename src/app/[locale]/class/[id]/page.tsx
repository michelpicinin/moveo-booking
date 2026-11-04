import Link from "next/link";
import { notFound } from "next/navigation";
import { BookForm } from "@/components/BookForm";
import { Header } from "@/components/Header";
import { classSpotsLeft, getClass } from "@/lib/booking";
import { config } from "@/lib/config";
import { dayLong, money, time } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";
import { bookingOpen } from "@/lib/policy";

export const dynamic = "force-dynamic";

export default async function ClassPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const d = t(locale);
  const cls = await getClass(id);
  if (!cls) notFound();
  const left = classSpotsLeft(cls);
  const open = bookingOpen(cls.startsAt, config.bookingCutoffMinutes);
  const blocked = cls.cancelled ? d.errors.class_cancelled : !open ? d.errors.class_closed : left === 0 ? d.errors.class_full : null;

  return (
    <>
      <Header locale={locale} path={`/class/${id}`} />
      <main className="wrap stack">
        <Link href={`/${locale}`} className="small muted">← {d.back}</Link>
        <div>
          <p className="eyebrow">{dayLong(cls.startsAt, locale)} · {time(cls.startsAt, locale)}</p>
          <h1>{cls.title}</h1>
          <p className="muted">
            {d.with} {cls.instructor} · {d.minutes(cls.durationMin)} · {cls.location}
          </p>
          {!blocked && <span className={`badge${left <= 3 ? " badge-warn" : ""}`}>{d.spotsLeft(left)}</span>}
        </div>

        <div className="panel">
          {blocked ? (
            <div className="stack">
              <div className="alert alert-warn">{blocked}</div>
              <Link className="btn btn-outline" href={`/${locale}`}>{d.back}</Link>
            </div>
          ) : (
            <BookForm
              locale={locale}
              classId={cls.id}
              prices={{ dropIn: money(config.dropInCents, locale), card: money(config.cardCents, locale), credits: config.cardCredits }}
            />
          )}
        </div>
        <p className="small muted">{d.policy(config.cancelHours)}</p>
      </main>
    </>
  );
}
