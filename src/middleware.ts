import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["en", "fr", "de"];

function pickLocale(req: NextRequest): string {
  const header = req.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const lang = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (LOCALES.includes(lang)) return lang;
  }
  return "en";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = `/${pickLocale(req)}`;
    return NextResponse.redirect(url);
  }
  // Tell the root layout which <html lang> to use.
  const headers = new Headers(req.headers);
  headers.set("x-locale", LOCALES.includes(first) ? first : "en");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next|api|favicon|pass/|.*\\.).*)"],
};
