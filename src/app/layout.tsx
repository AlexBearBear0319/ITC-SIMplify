import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import ThemeProvider from "@/components/providers/ThemeProvider";
import { MorphPanel } from "@/components/ui/ai-input";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SIMplify – Find Your Study Spot",
    template: "%s · SIMplify",
  },
  description:
    "Find available study spots, check real-time crowd statuses, discover study buddies, and earn rewards — by SIM IT Club.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {/* App shell: sidebar (fixed) + scrollable main area */}
          <div className="flex h-screen overflow-hidden bg-canvas">
            <Sidebar />

            {/* Content column: offset by sidebar width on md+ */}
            <div className="flex flex-col flex-1 overflow-hidden md:ml-64">
              <Header />

              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </div>
          </div>

          {/* Floating AI chat button — fixed above mobile nav area */}
          <div className="fixed bottom-24 right-6 z-50 md:bottom-8 md:right-8">
            <MorphPanel />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
