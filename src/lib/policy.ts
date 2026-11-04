// Pure rules, kept free of I/O so they are easy to test.

export type Occupancy = { capacity: number; confirmed: number; heldPending: number };

export const spotsLeft = (o: Occupancy) => Math.max(0, o.capacity - o.confirmed - o.heldPending);

export function bookingOpen(startsAt: Date, cutoffMinutes: number, now = new Date()): boolean {
  return now.getTime() < startsAt.getTime() + cutoffMinutes * 60_000;
}

/** True when cancelling now still returns the credit or the money. */
export function freeCancellation(startsAt: Date, cancelHours: number, now = new Date()): boolean {
  return startsAt.getTime() - now.getTime() >= cancelHours * 3_600_000;
}

export type CardState = {
  status: string;
  creditsTotal: number;
  creditsUsed: number;
  expiresAt: Date | null;
};

export type CardProblem = "not_active" | "expired" | "empty" | null;

/** Can this card pay for a class that starts at `classStart`? */
export function cardProblem(card: CardState, classStart: Date, now = new Date()): CardProblem {
  if (card.status !== "active") return "not_active";
  if (card.expiresAt && (card.expiresAt < now || card.expiresAt < classStart)) return "expired";
  if (card.creditsUsed >= card.creditsTotal) return "empty";
  return null;
}

export const creditsLeft = (c: Pick<CardState, "creditsTotal" | "creditsUsed">) =>
  c.creditsTotal - c.creditsUsed;
