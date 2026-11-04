"use client";
import { useActionState } from "react";
import { loginAction, type StaffState } from "@/app/staff/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(loginAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="password">Studio password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
      </div>
      {state.error && <div className="alert alert-error" role="alert">{state.error}</div>}
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "…" : "Log in"}</button>
    </form>
  );
}
