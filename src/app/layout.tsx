import "./globals.css";
import React from "react";
import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "Vectr Financial",
  description: "Your personal financial command center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
