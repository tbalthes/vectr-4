'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/contexts/AuthContext';
import { AccountSyncProvider } from '@/contexts/AccountSyncContext';
import { Sidebar } from '@/components/Sidebar';

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Sidebar is open by default on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 768,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Listen for window resize to update sidebar open state
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    // Set initial state
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/public/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div>Loading...</div>; // Or a more sophisticated loading spinner
  }

  if (!user) {
    return null; // Redirecting, so don't render anything
  }

  return (
    <AccountSyncProvider>
      {/* Sidebar: fixed on all screens */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsible={true}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Hamburger button for mobile */}
      {!sidebarOpen && (
        <button
          className="md:hidden fixed top-4 left-4 z-[50] bg-background rounded-full shadow p-2 border border-border"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Main content: adjusted for sidebar */}
      <main
        className={`h-screen overflow-y-auto transition-all duration-200 ${
          sidebarOpen && !sidebarCollapsed
            ? 'ml-64'
            : sidebarOpen && sidebarCollapsed
              ? 'ml-16'
              : ''
        }`}
      >
        {children}
      </main>
    </AccountSyncProvider>
  );
}
