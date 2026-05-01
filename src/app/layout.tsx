import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitMetro",
  description: "Turn any GitHub repository into a readable metro map.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
