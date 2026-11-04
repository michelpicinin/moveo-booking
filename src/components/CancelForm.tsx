"use client";
import { cancelBookingAction } from "@/app/[locale]/actions";

export function CancelForm(props: { locale: string; code: string; label: string; confirm: string }) {
  return (
    <form
      action={cancelBookingAction}
      onSubmit={(e) => {
        if (!window.confirm(props.confirm)) e.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="code" value={props.code} />
      <button className="btn btn-danger btn-block" type="submit">{props.label}</button>
    </form>
  );
}
