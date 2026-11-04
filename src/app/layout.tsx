import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOVEO Yoga – Book a class",
  description: "Book yoga classes at MOVEO Belair, Luxembourg. Drop-in or 10-session card.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F7F5F1" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = (await headers()).get("x-locale") ?? "en";
  return (
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
