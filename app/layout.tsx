import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  preload: true,
});

export const metadata: Metadata = {
  title: "Valid8 — 바이브코딩 실현성 분석기",
  description: "바이브코딩 실현성을 냉정하게 분석합니다",
  icons: {
    icon: "/skull.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
