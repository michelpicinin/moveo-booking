import { randomInt } from "node:crypto";

// Crockford-style alphabet: no 0/O, 1/I/L, U, so codes are easy to read aloud.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

function random(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** Booking reference, e.g. B7K3PQ9XAM. Unguessable: it is the key to the booking page. */
export const bookingCode = () => "B" + random(9);

/** 10-session card code, e.g. C-7K3P-9QXA-M2. Shown on the Wallet pass and in the email. */
export const cardCode = () => {
  const r = random(10);
  return `C-${r.slice(0, 4)}-${r.slice(4, 8)}-${r.slice(8)}`;
};

export function normalizeCardCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^C/, "");
  if (raw.length !== 10) return input.trim().toUpperCase();
  return `C-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}
