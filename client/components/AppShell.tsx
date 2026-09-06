"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { Navigation } from './Navigation';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  if (isLandingPage) {
    return (
      <main className="min-h-screen w-full bg-[#05030a] text-[#f8f7fb]">
        {children}
      </main>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-12">
        {children}
      </main>
    </div>
  );
};
