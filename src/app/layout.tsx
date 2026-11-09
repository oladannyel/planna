import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { headers } from "next/headers";

import { ThemeProvider, themeInitScript } from "@/components/theme";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "plAnna",
  description: "AI-assisted planning, execution, and reflection.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Per-theme browser chrome colour. A single value would leave the mobile
  // address bar dark while the page renders light.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F9FAFB" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0F13" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Set by the proxy, which also puts it in the Content-Security-Policy. The
  // theme script below is inline, so without this it is exactly what the
  // policy is designed to block.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Runs before first paint so a stored preference never flashes the
          wrong theme. It mutates the <html> class, which is why this element
          carries suppressHydrationWarning.
        */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-canvas font-sans text-text-primary antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
