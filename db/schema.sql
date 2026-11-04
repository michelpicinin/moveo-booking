-- MOVEO yoga booking schema. Idempotent: safe to run on every deploy.
create extension if not exists pgcrypto;

create table if not exists classes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  instructor   text not null,
  starts_at    timestamptz not null,
  duration_min int not null default 60 check (duration_min > 0),
  capacity     int not null check (capacity > 0),
  location     text not null default 'MOVEO Belair',
  cancelled    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists classes_starts_at on classes (starts_at);

create table if not exists customers (
  id         uuid primary key default gen_random_uuid(),
  email      text,            -- null for walk-ins who give no email
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists customers_email on customers (lower(email));

-- 10-session cards
create table if not exists cards (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  customer_id       uuid not null references customers(id),
  credits_total     int not null,
  credits_used      int not null default 0,
  status            text not null default 'pending' check (status in ('pending','active','expired_checkout','refunded')),
  amount_cents      int not null,
  expires_at        timestamptz,
  checkout_ref      text unique,
  payment_ref       text,
  created_at        timestamptz not null default now(),
  activated_at      timestamptz,
  check (credits_used >= 0 and credits_used <= credits_total)
);

create table if not exists bookings (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  class_id         uuid not null references classes(id),
  customer_id      uuid not null references customers(id),
  status           text not null check (status in ('pending','confirmed','cancelled','expired')),
  kind             text not null check (kind in ('dropin','card','walkin','trial')),
  card_id          uuid references cards(id),
  amount_cents     int not null default 0,
  checkout_ref     text,
  payment_ref      text,
  hold_expires_at  timestamptz,
  checked_in_at    timestamptz,
  refunded         boolean not null default false,
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz
);
create index if not exists bookings_class on bookings (class_id);
create index if not exists bookings_checkout on bookings (checkout_ref);
-- one live booking per person per class
create unique index if not exists bookings_one_per_person
  on bookings (class_id, customer_id) where status in ('pending','confirmed');

-- v0.2: free trial class (upgrade existing databases)
alter table bookings drop constraint if exists bookings_kind_check;
alter table bookings add constraint bookings_kind_check check (kind in ('dropin','card','walkin','trial'));

create table if not exists processed_events (
  id         text primary key,
  created_at timestamptz not null default now()
);
