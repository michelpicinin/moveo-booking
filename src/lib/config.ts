// All studio settings come from environment variables so prices and policies
// can change without a code change. Defaults are placeholders for local dev.
function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`${name} must be an integer`);
  return n;
}

export const config = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  studioName: process.env.STUDIO_NAME ?? "MOVEO Belair",
  studioAddress: process.env.STUDIO_ADDRESS ?? "Belair, Luxembourg",
  timeZone: process.env.STUDIO_TIMEZONE ?? "Europe/Luxembourg",
  currency: (process.env.CURRENCY ?? "eur").toLowerCase(),
  dropInCents: int("PRICE_DROPIN_CENTS", 3200),
  cardCents: int("PRICE_CARD10_CENTS", 26000),
  cardCredits: int("CARD_CREDITS", 10),
  cardValidityDays: int("CARD_VALIDITY_DAYS", 90),
  /** Cancel at least this many hours before class to get the credit / money back. */
  cancelHours: int("CANCEL_HOURS", 12),
  /** How long a spot is held while the client pays. Stripe's minimum is 30 minutes. */
  holdMinutes: int("HOLD_MINUTES", 30),
  /** Booking closes this many minutes after the class started (late arrivals). */
  bookingCutoffMinutes: int("BOOKING_CUTOFF_MINUTES", 10),
};

export const stripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY);

/** Simulated payments, for local development and demos only. */
export const mockPaymentsEnabled =
  !stripeEnabled &&
  (process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "true");

export const walletEnabled = Boolean(
  process.env.PASS_TYPE_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.PASS_SIGNER_CERT &&
    process.env.PASS_SIGNER_KEY &&
    process.env.PASS_WWDR_CERT,
);
