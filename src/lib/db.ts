import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __moveoSql: postgres.Sql | undefined;
}

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    onnotice: () => {},
    // Neon / most hosted Postgres require TLS; local URLs can opt out with sslmode=disable
    ssl: url.includes("sslmode=disable") || url.includes("localhost") || url.includes("host=/") ? false : "require",
  });
}

/** Lazily created so `next build` works without a database. */
export const sql: postgres.Sql = new Proxy(function () {} as unknown as postgres.Sql, {
  get(_t, prop) {
    globalThis.__moveoSql ??= connect();
    const v = (globalThis.__moveoSql as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? v.bind(globalThis.__moveoSql) : v;
  },
  apply(_t, _this, args) {
    globalThis.__moveoSql ??= connect();
    return (globalThis.__moveoSql as unknown as (...a: unknown[]) => unknown)(...args);
  },
}) as postgres.Sql;
