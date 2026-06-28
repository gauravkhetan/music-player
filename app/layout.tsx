import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Music",
  description: "Private personal music streaming library",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Personal Music",
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body suppressHydrationWarning>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
