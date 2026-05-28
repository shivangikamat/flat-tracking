import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flat Hunter",
  description: "A private Edinburgh flat-hunting dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
