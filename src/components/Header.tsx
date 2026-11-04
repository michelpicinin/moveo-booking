import Link from "next/link";
import type { Locale } from "@/lib/i18n";

export function Header({ locale, path = "" }: { locale: Locale; path?: string }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="logo" href={`/${locale}`}>
          <span className="dot" />
          MOVEO <small>Yoga</small>
        </Link>
        <nav className="lang" aria-label="Language">
          {(["de", "en", "fr"] as const).map((l) => (
            <a key={l} href={`/${l}${path}`} aria-current={l === locale ? "true" : undefined} hrefLang={l}>
              {l.toUpperCase()}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
