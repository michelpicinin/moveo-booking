import type postgres from "postgres";
import { sql } from "./db";
import { config } from "./config";
import { bookingCode, cardCode, normalizeCardCode } from "./codes";
import { bookingOpen, cardProblem, freeCancellation, spotsLeft } from "./policy";

type Tx = postgres.TransactionSql;

export class BookingError extends Error {
  constructor(
    public code:
      | "class_not_found"
      | "class_cancelled"
      | "class_closed"
      | "class_full"
      | "already_booked"
      | "card_not_found"
      | "card_wrong_email"
      | "card_not_active"
      | "card_expired"
      | "card_empty"
      | "booking_not_found"
      | "already_cancelled"
      | "trial_used"
      | "trial_disabled",
  ) {
    super(code);
  }
}

export type ClassRow = {
  id: string;
  title: string;
  instructor: string;
  startsAt: Date;
  durationMin: number;
  capacity: number;
  location: string;
  cancelled: boolean;
  confirmed: number;
  heldPending: number;
  checkedIn: number;
};

export const classSpotsLeft = (c: ClassRow) => spotsLeft(c);

const CLASS_COLUMNS = (s: typeof sql | Tx) => s`
  c.id, c.title, c.instructor, c.starts_at as "startsAt", c.duration_min as "durationMin",
  c.capacity, c.location, c.cancelled,
  (select count(*)::int from bookings b where b.class_id = c.id and b.status = 'confirmed') as confirmed,
  (select count(*)::int from bookings b where b.class_id = c.id and b.status = 'pending'
     and b.hold_expires_at > now()) as "heldPending",
  (select count(*)::int from bookings b where b.class_id = c.id and b.status = 'confirmed'
     and b.checked_in_at is not null) as "checkedIn"
`;

export async function listClasses(opts: { from: Date; to: Date; includeCancelled?: boolean }) {
  return sql<ClassRow[]>`
    select ${CLASS_COLUMNS(sql)} from classes c
    where c.starts_at >= ${opts.from} and c.starts_at < ${opts.to}
      ${opts.includeCancelled ? sql`` : sql`and not c.cancelled`}
    order by c.starts_at`;
}

export async function getClass(id: string): Promise<ClassRow | null> {
  if (!isUuid(id)) return null;
  const [row] = await sql<ClassRow[]>`select ${CLASS_COLUMNS(sql)} from classes c where c.id = ${id}`;
  return row ?? null;
}

export const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function upsertCustomer(tx: Tx, email: string | null, name: string): Promise<string> {
  if (!email) {
    const [row] = await tx<{ id: string }[]>`insert into customers (email, name) values (null, ${name}) returning id`;
    return row.id;
  }
  const [row] = await tx<{ id: string }[]>`
    insert into customers (email, name) values (${email.trim()}, ${name.trim()})
    on conflict (lower(email)) do update set name = excluded.name
    returning id`;
  return row.id;
}

/**
 * Locks the class row and checks that one more person fits.
 * Returns refs of abandoned checkouts by the same person, which the caller should expire.
 */
