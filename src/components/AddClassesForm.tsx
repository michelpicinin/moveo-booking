"use client";
import { useActionState } from "react";
import { addClassesAction, type StaffState } from "@/app/staff/actions";

export function AddClassesForm() {
  const [state, action, pending] = useActionState<StaffState, FormData>(addClassesAction, {});
  return (
    <form action={action} className="stack">
      <div className="grid2">
        <div className="field"><label htmlFor="title">Class</label><input id="title" name="title" type="text" placeholder="Vinyasa Flow" required /></div>
        <div className="field"><label htmlFor="instructor">Teacher</label><input id="instructor" name="instructor" type="text" required /></div>
        <div className="field"><label htmlFor="date">First date</label><input id="date" name="date" type="date" required /></div>
        <div className="field"><label htmlFor="time">Start time</label><input id="time" name="time" type="time" required /></div>
        <div className="field"><label htmlFor="duration">Duration (min)</label><input id="duration" name="duration" type="number" min={15} step={5} defaultValue={60} required /></div>
        <div className="field"><label htmlFor="capacity">Spots</label><input id="capacity" name="capacity" type="number" min={1} defaultValue={6} required /></div>
      </div>
      <div className="field">
        <label htmlFor="weeks">Repeat weekly for</label>
        <select id="weeks" name="weeks" defaultValue="12">
          <option value="1">Just once</option>
          <option value="4">4 weeks</option>
          <option value="8">8 weeks</option>
          <option value="12">12 weeks</option>
          <option value="26">26 weeks</option>
        </select>
      </div>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}
      <button className="btn btn-primary" disabled={pending}>Add to schedule</button>
    </form>
  );
}
