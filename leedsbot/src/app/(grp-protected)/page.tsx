// src/app/(grp-protected)/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProtectedIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');   // or do nothing: return null
  }, [router]);
  return null;
}
