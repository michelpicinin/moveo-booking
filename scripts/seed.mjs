// Seeds a sample weekly yoga schedule for the next 4 weeks (local dev / demo only).
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const TZ_OFFSET = "+01:00"; // Luxembourg winter time; good enough for demo data

const weekly = [
  // weekday (1=Mon), time, title, instructor, minutes, capacity
  [1, "18:30", "Vinyasa Flow", "Anna", 60, 12],
  [3, "07:15", "Morning Hatha", "Louis", 60, 10],
  [3, "19:00", "Yin Yoga", "Anna", 75, 12],
  [5, "12:15", "Lunch Flow", "Florian", 45, 8],
  [6, "09:30", "Saturday Slow Flow", "Anna", 75, 14],
];

const today = new Date();
today.setHours(0, 0, 0, 0);
let n = 0;
for (let d = 0; d < 28; d++) {
  const day = new Date(today.getTime() + d * 86400000);
  const wd = day.getDay() === 0 ? 7 : day.getDay();
  for (const [w, time, title, instructor, mins, cap] of weekly) {
    if (w !== wd) continue;
    const ymd = day.toISOString().slice(0, 10);
    const startsAt = new Date(`${ymd}T${time}:00${TZ_OFFSET}`);
    await sql`insert into classes (title, instructor, starts_at, duration_min, capacity)
              values (${title}, ${instructor}, ${startsAt}, ${mins}, ${cap})`;
    n++;
  }
}
console.log(`Seeded ${n} classes`);
await sql.end();
