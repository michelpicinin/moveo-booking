import { LoginForm } from "@/components/LoginForm";

export default async function StaffLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/staff" } = await searchParams;
  return (
    <main className="wrap stack" style={{ maxWidth: 420, paddingTop: 64 }}>
      <div className="logo"><span className="dot" />MOVEO <small>Studio</small></div>
      <h1>Instructor check-in</h1>
      <div className="panel">
        <LoginForm next={next.startsWith("/staff") ? next : "/staff"} />
      </div>
    </main>
  );
}
