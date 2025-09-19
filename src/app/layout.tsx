import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';
import '../styles/plaid-fix.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { Toaster } from '@/components/ui/sonner';
const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vectr-4 Finance',
  description: 'Your financial command center',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster
              position="bottom-right"
              closeButton
              richColors
              expand={false}
              visibleToasts={4}
              toastOptions={{
                style: {
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#1f2937',
                  opacity: '1',
                  backdropFilter: 'none',
                  boxShadow:
                    '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                },
                className: 'vectr-toast',
                descriptionClassName: 'vectr-toast-description',
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
