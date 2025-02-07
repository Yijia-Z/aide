import type { Metadata } from "next";
import { Viewport } from "next";
import "./globals.css";
import { Averia_Serif_Libre } from 'next/font/google';
import localfont from "next/font/local";
import { Providers } from "./providers";
import { registerServiceWorker } from '@/components/utils/register-sw';
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "Aide",
  description: "A dynamic platform for musing and conversing language models",
  keywords: "chat, AI, LLM, thread, conversation, language models",
  metadataBase: new URL('https://aide.zy-j.com'),
  authors: [
    { name: "yijia zhao" },
    { name: "jiawei weng" },
    { name: "wilhelm huper" },
  ],
  appleWebApp: {
    statusBarStyle: "black-translucent",
  },
  twitter: {
    card: "summary_large_image",
    title: "AIDE",
    description: "Dive into engaging threaded conversations with AI assistance",
    images: ["/android-chrome-512x512.png"],
  },
  openGraph: {
    title: "AIDE",
    description: "Dive into engaging threaded conversations with AI assistance",
    type: "website",
    url: "https://aide.zy-j.com",
    images: [{ url: "/app.jpg" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const serif = Averia_Serif_Libre({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: '300',
  display: 'swap'
});

const jetBrainsMono = localfont({
  src: [
    {
      path: "../public/fonts/JetBrainsMono-Regular.ttf",
      weight: "400",
    },
  ],
  variable: "--font-jetbrains-mono",
  display: 'swap',
  preload: true
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Register service worker
  if (typeof window !== 'undefined') {
    registerServiceWorker();
  }

  return (
    <html lang="en" className={`${jetBrainsMono.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`font-sans overflow-hidden`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}