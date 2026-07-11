import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interview Research Tool",
  description: "Personal interview research and prep tracker",
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
