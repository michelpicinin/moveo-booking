"use client";
import { useActionState } from "react";
import { walkInAction, type StaffState } from "@/app/staff/actions";

export function WalkInForm({ classId, dropIn }: { classId: string; dropIn: string }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(walkInAction, {});
  return (
    <form action={action} className="stack" key={state.ok}>
      <input type="hidden" name="classId" value={classId} />
      <div className="grid2">
        <div className="field">
          <label htmlFor="wi-name">Name</label>
          <input id="wi-name" name="name" type="text" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="wi-email">Email (optional)</label>
          <input id="wi-email" name="email" type="email" autoComplete="off" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="wi-card">10-session card code (optional)</label>
        <input id="wi-card" name="cardCode" type="text" className="mono" autoCapitalize="characters" placeholder="C-XXXX-XXXX-XX" />
        <span className="hint">With a card code, one session is used. Without, collect the drop-in fee ({dropIn}) at the desk.</span>
      </div>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}
      <button className="btn btn-outline" disabled={pending}>Add & check in</button>
    </form>
  );
}
