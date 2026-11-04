import { readFileSync } from "node:fs";
import path from "node:path";
import { PKPass } from "passkit-generator";
import { config } from "./config";
import type { BookingView, CardView } from "./booking";
import { creditsLeft } from "./policy";
import { dateShort, dayLong, time } from "./format";

// Env values may be raw PEM or base64-encoded PEM (easier to paste into hosting dashboards).
function pem(name: string): string {
  const v = process.env[name]!;
  return v.includes("-----BEGIN") ? v.replace(/\\n/g, "\n") : Buffer.from(v, "base64").toString("utf8");
}

function images(): Record<string, Buffer> {
  const dir = path.join(process.cwd(), "public", "pass");
  const out: Record<string, Buffer> = {};
  for (const f of ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png", "logo@3x.png"])
    out[f] = readFileSync(path.join(dir, f));
  return out;
}

// MOVEO brand: sage background, white text.
const COLORS = {
  backgroundColor: "rgb(138, 154, 130)",
  foregroundColor: "rgb(255, 255, 255)",
  labelColor: "rgb(43, 43, 40)",
};

function base(serialNumber: string, description: string, type: "eventTicket" | "storeCard") {
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.PASS_TYPE_ID,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    organizationName: config.studioName,
    serialNumber,
    description,
    logoText: "MOVEO",
    sharingProhibited: true,
    ...COLORS,
    [type]: {},
  };
  return new PKPass(
    { ...images(), "pass.json": Buffer.from(JSON.stringify(passJson)) },
    {
      wwdr: pem("PASS_WWDR_CERT"),
      signerCert: pem("PASS_SIGNER_CERT"),
      signerKey: pem("PASS_SIGNER_KEY"),
      signerKeyPassphrase: process.env.PASS_SIGNER_KEY_PASSPHRASE || undefined,
    },
  );
}

/** Scanning the QR with a phone camera opens the instructor check-in page. */
export const scanUrl = (code: string) => `${config.appUrl}/staff/scan/${encodeURIComponent(code)}`;

export function bookingPass(b: BookingView): Buffer {
  const pass = base(b.code, `${b.title} – ${config.studioName}`, "eventTicket");
  const end = new Date(b.startsAt.getTime() + b.durationMin * 60_000);
  pass.headerFields.push({ key: "time", label: dateShort(b.startsAt, "en"), value: time(b.startsAt, "en") });
  pass.primaryFields.push({ key: "class", label: "Class", value: b.title });
  pass.secondaryFields.push(
    { key: "date", label: "Date", value: dayLong(b.startsAt, "en") },
    { key: "teacher", label: "Teacher", value: b.instructor },
  );
  pass.auxiliaryFields.push(
    { key: "name", label: "Name", value: b.customerName },
    { key: "ref", label: "Ref", value: b.code },
  );
  pass.backFields.push(
    { key: "where", label: "Where", value: `${b.location}\n${config.studioAddress}` },
    { key: "manage", label: "Manage booking", value: `${config.appUrl}/en/b/${b.code}` },
    { key: "policy", label: "Cancellation", value: `Free cancellation up to ${config.cancelHours} hours before class.` },
  );
  pass.setBarcodes({ message: scanUrl(b.code), format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: b.code });
  pass.setRelevantDate(b.startsAt);
  pass.setExpirationDate(new Date(end.getTime() + 6 * 3_600_000));
  return pass.getAsBuffer();
}

export function cardPass(c: CardView): Buffer {
  const pass = base(c.code, `${config.cardCredits}-session yoga card – ${config.studioName}`, "storeCard");
  const left = creditsLeft(c);
  pass.headerFields.push({ key: "left", label: "Sessions", value: `${left}/${c.creditsTotal}` });
  pass.primaryFields.push({ key: "card", label: "Yoga card", value: `${c.creditsTotal} sessions` });
  pass.secondaryFields.push({ key: "name", label: "Name", value: c.customerName });
  if (c.expiresAt) pass.auxiliaryFields.push({ key: "valid", label: "Valid until", value: dateShort(c.expiresAt, "en") });
  pass.backFields.push(
    { key: "code", label: "Card code (use it to book online)", value: c.code },
    { key: "balance", label: "Check balance", value: `${config.appUrl}/en/c/${c.code}` },
    { key: "book", label: "Book a class", value: `${config.appUrl}/en` },
  );
  pass.setBarcodes({ message: scanUrl(c.code), format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: c.code });
  if (c.expiresAt) pass.setExpirationDate(c.expiresAt);
  return pass.getAsBuffer();
}
