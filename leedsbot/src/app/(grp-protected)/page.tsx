// src/app/(protected)/page.tsx
import { redirect } from 'next/navigation';

export default function ProtectedIndex() {
  redirect('/dashboard');  // or return null;
}
