import { config } from "./config";
import type { Locale } from "./i18n";

const tag = (l: Locale) => ({ en: "en-GB", fr: "fr-LU", de: "de-LU" })[l];

export const money = (cents: number, locale: Locale) =>
  new Intl.NumberFormat(tag(locale), { style: "currency", currency: config.currency.toUpperCase() }).format(cents / 100);

export const time = (d: Date, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { hour: "2-digit", minute: "2-digit", timeZone: config.timeZone }).format(d);

export const dayLong = (d: Date, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { weekday: "long", day: "numeric", month: "long", timeZone: config.timeZone }).format(d);

export const dateShort = (d: Date, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { day: "numeric", month: "short", year: "numeric", timeZone: config.timeZone }).format(d);

/** yyyy-mm-dd in the studio's time zone, used to group classes by day. */
export const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Converts a wall-clock date + time in the studio's zone to a UTC Date. */
export function zonedToUtc(ymd: string, hhmm: string, timeZone = config.timeZone): Date {
  const guess = new Date(`${ymd}T${hhmm}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offset = asIfUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}
