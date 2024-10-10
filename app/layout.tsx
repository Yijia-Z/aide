import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
