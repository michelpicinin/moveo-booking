// Integration tests against a real Postgres. Set DATABASE_URL to a throwaway database.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("booking flows", async () => {
  const b = await import("@/lib/booking");
  const { sql } = await import("@/lib/db");
  const noRefund = async () => {};
  let refunds: string[] = [];
  const recordRefund = async (ref: string) => { refunds.push(ref); };

  async function newClass(opts: { capacity?: number; inHours?: number } = {}) {
    const startsAt = new Date(Date.now() + (opts.inHours ?? 48) * 3_600_000);
    const [row] = await sql<{ id: string }[]>`insert into classes (title, instructor, starts_at, capacity)
      values ('Test Flow', 'Anna', ${startsAt}, ${opts.capacity ?? 2}) returning id`;
    return row.id;
  }
  async function activeCard(email: string, used = 0) {
    const p = await b.createPendingCard({ name: "Card Holder", email });
    await b.attachCheckoutRef(`ref_${p.cardId}`, { cardId: p.cardId });
    await b.fulfillCheckout(`ref_${p.cardId}`, "pi_card");
    if (used) await sql`update cards set credits_used = ${used} where id = ${p.cardId}`;
    return p.cardCode;
  }

  beforeAll(async () => {
    const admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin.unsafe("drop table if exists processed_events, bookings, cards, customers, classes cascade");
    await admin.unsafe(readFileSync("db/schema.sql", "utf8"));
    await admin.end();
  });
  beforeEach(() => { refunds = []; });
  afterAll(async () => { await sql.end(); });

  it("drop-in: holds a spot, confirms on payment, idempotently", async () => {
    const classId = await newClass({ capacity: 1 });
    const p = await b.createPendingDropin({ classId, name: "Ana", email: "ana@example.com" });
    await b.attachCheckoutRef("cs_1", { bookingId: p.bookingId });
    // The held spot blocks others while Ana pays.
    await expect(b.createPendingDropin({ classId, name: "Ben", email: "ben@example.com" })).rejects.toMatchObject({ code: "class_full" });
    const r1 = await b.fulfillCheckout("cs_1", "pi_1");
    const r2 = await b.fulfillCheckout("cs_1", "pi_1");
    expect(r1.bookingCodes).toEqual([p.bookingCode]);
    expect(r2.bookingCodes).toEqual([]); // no second email
    const view = await b.getBookingByCode(p.bookingCode);
    expect(view?.status).toBe("confirmed");
  });

  it("abandoned checkout frees the spot", async () => {
    const classId = await newClass({ capacity: 1 });
    const p = await b.createPendingDropin({ classId, name: "Ana", email: "ana2@example.com" });
    await b.attachCheckoutRef("cs_2", { bookingId: p.bookingId });
    await b.expireCheckout("cs_2");
    await expect(b.createPendingDropin({ classId, name: "Ben", email: "ben2@example.com" })).resolves.toBeTruthy();
  });

  it("retrying a checkout replaces the earlier one instead of blocking", async () => {
    const classId = await newClass({ capacity: 3 });
    const p1 = await b.createPendingDropin({ classId, name: "Cy", email: "cy@example.com" });
    await b.attachCheckoutRef("cs_3a", { bookingId: p1.bookingId });
    const p2 = await b.createPendingDropin({ classId, name: "Cy", email: "CY@example.com" });
    expect(p2.supersededRefs).toEqual(["cs_3a"]);
  });

  it("buying a card with a class uses the first credit", async () => {
    const classId = await newClass();
    const p = await b.createPendingCard({ name: "Dee", email: "dee@example.com", classId });
    await b.attachCheckoutRef("cs_4", { cardId: p.cardId, bookingId: p.booking!.bookingId });
    const r = await b.fulfillCheckout("cs_4", "pi_4");
    expect(r.cardCodes).toEqual([p.cardCode]);
    const card = await b.getCardByCode(p.cardCode);
    expect(card).toMatchObject({ status: "active", creditsUsed: 1, creditsTotal: 10 });
    expect(card!.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 170 * 86400_000);
  });

  it("books with an existing card, checking email and balance", async () => {
    const classId = await newClass({ capacity: 5 });
    const code = await activeCard("eve@example.com", 9);
    await expect(b.bookWithCard({ classId, email: "mallory@example.com", cardCode: code })).rejects.toMatchObject({ code: "card_wrong_email" });
    const { bookingCode } = await b.bookWithCard({ classId, email: "Eve@Example.com", cardCode: code.replace(/-/g, "").toLowerCase() });
    expect((await b.getCardByCode(code))?.creditsUsed).toBe(10);
    await expect(b.bookWithCard({ classId: await newClass(), email: "eve@example.com", cardCode: code })).rejects.toMatchObject({ code: "card_empty" });
    // Already booked
    await expect(b.bookWithCard({ classId, email: "eve@example.com", cardCode: code })).rejects.toMatchObject({ code: "already_booked" });
    // Cancel in time returns the credit
    const out = await b.cancelBooking(bookingCode, noRefund);
    expect(out.refund).toBe("credit");
    expect((await b.getCardByCode(code))?.creditsUsed).toBe(9);
  });

  it("late cancellation keeps the credit; early drop-in cancel refunds money", async () => {
    const soon = await newClass({ capacity: 5, inHours: 2 });
    const code = await activeCard("fay@example.com");
    const { bookingCode } = await b.bookWithCard({ classId: soon, email: "fay@example.com", cardCode: code });
    expect((await b.cancelBooking(bookingCode, noRefund)).refund).toBe("none");
    expect((await b.getCardByCode(code))?.creditsUsed).toBe(1);

    const later = await newClass({ capacity: 5 });
    const p = await b.createPendingDropin({ classId: later, name: "Fay", email: "fay@example.com" });
    await b.attachCheckoutRef("cs_6", { bookingId: p.bookingId });
    await b.fulfillCheckout("cs_6", "pi_6");
    expect((await b.cancelBooking(p.bookingCode, recordRefund)).refund).toBe("money");
    expect(refunds).toEqual(["pi_6"]);
    await expect(b.cancelBooking(p.bookingCode, recordRefund)).rejects.toMatchObject({ code: "already_cancelled" });
  });

  it("instructor check-in, walk-ins and cancelling a class", async () => {
    const classId = await newClass({ capacity: 1 });
    const code = await activeCard("gil@example.com");
    const { bookingCode } = await b.bookWithCard({ classId, email: "gil@example.com", cardCode: code });
    // Walk-ins may exceed capacity (instructor's call)
    await b.addWalkIn({ classId, name: "Hal" });
    const list = await b.roster(classId);
    expect(list.map((x) => x.customerName).sort()).toEqual(["Card Holder", "Hal"]);
    expect(list.find((x) => x.customerName === "Hal")?.checkedInAt).toBeTruthy();
    const gil = list.find((x) => x.code === bookingCode)!;
    await b.setCheckIn(gil.id, true);
    expect((await b.getBookingByCode(bookingCode))?.checkedInAt).toBeTruthy();
    await b.setCheckIn(gil.id, false);
    expect((await b.getBookingByCode(bookingCode))?.checkedInAt).toBeNull();

    const outcomes = await b.cancelClass(classId, noRefund);
    expect(outcomes.map((o) => o.refund).sort()).toEqual(["credit", "none"]);
    expect((await b.getCardByCode(code))?.creditsUsed).toBe(0);
    await expect(b.createPendingDropin({ classId, name: "X", email: "x@example.com" })).rejects.toMatchObject({ code: "class_cancelled" });
  });

  it("never overbooks under concurrent requests", async () => {
    const classId = await newClass({ capacity: 3 });
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => b.createPendingDropin({ classId, name: `P${i}`, email: `p${i}@example.com` })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  });
});
