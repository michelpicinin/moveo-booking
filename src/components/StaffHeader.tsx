import Link from "next/link";
import { logoutAction } from "@/app/staff/actions";

export function StaffHeader({ current }: { current?: "today" | "schedule" }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="logo" href="/staff">
          <span className="dot" />
          MOVEO <small>Studio</small>
        </Link>
        <nav className="staff-nav">
          <Link href="/staff" aria-current={current === "today" ? "page" : undefined}>Classes</Link>
          <Link href="/staff/schedule" aria-current={current === "schedule" ? "page" : undefined}>Schedule</Link>
          <form action={logoutAction}>
            <button className="linkbtn small" style={{ padding: "8px 4px" }}>Log out</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
