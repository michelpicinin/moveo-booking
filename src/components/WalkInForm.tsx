"use client";
import { useActionState, useState } from "react";
import { walkInAction, type StaffState } from "@/app/staff/actions";

type Payment = "card" | "cash" | "pass";

export function WalkInForm({ classId, dropIn }: { classId: string; dropIn: string }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(walkInAction, {});
  const [payment, setPayment] = useState<Payment>("card");
  const options: { value: Payment; label: string; sub: string }[] = [
    { value: "card", label: "Credit card on site", sub: `Drop-in ${dropIn}, paid on the card terminal` },
    { value: "cash", label: "Cash", sub: `Drop-in ${dropIn}, paid in cash` },
    { value: "pass", label: "10-session card", sub: "Uses one session from their card" },
  ];
  return (
    <form action={action} className="stack" key={state.ok}>
      <input type="hidden" name="classId" value={classId} />
      <fieldset className="choices" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small" style={{ fontWeight: 500, marginBottom: 8 }}>Payment</legend>
        {options.map((o) => (
          <label key={o.value} className="choice">
            <input type="radio" name="payment" value={o.value} checked={payment === o.value} onChange={() => setPayment(o.value)} />
            <span className="name">
              {o.label}
              <span className="sub">{o.sub}</span>
            </span>
            <span />
          </label>
        ))}
      </fieldset>
      {payment === "pass" ? (
        <div className="field">
          <label htmlFor="wi-card">Card code</label>
          <input id="wi-card" name="cardCode" type="text" className="mono" autoCapitalize="characters" placeholder="C-XXXX-XXXX-XX" />
        </div>
      ) : (
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
      )}
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}
      <button className="btn btn-outline" disabled={pending}>Add & check in</button>
    </form>
  );
}
