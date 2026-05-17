import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Antigravity Analytics | AI-Powered Business Intelligence Chat Assistant",
  description: "Query, analyze, and visualize your database using natural language with a real-time, interactive, chat-native BI dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      style={{ height: '100%', overflow: 'hidden' }}
    >
      <body style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</body>
    </html>
  );
}
