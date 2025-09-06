// src/app/onboarding/page.tsx
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { redirect } from 'next/navigation';
import OnboardingClient from './OnboardingClient';

export default async function OnboardingPage() {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user?.email) redirect('/'); // must be signed in

  return <OnboardingClient />;
}
