import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Dancing_Script } from "next/font/google";
import { Providers } from "@/app-shell/Providers";
import { withBase } from "@/core/config";
import { defaultMetadata } from "@/core/seo/metadata";
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
  ...defaultMetadata,
  icons: {
    icon: [{ url: withBase("/icons/favicon-48.png"), sizes: "48x48", type: "image/png" }],
    apple: withBase("/icons/apple-touch-icon.png"),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f7fc",
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
