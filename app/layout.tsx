import type { Metadata } from "next";
import { Viewport } from "next";
import "./globals.css";
import localfont from 'next/font/local'
import { ThemeProvider } from "@/components/theme-provider"


export const metadata: Metadata = {
  title: "AIDE",
  description: "An interactive threaded chat interface",
  keywords: "chat, AI, LLM, thread, conversation, language models",
  authors: [{ name: "yijia zhao" }, { name: "jiawei wen" }, { name: "alex huper" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  twitter: {
    card: "summary_large_image",
    title: "AIDE",
    description: "An interactive threaded chat interface",
    images: ["/android-chrome-512x512.png"],
  },
  openGraph: {
    title: "AIDE",
    description: "Engage in threaded conversations with AI assistance",
    type: "website",
    url: "https://aide.zy-j.com",
    images: [{ url: "/android-chrome-512x512.png" }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const jetBrainsMono = localfont({
  src: [
    {
      path: '../public/fonts/JetBrainsMono-Regular.ttf',
      weight: '400'
    }
  ],
  variable: '--font-jetbrains-mono'
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jetBrainsMono.variable}`}>
      <body className={`font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}