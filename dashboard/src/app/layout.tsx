import "./polyfills";
import type { Metadata, Viewport } from "next";
import "./globals.css";

import { WalletContextProvider } from "@/components/WalletContextProvider";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "SolVoid | Privacy Infrastructure for Solana",
  description: "Enterprise-grade privacy forensic dashboard with ZK-proof shielding, anonymous transactions, and wallet protection for the Solana ecosystem.",
  keywords: ["solana", "privacy", "zk-proof", "cryptocurrency", "wallet", "security"],
  authors: [{ name: "SolVoid Team" }],
  openGraph: {
    title: "SolVoid | Privacy Infrastructure",
    description: "Implementation of ZK-proof privacy shielding and anonymity recovery for the Solana ecosystem.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="font-sans">
        <WalletContextProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </WalletContextProvider>
      </body>
    </html>
  );
}
