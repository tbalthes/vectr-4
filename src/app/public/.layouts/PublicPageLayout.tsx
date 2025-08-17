import React from "react";

interface PublicPageLayoutProps {
  children: React.ReactNode;
}

export function PublicPageLayout({ children }: PublicPageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="w-full px-6 py-4 shadow-sm bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-bold text-primary">Vectr</div>
          <nav className="space-x-6">
            <a href="/login" className="text-sm font-medium text-primary hover:underline">
              Login
            </a>
            <a href="/register" className="text-sm font-medium text-primary hover:underline">
              Register
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full py-4 bg-white shadow-inner mt-8">
          <div className="max-w-7xl mx-auto text-center text-xs text-muted">
            &copy; {new Date().getFullYear()} Vectr Finance Suite. All rights reserved.
          </div>
        </footer>
      </div>
    );
  }