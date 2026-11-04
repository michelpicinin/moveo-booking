import Link from "next/link";
import { notFound } from "next/navigation";
import { RosterSearch } from "@/components/RosterSearch";
import { StaffHeader } from "@/components/StaffHeader";
import { WalkInForm } from "@/components/WalkInForm";
import { getClass, roster } from "@/lib/booking";
import { config } from "@/lib/config";
import { dayLong, money, time } from "@/lib/format";
import { requireStaff } from "@/lib/staff-auth";
import { staffCancelBookingAction, toggleCheckInAction } from "../../actions";

export const dynamic = "force-dynamic";

const KIND = { dropin: "Drop-in (paid online)", card: "10-card", walkin: "Walk-in (pay at desk)", trial: "Free trial (new client)" } as const;

export default async function StaffClass({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const { ok } = await searchParams;
  await requireStaff(`/staff/class/${id}`);
  const cls = await getClass(id);
  if (!cls) notFound();
  const people = await roster(id);
  const here = people.filter((p) => p.checkedInAt).length;

  return (
    <>
      <StaffHeader />
      <main className="wrap stack">
        <Link href="/staff" className="small muted">← All classes</Link>
        <div>
          <p className="eyebrow">{dayLong(cls.startsAt, "en")} · {time(cls.startsAt, "en")}</p>
          <h1>{cls.title}</h1>
          <p className="muted">{cls.instructor} · {cls.durationMin} min{cls.cancelled ? " · CANCELLED" : ""}</p>
        </div>
        {ok === "card" && <div className="alert alert-ok">Checked in with card.</div>}

        <div className="stats">
          <div className="stat"><b>{people.length}</b><span>booked</span></div>
          <div className="stat"><b>{here}</b><span>checked in</span></div>
          <div className="stat"><b>{Math.max(0, cls.capacity - people.length)}</b><span>free of {cls.capacity}</span></div>
        </div>

        {people.length > 5 && <RosterSearch />}

        {people.length === 0 ? (
          <p className="muted">No bookings yet.</p>
        ) : (
          <ul className="roster">
            {people.map((p) => (
              <li key={p.id} data-name={p.customerName.toLowerCase()}>
                <div className="who">
                  <strong>{p.customerName}</strong>
                  <span>{KIND[p.kind]} · {p.code}</span>
                </div>
                <form action={toggleCheckInAction}>
                  <input type="hidden" name="bookingId" value={p.id} />
                  <input type="hidden" name="classId" value={cls.id} />
                  <input type="hidden" name="present" value={p.checkedInAt ? "0" : "1"} />
                  <button className={`checkin-btn${p.checkedInAt ? " on" : ""}`} aria-pressed={Boolean(p.checkedInAt)}>
                    {p.checkedInAt ? `✓ ${time(p.checkedInAt, "en")}` : "Check in"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <details className="panel">
          <summary>Add a walk-in</summary>
          <div className="mt"><WalkInForm classId={cls.id} dropIn={money(config.dropInCents, "en")} /></div>
        </details>

        {people.length > 0 && (
          <details className="panel">
            <summary>Remove someone from the list</summary>
            <table className="list mt">
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td>{p.customerName}<br /><span className="small muted">{KIND[p.kind]}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <form action={staffCancelBookingAction} className="row" style={{ justifyContent: "flex-end" }}>
                        <input type="hidden" name="code" value={p.code} />
                        <input type="hidden" name="classId" value={cls.id} />
                        <button className="btn btn-outline btn-sm" name="refund" value="0">Remove</button>
                        <button className="btn btn-danger btn-sm" name="refund" value="1">Remove + refund</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </main>
    </>
  );
}
