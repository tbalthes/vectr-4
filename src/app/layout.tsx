import "./globals.css";
import React from "react";

export const metadata = {
  title: "Vectr 4",
  description: "Your app description here",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
