import { describe, expect, it } from "vitest";
import { normalizeCardCode, cardCode, bookingCode } from "@/lib/codes";
import { bookingOpen, cardProblem, freeCancellation, spotsLeft } from "@/lib/policy";
import { zonedToUtc } from "@/lib/format";

const H = 3_600_000;

describe("policy", () => {
  it("counts spots including held checkouts", () => {
    expect(spotsLeft({ capacity: 10, confirmed: 7, heldPending: 2 })).toBe(1);
    expect(spotsLeft({ capacity: 10, confirmed: 10, heldPending: 2 })).toBe(0);
  });

  it("closes booking after the cutoff", () => {
    const now = new Date("2026-11-04T18:00:00Z");
    expect(bookingOpen(new Date("2026-11-04T17:55:00Z"), 10, now)).toBe(true);
    expect(bookingOpen(new Date("2026-11-04T17:45:00Z"), 10, now)).toBe(false);
  });

  it("free cancellation only before the deadline", () => {
    const now = new Date("2026-11-04T08:00:00Z");
    expect(freeCancellation(new Date(now.getTime() + 13 * H), 12, now)).toBe(true);
    expect(freeCancellation(new Date(now.getTime() + 11 * H), 12, now)).toBe(false);
  });

  it("validates cards", () => {
    const now = new Date("2026-11-04T08:00:00Z");
    const ok = { status: "active", creditsTotal: 10, creditsUsed: 3, expiresAt: new Date("2027-01-01") };
    expect(cardProblem(ok, new Date("2026-11-10"), now)).toBeNull();
    expect(cardProblem({ ...ok, creditsUsed: 10 }, new Date("2026-11-10"), now)).toBe("empty");
    expect(cardProblem({ ...ok, status: "pending" }, new Date("2026-11-10"), now)).toBe("not_active");
    expect(cardProblem(ok, new Date("2027-02-01"), now)).toBe("expired");
  });
});

describe("codes", () => {
  it("makes readable codes and normalizes card input", () => {
    expect(bookingCode()).toMatch(/^B[2-9A-Z]{9}$/);
    const c = cardCode();
    expect(c).toMatch(/^C-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{2}$/);
    expect(normalizeCardCode(c.toLowerCase().replace(/-/g, " "))).toBe(c);
  });
});

describe("time zones", () => {
  it("converts Luxembourg wall time to UTC across DST", () => {
    expect(zonedToUtc("2026-11-04", "18:30", "Europe/Luxembourg").toISOString()).toBe("2026-11-04T17:30:00.000Z");
    expect(zonedToUtc("2026-07-01", "18:30", "Europe/Luxembourg").toISOString()).toBe("2026-07-01T16:30:00.000Z");
  });
});
