import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { NotesProvider } from "@/contexts/NotesContext";
import { ConditionalSidebar } from "@/components/sidebar/ConditionalSidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Overlay Platform",
  description: "AI-powered document review and evaluation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NotesProvider>
          <div className="flex">
            <main className="flex-1 mr-0">{children}</main>
            <ConditionalSidebar />
          </div>
          <Toaster position="top-right" richColors />
        </NotesProvider>
      </body>
    </html>
  );
}
