// src/app/(grp-protected)/layout.tsx
'use client';

import type { ReactNode } from 'react';

export default function ProtectedClientLayout({ children }: { children: ReactNode }) {
  // Making the segment layout a Client Component ensures Next emits the client-reference manifest.
  return <>{children}</>;
}
