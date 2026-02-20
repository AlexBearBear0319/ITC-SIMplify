import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SIMplify - Campus Map",
  description: "Find study spots on campus",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="overflow-x-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
