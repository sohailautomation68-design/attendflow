import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "attendflow — Attendance for academies",
  description: "Fast, reliable attendance marking for teachers and academies.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
