import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import localfont from 'next/font/local'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AIDE",
  description: "An interactive threaded chat interface",
  keywords: "chat, AI, LLM, thread, conversation, language models",
  authors: [{ name: "yijia zhao" }, { name: "jiawei wen" }, { name: "alex huper" }],
  openGraph: {
    title: "AIDE",
    description: "Engage in threaded conversations with AI assistance",
    type: "website",
    url: "https://aide.zy-j.com",
    images: [{ url: "https://zy-j.com/images/avatar.png" }],
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
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
      <body className={`font-sans`}>{children}</body>
    </html>
  );
}