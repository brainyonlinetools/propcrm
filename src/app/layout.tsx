import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BottomNav } from "@/components/shared/BottomNav";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { PushNotificationProvider } from "@/components/providers/PushNotificationProvider";
import { TaskReminderPoller } from "@/components/providers/TaskReminderPoller";
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
  title: "Anand Prime CRM",
  description: "Premium real estate CRM for Anand Prime, Gurugram",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Anand Prime",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fafafa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="anand-prime-theme"
        >
          <QueryProvider>
            <PushNotificationProvider />
            <TaskReminderPoller />
            <div className="mx-auto min-h-dvh w-full max-w-lg overflow-x-hidden pb-20">
              {children}
            </div>
            <BottomNav />
            <Toaster position="bottom-center" richColors offset="5rem" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