async function lockClassForBooking(
  tx: Tx,
  classId: string,
  customerId: string,
  opts: { ignoreCapacity?: boolean } = {},
): Promise<{ supersededRefs: string[]; startsAt: Date }> {
  if (!isUuid(classId)) throw new BookingError("class_not_found");
  const [cls] = await tx<{ starts_at: Date; capacity: number; cancelled: boolean }[]>`
    select starts_at, capacity, cancelled from classes where id = ${classId} for update`;
  if (!cls) throw new BookingError("class_not_found");
  if (cls.cancelled) throw new BookingError("class_cancelled");
  if (!opts.ignoreCapacity && !bookingOpen(cls.starts_at, config.bookingCutoffMinutes))
    throw new BookingError("class_closed");

  // Same person already has a live booking for this class?
  const mine = await tx<{ id: string; status: string; checkout_ref: string | null }[]>`
    select id, status, checkout_ref from bookings
    where class_id = ${classId} and customer_id = ${customerId} and status in ('pending','confirmed')`;
  const supersededRefs: string[] = [];
  for (const b of mine) {
    if (b.status === "confirmed") throw new BookingError("already_booked");
    // An earlier checkout they abandoned: release it and start over.
    await tx`update bookings set status = 'expired' where id = ${b.id}`;
    if (b.checkout_ref) supersededRefs.push(b.checkout_ref);
  }

  if (!opts.ignoreCapacity) {
    const [{ taken }] = await tx<{ taken: number }[]>`
      select count(*)::int as taken from bookings
      where class_id = ${classId}
        and (status = 'confirmed' or (status = 'pending' and hold_expires_at > now()))`;
    if (taken >= cls.capacity) throw new BookingError("class_full");
  }
  return { supersededRefs, startsAt: cls.starts_at };
}

const holdUntil = () => new Date(Date.now() + config.holdMinutes * 60_000);

/** Drop-in: hold a spot while the client pays. */
export async function createPendingDropin(input: { classId: string; name: string; email: string }) {
  return sql.begin(async (tx) => {
    const customerId = await upsertCustomer(tx, input.email, input.name);
    const { supersededRefs } = await lockClassForBooking(tx, input.classId, customerId);
    const code = bookingCode();
    const [b] = await tx<{ id: string }[]>`
      insert into bookings (code, class_id, customer_id, status, kind, amount_cents, hold_expires_at)
      values (${code}, ${input.classId}, ${customerId}, 'pending', 'dropin', ${config.dropInCents}, ${holdUntil()})
      returning id`;
    return { bookingId: b.id, bookingCode: code, supersededRefs };
  });
}

/**
 * Free trial class: no payment, confirmed straight away. Only for first-time clients:
 * anyone who already has a booking (any kind, not cancelled) or a paid card isn't eligible.
 */
export async function bookTrial(input: { classId: string; name: string; email: string }) {
  if (!config.trialEnabled) throw new BookingError("trial_disabled");
  return sql.begin(async (tx) => {
    const customerId = await upsertCustomer(tx, input.email, input.name);
    // Serialize trial requests per client so two tabs can't both get a free class.
    await tx`select id from customers where id = ${customerId} for update`;
    const [{ used }] = await tx<{ used: boolean }[]>`
      select exists (select 1 from bookings where customer_id = ${customerId} and status = 'confirmed')
          or exists (select 1 from cards where customer_id = ${customerId} and status = 'active') as used`;
    if (used) throw new BookingError("trial_used");
    await lockClassForBooking(tx, input.classId, customerId);
    const code = bookingCode();
    await tx`
      insert into bookings (code, class_id, customer_id, status, kind, amount_cents)
      values (${code}, ${input.classId}, ${customerId}, 'confirmed', 'trial', 0)`;
    return { bookingCode: code };
  });
}

/** 10-session card purchase, optionally booking a class with the first credit. */
export async function createPendingCard(input: { name: string; email: string; classId?: string | null }) {
  return sql.begin(async (tx) => {
    const customerId = await upsertCustomer(tx, input.email, input.name);
    const code = cardCode();
    const [card] = await tx<{ id: string }[]>`
      insert into cards (code, customer_id, credits_total, amount_cents)
      values (${code}, ${customerId}, ${config.cardCredits}, ${config.cardCents})
      returning id`;
    let booking: { bookingId: string; bookingCode: string } | null = null;
    let supersededRefs: string[] = [];
    if (input.classId) {
      const locked = await lockClassForBooking(tx, input.classId, customerId);
      supersededRefs = locked.supersededRefs;
      const bcode = bookingCode();
      const [b] = await tx<{ id: string }[]>`
        insert into bookings (code, class_id, customer_id, status, kind, card_id, hold_expires_at)
        values (${bcode}, ${input.classId}, ${customerId}, 'pending', 'card', ${card.id}, ${holdUntil()})
        returning id`;
      booking = { bookingId: b.id, bookingCode: bcode };
    }
    return { cardId: card.id, cardCode: code, booking, supersededRefs };
  });
}

