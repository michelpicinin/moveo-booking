import postgres from "postgres";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
console.log("Schema up to date");
await sql.end();
