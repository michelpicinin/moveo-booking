"use client";
import { useActionState } from "react";
import { buyCardAction, type FormState } from "@/app/[locale]/actions";
import { t, type Locale } from "@/lib/i18n";

export function BuyCardForm({ locale, price }: { locale: Locale; price: string }) {
  const d = t(locale);
  const [state, action, pending] = useActionState<FormState, FormData>(buyCardAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div className="field">
        <label htmlFor="name">{d.yourName}</label>
        <input id="name" name="name" type="text" autoComplete="name" required aria-invalid={fe.name || undefined} />
      </div>
      <div className="field">
        <label htmlFor="email">{d.yourEmail}</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required aria-invalid={fe.email || undefined} />
      </div>
      {state.error && <div className="alert alert-error" role="alert">{state.error}</div>}
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "…" : d.continuePay(price)}</button>
      <p className="small muted center">{d.payMethods}</p>
    </form>
  );
}
