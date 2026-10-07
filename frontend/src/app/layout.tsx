import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Dancing_Script } from "next/font/google";
import { Providers } from "@/app-shell/Providers";
import { ThemeScript } from "@/design/theme-script";
import "./globals.css";

const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const script = Dancing_Script({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "700"],
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Lịch Gia Đình", template: "%s · Lịch Gia Đình" },
  description: "Hôm nay nhà mình có gì? Lịch, việc, nhắc nhở và an toàn cho cả nhà.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1626" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${sans.variable} ${script.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
