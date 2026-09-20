// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import { getDirection, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { LocaleProvider } from "@/app/components/layout/LocaleProvider";
import { ToastProvider } from "@/app/components/ui/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  variable: "--font-noto-nastaliq",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Business Manager",
  description:
    "Multi-tenant business management system — inventory, sales, customers, and suppliers in one place.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const direction = getDirection(locale);
  const dictionary = getDictionary(locale);

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${geistSans.variable} ${geistMono.variable} ${notoNastaliqUrdu.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider locale={locale} dictionary={dictionary}>
          <ToastProvider>{children}</ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}