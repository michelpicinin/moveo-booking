import type { Locale } from "@/lib/i18n";

export function Header({ locale, path = "" }: { locale: Locale; path?: string }) {
  return (
    <header className="site-header">
      <div className="wrap">
        {/* The logo leads back to the main MOVEO website, in the same language. */}
        <a className="logo" href={`https://moveo.lu/${locale}/index.html`}>
          <span className="dot" />
          MOVEO <small>Yoga</small>
        </a>
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
