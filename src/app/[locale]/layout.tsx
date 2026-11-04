import { notFound } from "next/navigation";
import { isLocale, t } from "@/lib/i18n";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      {children}
      <footer className="site-footer">
        <div className="wrap row">
          <span>{t(locale).footer}</span>
          <span className="spacer" />
          <a href="https://moveo.lu">moveo.lu</a>
        </div>
      </footer>
    </>
  );
}
