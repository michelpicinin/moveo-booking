"use client";

import { useActionState, useEffect, useState } from "react";
import { bookClassAction, type FormState } from "@/app/[locale]/actions";
import { t, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  classId: string;
  prices: { dropIn: string; card: string; credits: number };
};

const STORE = "moveo.booker";

export function BookForm({ locale, classId, prices }: Props) {
  const d = t(locale);
  const [state, action, pending] = useActionState<FormState, FormData>(bookClassAction, {});
  const [method, setMethod] = useState<"dropin" | "newcard" | "mycard">("dropin");
  const [saved, setSaved] = useState<{ name?: string; email?: string; cardCode?: string }>({});

  // Remember name, email and card code on this device to make the next booking one tap.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? "{}");
      setSaved(s);
      if (s.cardCode) setMethod("mycard");
    } catch {}
  }, []);

  function remember(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    try {
      const next = { ...saved, name: String(fd.get("name") ?? "") || saved.name, email: String(fd.get("email") ?? "") };
      if (fd.get("method") === "mycard") Object.assign(next, { cardCode: String(fd.get("cardCode") ?? "") });
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {}
  }

  const fe = state.fieldErrors ?? {};
  const submitLabel =
    method === "mycard" ? d.confirmWithCard : d.continuePay(method === "dropin" ? prices.dropIn : prices.card);

  return (
    <form action={action} onSubmit={remember} className="stack" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="classId" value={classId} />

      <fieldset className="choices" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="eyebrow" style={{ marginBottom: 10 }}>{d.howToPay}</legend>
        <label className="choice">
          <input type="radio" name="method" value="dropin" checked={method === "dropin"} onChange={() => setMethod("dropin")} />
          <span className="name">{d.payDropIn}</span>
          <span className="price-tag">{prices.dropIn}</span>
        </label>
        <label className="choice">
          <input type="radio" name="method" value="newcard" checked={method === "newcard"} onChange={() => setMethod("newcard")} />
          <span className="name">
            {d.payNewCard(prices.credits)}
            <span className="sub">{d.payNewCardHint}</span>
          </span>
          <span className="price-tag">{prices.card}</span>
        </label>
        <label className="choice">
          <input type="radio" name="method" value="mycard" checked={method === "mycard"} onChange={() => setMethod("mycard")} />
          <span className="name">
            {d.payMyCard}
            <span className="sub">{d.payMyCardHint}</span>
          </span>
          <span />
        </label>
      </fieldset>

      {method !== "mycard" && (
        <div className="field">
          <label htmlFor="name">{d.yourName}</label>
          <input id="name" name="name" type="text" autoComplete="name" required defaultValue={saved.name} key={`n${saved.name}`} aria-invalid={fe.name || undefined} />
        </div>
      )}
      <div className="field">
        <label htmlFor="email">{d.yourEmail}</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={saved.email} key={`e${saved.email}`} aria-invalid={fe.email || undefined} />
      </div>
      {method === "mycard" && (
        <div className="field">
          <label htmlFor="cardCode">{d.cardCode}</label>
          <input id="cardCode" name="cardCode" type="text" autoCapitalize="characters" autoComplete="off" spellCheck={false}
            className="mono" placeholder="C-XXXX-XXXX-XX" defaultValue={saved.cardCode} key={`c${saved.cardCode}`} aria-invalid={fe.cardCode || undefined} />
          <span className="hint">{d.cardCodeHint}</span>
        </div>
      )}

      {state.error && <div className="alert alert-error" role="alert">{state.error}</div>}

      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
        {pending ? "…" : submitLabel}
      </button>
      {method !== "mycard" && <p className="small muted center">{d.payMethods}</p>}
    </form>
  );
}
