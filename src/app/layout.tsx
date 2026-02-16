import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "진실성 필터 — YouTube Clickbait Detector",
  description: "유튜브 영상 제목의 약속과 실제 내용의 일치도를 AI로 분석합니다",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