export async function attachCheckoutRef(ref: string, ids: { bookingId?: string | null; cardId?: string | null }) {
  if (ids.bookingId) await sql`update bookings set checkout_ref = ${ref} where id = ${ids.bookingId}`;
  if (ids.cardId) await sql`update cards set checkout_ref = ${ref} where id = ${ids.cardId}`;
}

async function lockCard(tx: Tx, rawCode: string) {
  const code = normalizeCardCode(rawCode);
  const [card] = await tx<
    {
      id: string;
      customer_id: string;
      email: string | null;
      status: string;
      credits_total: number;
      credits_used: number;
      expires_at: Date | null;
    }[]
  >`
    select k.id, k.customer_id, cu.email, k.status, k.credits_total, k.credits_used, k.expires_at
    from cards k join customers cu on cu.id = k.customer_id
    where k.code = ${code} for update of k`;
  if (!card) throw new BookingError("card_not_found");
  return card;
}

function assertCardUsable(
  card: Awaited<ReturnType<typeof lockCard>>,
  classStart: Date,
) {
  const problem = cardProblem(
    {
      status: card.status,
      creditsTotal: card.credits_total,
      creditsUsed: card.credits_used,
      expiresAt: card.expires_at,
    },
    classStart,
  );
  if (problem) throw new BookingError(`card_${problem}`);
}

/** Book a class with an existing 10-session card. No payment needed. */
export async function bookWithCard(input: { classId: string; email: string; cardCode: string }) {
  return sql.begin(async (tx) => {
    const card = await lockCard(tx, input.cardCode);
    if (!card.email || card.email.toLowerCase() !== input.email.trim().toLowerCase())
      throw new BookingError("card_wrong_email");
    const { startsAt } = await lockClassForBooking(tx, input.classId, card.customer_id);
    assertCardUsable(card, startsAt);
    const code = bookingCode();
    await tx`
      insert into bookings (code, class_id, customer_id, status, kind, card_id)
      values (${code}, ${input.classId}, ${card.customer_id}, 'confirmed', 'card', ${card.id})`;
    await tx`update cards set credits_used = credits_used + 1 where id = ${card.id}`;
    return { bookingCode: code };
  });
}

export type FulfillResult = { bookingCodes: string[]; cardCodes: string[] };

/** Mark a paid checkout as done. Idempotent: safe to call from both the webhook and the return page. */
export async function fulfillCheckout(ref: string, paymentRef: string | null): Promise<FulfillResult> {
  return sql.begin(async (tx) => {
    const cards = await tx<{ id: string; code: string }[]>`
      update cards set status = 'active', activated_at = now(), payment_ref = ${paymentRef},
        expires_at = now() + make_interval(days => ${config.cardValidityDays})
      where checkout_ref = ${ref} and status = 'pending'
      returning id, code`;
    const bookings = await tx<{ id: string; code: string; kind: string; card_id: string | null }[]>`
      update bookings set status = 'confirmed', payment_ref = ${paymentRef}, hold_expires_at = null
      where checkout_ref = ${ref} and status in ('pending','expired')
      returning id, code, kind, card_id`;
    for (const b of bookings) {
      if (b.kind === "card" && b.card_id)
        await tx`update cards set credits_used = credits_used + 1 where id = ${b.card_id}`;
    }
    return { bookingCodes: bookings.map((b) => b.code), cardCodes: cards.map((c) => c.code) };
  });
}

/** The client abandoned payment: free the spot. */
export async function expireCheckout(ref: string) {
  await sql`update bookings set status = 'expired' where checkout_ref = ${ref} and status = 'pending'`;
  await sql`update cards set status = 'expired_checkout' where checkout_ref = ${ref} and status = 'pending'`;
}

