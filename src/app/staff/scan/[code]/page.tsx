import Link from "next/link";
import { StaffHeader } from "@/components/StaffHeader";
import { getBookingByCode, getCardByCode, listClasses } from "@/lib/booking";
import { dateShort, dayKey, dayLong, time, zonedToUtc } from "@/lib/format";
import { cardProblem, creditsLeft } from "@/lib/policy";
import { requireStaff } from "@/lib/staff-auth";
import { cardCheckInAction, toggleCheckInAction } from "../../actions";

export const dynamic = "force-dynamic";

/** Opened by scanning a client's QR code (booking or 10-session card) with the phone camera. */
export default async function Scan({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const code = decodeURIComponent((await params).code).toUpperCase();
  const { error } = await searchParams;
  const self = `/staff/scan/${encodeURIComponent(code)}`;
  await requireStaff(self);

  if (code.startsWith("C")) {
    const card = await getCardByCode(code);
    const start = zonedToUtc(dayKey(new Date()), "00:00");
    const today = card ? await listClasses({ from: start, to: new Date(start.getTime() + 86400_000) }) : [];
    const problem = card ? cardProblem(card, new Date()) : null;
    return (
      <>
        <StaffHeader />
        <main className="wrap stack">
          {!card ? (
            <div className="alert alert-error">Card {code} not found.</div>
          ) : (
            <>
              <div className="panel center">
                <p className="eyebrow">10-session card</p>
                <h1>{card.customerName}</h1>
                <p className="mono">{card.code}</p>
                <p><b>{creditsLeft(card)}</b> of {card.creditsTotal} sessions left
                  {card.expiresAt && <> · valid until {dateShort(card.expiresAt, "en")}</>}</p>
                {problem && <div className="alert alert-error">Card can't be used: {problem.replace("_", " ")}.</div>}
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              {!problem && (
                <div className="stack">
                  <h2>Check in to a class today (uses 1 session)</h2>
                  {today.length === 0 && <p className="muted">No classes today.</p>}
                  {today.map((c) => (
                    <form key={c.id} action={cardCheckInAction}>
                      <input type="hidden" name="classId" value={c.id} />
                      <input type="hidden" name="cardCode" value={card.code} />
                      <button className="btn btn-sage btn-block">{time(c.startsAt, "en")} · {c.title}</button>
                    </form>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </>
    );
  }

  const b = await getBookingByCode(code);
  const isToday = b ? dayKey(b.startsAt) === dayKey(new Date()) : false;
  return (
    <>
      <StaffHeader />
      <main className="wrap stack">
        {!b ? (
          <div className="alert alert-error">Booking {code} not found.</div>
        ) : (
          <>
            <div className="panel center">
              {b.checkedInAt ? <div className="check-big">✓</div> : null}
              <h1>{b.customerName}</h1>
              <p>
                <b>{b.title}</b><br />
                {dayLong(b.startsAt, "en")}, {time(b.startsAt, "en")} · {b.instructor}
              </p>
              <p className="small muted">
                {b.kind === "card" ? "Paid with 10-card" : b.kind === "dropin" ? "Drop-in, paid online" : "Walk-in"} · {b.code}
              </p>
              {b.status !== "confirmed" && <div className="alert alert-error">This booking is {b.status}. Not valid.</div>}
              {b.status === "confirmed" && !isToday && <div className="alert alert-warn">Careful: this booking is not for today.</div>}
              {b.checkedInAt && <div className="alert alert-ok">Checked in at {time(b.checkedInAt, "en")}.</div>}
            </div>
            {b.status === "confirmed" && (
              <form action={toggleCheckInAction}>
                <input type="hidden" name="bookingId" value={b.id} />
                <input type="hidden" name="classId" value={b.classId} />
                <input type="hidden" name="present" value={b.checkedInAt ? "0" : "1"} />
                <input type="hidden" name="back" value={self} />
                <button className={`btn btn-block ${b.checkedInAt ? "btn-outline" : "btn-sage"}`} style={{ minHeight: 60, fontSize: 18 }}>
                  {b.checkedInAt ? "Undo check-in" : "Check in"}
                </button>
              </form>
            )}
            <Link className="btn btn-outline" href={`/staff/class/${b.classId}`}>Open class list</Link>
          </>
        )}
      </main>
    </>
  );
}
