import Link from "next/link";
import { StaffHeader } from "@/components/StaffHeader";
import { listClasses, type ClassRow } from "@/lib/booking";
import { dayKey, dayLong, time, zonedToUtc } from "@/lib/format";
import { requireStaff } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export default async function StaffHome() {
  await requireStaff("/staff");
  const startOfToday = zonedToUtc(dayKey(new Date()), "00:00");
  const classes = await listClasses({ from: startOfToday, to: new Date(startOfToday.getTime() + 8 * 86400_000) });
  const days = new Map<string, ClassRow[]>();
  for (const c of classes) days.set(dayKey(c.startsAt), [...(days.get(dayKey(c.startsAt)) ?? []), c]);
  const today = dayKey(new Date());

  return (
    <>
      <StaffHeader current="today" />
      <main className="wrap">
        <h1>Classes</h1>
        <p className="muted small">Tap a class to open the attendance list. Scan a client&apos;s QR code with the phone camera to check them in.</p>
        {classes.length === 0 && <p className="muted">No classes this week. Add some under Schedule.</p>}
        {[...days.entries()].map(([key, list]) => (
          <div className="day" key={key}>
            <div className="day-head">
              <h2>{key === today ? "Today" : dayLong(list[0].startsAt, "en")}</h2>
            </div>
            {list.map((c) => (
              <Link key={c.id} className="class-row" href={`/staff/class/${c.id}`}>
                <div className="when">{time(c.startsAt, "en")}<small>{c.durationMin} min</small></div>
                <div>
                  <div className="title">{c.title}</div>
                  <div className="meta">{c.instructor}</div>
                </div>
                <div className="side">
                  <span className="badge">{c.confirmed}/{c.capacity} booked</span>
                  {c.checkedIn > 0 && <span className="badge badge-ok">{c.checkedIn} here</span>}
                </div>
              </Link>
            ))}
          </div>
        ))}
      </main>
    </>
  );
}