export type BookingView = {
  id: string;
  code: string;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  kind: "dropin" | "card" | "walkin" | "trial";
  amountCents: number;
  paymentRef: string | null;
  checkoutRef: string | null;
  checkedInAt: Date | null;
  refunded: boolean;
  customerName: string;
  customerEmail: string | null;
  cardCode: string | null;
  classId: string;
  title: string;
  instructor: string;
  startsAt: Date;
  durationMin: number;
  location: string;
  classCancelled: boolean;
};

const BOOKING_VIEW = () => sql`
  select b.id, b.code, b.status, b.kind, b.amount_cents as "amountCents", b.payment_ref as "paymentRef",
    b.checkout_ref as "checkoutRef", b.checked_in_at as "checkedInAt", b.refunded,
    cu.name as "customerName", cu.email as "customerEmail", k.code as "cardCode",
    c.id as "classId", c.title, c.instructor, c.starts_at as "startsAt", c.duration_min as "durationMin",
    c.location, c.cancelled as "classCancelled"
  from bookings b
  join classes c on c.id = b.class_id
  join customers cu on cu.id = b.customer_id
  left join cards k on k.id = b.card_id`;

export async function getBookingByCode(code: string): Promise<BookingView | null> {
  const [row] = await sql<BookingView[]>`${BOOKING_VIEW()} where b.code = ${code.toUpperCase()}`;
  return row ?? null;
}

export async function getBookingsByCheckoutRef(ref: string): Promise<BookingView[]> {
  return sql<BookingView[]>`${BOOKING_VIEW()} where b.checkout_ref = ${ref}`;
}

export async function roster(classId: string): Promise<BookingView[]> {
  if (!isUuid(classId)) return [];
  return sql<BookingView[]>`${BOOKING_VIEW()}
    where b.class_id = ${classId} and b.status = 'confirmed'
    order by lower(cu.name)`;
}

export type CardView = {
  id: string;
  code: string;
  status: string;
  creditsTotal: number;
  creditsUsed: number;
  expiresAt: Date | null;
  amountCents: number;
  checkoutRef: string | null;
  customerName: string;
  customerEmail: string | null;
};

export async function getCardByCode(code: string): Promise<CardView | null> {
  const [row] = await sql<CardView[]>`
    select k.id, k.code, k.status, k.credits_total as "creditsTotal", k.credits_used as "creditsUsed",
      k.expires_at as "expiresAt", k.amount_cents as "amountCents", k.checkout_ref as "checkoutRef",
      cu.name as "customerName", cu.email as "customerEmail"
    from cards k join customers cu on cu.id = k.customer_id
    where k.code = ${normalizeCardCode(code)}`;
  return row ?? null;
}

export async function getCardsByCheckoutRef(ref: string): Promise<CardView[]> {
  const rows = await sql<{ code: string }[]>`select code from cards where checkout_ref = ${ref}`;
  const out: CardView[] = [];
  for (const r of rows) {
    const c = await getCardByCode(r.code);
    if (c) out.push(c);
  }
  return out;
}

export async function cardBookings(cardId: string): Promise<BookingView[]> {
  return sql<BookingView[]>`${BOOKING_VIEW()}
    where b.card_id = ${cardId} and b.status = 'confirmed' order by c.starts_at desc`;
}

export type CancelOutcome = { refund: "credit" | "money" | "none"; booking: BookingView };

/**
 * Cancel a booking. In time (CANCEL_HOURS before class) the card credit comes back, or
 * the drop-in is refunded via `refundMoney`. Staff can force a refund (e.g. class cancelled).
 */
