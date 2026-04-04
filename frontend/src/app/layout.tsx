import type { Metadata, Viewport } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Latido",
  description: "Tu planner diario con inteligencia artificial",
  icons: {
    icon: "/images/icon-white.png",
    apple: "/images/icon-white.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#080D1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${playfair.variable} ${jakarta.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased noise-overlay">{children}</body>
    </html>
  );
}
