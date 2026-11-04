import Link from "next/link";
import { AddClassesForm } from "@/components/AddClassesForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StaffHeader } from "@/components/StaffHeader";
import { listClasses } from "@/lib/booking";
import { dateShort, time } from "@/lib/format";
import { requireStaff } from "@/lib/staff-auth";
import { cancelClassAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function Schedule() {
  await requireStaff("/staff/schedule");
  const now = new Date();
  const classes = await listClasses({ from: now, to: new Date(now.getTime() + 60 * 86400_000), includeCancelled: true });
  return (
    <>
      <StaffHeader current="schedule" />
      <main className="wrap stack">
        <h1>Schedule</h1>
        <details className="panel" open={classes.length === 0}>
          <summary>Add classes</summary>
          <div className="mt"><AddClassesForm /></div>
        </details>
        <h2 className="eyebrow">Next 60 days</h2>
        <table className="list">
          <thead><tr><th>When</th><th>Class</th><th>Booked</th><th /></tr></thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id} style={c.cancelled ? { opacity: 0.5 } : undefined}>
                <td>{dateShort(c.startsAt, "en")}<br /><span className="small muted">{time(c.startsAt, "en")}</span></td>
                <td><Link href={`/staff/class/${c.id}`}>{c.title}</Link><br /><span className="small muted">{c.instructor}</span></td>
                <td>{c.cancelled ? <span className="badge badge-danger">Cancelled</span> : `${c.confirmed}/${c.capacity}`}</td>
                <td style={{ textAlign: "right" }}>
                  {!c.cancelled && (
                    <form action={cancelClassAction}>
                      <input type="hidden" name="classId" value={c.id} />
                      <ConfirmButton className="btn btn-outline btn-sm"
                        message={`Cancel ${c.title} on ${dateShort(c.startsAt, "en")}? ${c.confirmed} booked client(s) get their session or money back.`}>
                        Cancel
                      </ConfirmButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
