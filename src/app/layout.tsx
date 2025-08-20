import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// Step 4: Import your newly refactored AuthProvider
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vectr-4 Finance",
  description: "Your financial command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Wrap your entire application with the provider */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
