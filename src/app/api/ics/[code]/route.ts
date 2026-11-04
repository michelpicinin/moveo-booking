import { getBookingByCode } from "@/lib/booking";
import { config } from "@/lib/config";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const b = await getBookingByCode(code);
  if (!b || b.status !== "confirmed") return new Response("Not found", { status: 404 });
  const end = new Date(b.startsAt.getTime() + b.durationMin * 60_000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MOVEO//Yoga booking//EN",
    "BEGIN:VEVENT",
    `UID:${b.code}@moveo.lu`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(b.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${b.title} – MOVEO Yoga`)}`,
    `LOCATION:${esc(`${b.location}, ${config.studioAddress}`)}`,
    `DESCRIPTION:${esc(`With ${b.instructor}. Booking ${b.code}: ${config.appUrl}/en/b/${b.code}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="moveo-${b.code}.ics"` },
  });
}
