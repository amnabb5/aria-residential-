import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aria Residences — Tour Any Apartment in 3D",
  description: "Aria Residences: 30 floors of design-forward homes. Pick a floor, choose a unit, and step inside for a first-person 3D walkthrough — right in your browser.",
  keywords: ["Aria Residences", "apartments", "3D walkthrough", "real estate", "luxury living", "Next.js", "React Three Fiber"],
  authors: [{ name: "Aria Residences" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Aria Residences — Tour Any Apartment in 3D",
    description: "Pick a floor, choose a unit, and step inside for a first-person 3D walkthrough.",
    url: "https://aria-residential.onrender.com",
    siteName: "Aria Residences",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aria Residences — Tour Any Apartment in 3D",
    description: "Pick a floor, choose a unit, and step inside for a first-person 3D walkthrough.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