export async function cancelBooking(
  code: string,
  refundMoney: (paymentRef: string, amountCents: number) => Promise<void>,
  opts: { forceRefund?: boolean } = {},
): Promise<CancelOutcome> {
  const result = await sql.begin(async (tx) => {
    const [b] = await tx<
      { id: string; status: string; kind: string; card_id: string | null; payment_ref: string | null; amount_cents: number; starts_at: Date }[]
    >`
      select b.id, b.status, b.kind, b.card_id, b.payment_ref, b.amount_cents, c.starts_at
      from bookings b join classes c on c.id = b.class_id
      where b.code = ${code.toUpperCase()} for update of b`;
    if (!b) throw new BookingError("booking_not_found");
    if (b.status !== "confirmed") throw new BookingError("already_cancelled");
    const inTime = opts.forceRefund || freeCancellation(b.starts_at, config.cancelHours);
    let refund: CancelOutcome["refund"] = "none";
    if (inTime && b.kind === "card" && b.card_id) {
      await tx`update cards set credits_used = greatest(credits_used - 1, 0) where id = ${b.card_id}`;
      refund = "credit";
    } else if (inTime && b.kind === "dropin" && b.payment_ref) {
      refund = "money";
    }
    await tx`update bookings set status = 'cancelled', cancelled_at = now(), refunded = ${refund !== "none"}
             where id = ${b.id}`;
    return { refund, paymentRef: b.payment_ref, amount: b.amount_cents };
  });
  if (result.refund === "money" && result.paymentRef) await refundMoney(result.paymentRef, result.amount);
  const booking = (await getBookingByCode(code))!;
  return { refund: result.refund, booking };
}

export async function setCheckIn(bookingId: string, present: boolean) {
  if (!isUuid(bookingId)) return;
  await sql`update bookings set checked_in_at = ${present ? sql`now()` : null}
            where id = ${bookingId} and status = 'confirmed'`;
}

/** Instructor adds someone at the door. With a card code, one credit is used. */
export async function addWalkIn(input: { classId: string; name: string; email?: string | null; cardCode?: string | null }) {
  return sql.begin(async (tx) => {
    let customerId: string;
    let cardId: string | null = null;
    let card: Awaited<ReturnType<typeof lockCard>> | null = null;
    if (input.cardCode) {
      card = await lockCard(tx, input.cardCode);
      customerId = card.customer_id;
      cardId = card.id;
    } else {
      customerId = await upsertCustomer(tx, input.email?.trim() || null, input.name);
    }
    const { startsAt } = await lockClassForBooking(tx, input.classId, customerId, { ignoreCapacity: true });
    if (card) assertCardUsable(card, startsAt);
    const code = bookingCode();
    await tx`
      insert into bookings (code, class_id, customer_id, status, kind, card_id, amount_cents, checked_in_at)
      values (${code}, ${input.classId}, ${customerId}, 'confirmed', ${card ? "card" : "walkin"}, ${cardId},
              ${card ? 0 : config.dropInCents}, now())`;
    if (cardId) await tx`update cards set credits_used = credits_used + 1 where id = ${cardId}`;
    return { bookingCode: code };
  });
}

export async function createClasses(
  rows: { title: string; instructor: string; startsAt: Date; durationMin: number; capacity: number; location?: string }[],
) {
  return sql.begin(async (tx) => {
    for (const r of rows) {
      await tx`insert into classes (title, instructor, starts_at, duration_min, capacity, location)
               values (${r.title}, ${r.instructor}, ${r.startsAt}, ${r.durationMin}, ${r.capacity},
                       ${r.location ?? config.studioName})`;
    }
    return rows.length;
  });
}

/** Cancel a whole class: everyone gets their credit or money back. Returns the affected bookings. */
export async function cancelClass(
  classId: string,
  refundMoney: (paymentRef: string, amountCents: number) => Promise<void>,
) {
  if (!isUuid(classId)) throw new BookingError("class_not_found");
  const people = await roster(classId);
  await sql`update classes set cancelled = true where id = ${classId}`;
  const outcomes: CancelOutcome[] = [];
  for (const p of people) outcomes.push(await cancelBooking(p.code, refundMoney, { forceRefund: true }));
  return outcomes;
}
