// src/app/layout.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import './globals.css';
import { ReactNode } from 'react';
import NavBar from '@/components/NavBar';

export default async function RootLayout({ children }: { children: ReactNode }) {
  // ❌ don’t call getUser() here; keep layout cheap & resilient
  return (
    <html lang="en">
      <body className="bg-gray-50">
        {/* If your NavBar needs the user, make NavBar a client component using Kinde hooks */}
        <NavBar />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
