// src/app/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { LoginLink, RegisterLink } from '@kinde-oss/kinde-auth-nextjs/components';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';

async function safeGetUser(timeoutMs = 2500) {
  try {
    const { getUser } = getKindeServerSession();
    return (await Promise.race([
      getUser(),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error('getUser timeout')), timeoutMs)),
    ])) as any;
  } catch (e) {
    console.error('Auth soft-fail (home):', e);
    return null;
  }
}

export default async function HomePage() {
  const user = await safeGetUser(); // never throw

  if (user?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { subjectLvls: true },
    });

    const done =
      !!dbUser?.studentId &&
      !!dbUser?.degree &&
      !!dbUser?.degreeName &&
      (dbUser?.subjectLvls ?? []).filter(
        s => s.subject === 'MATHS' || s.subject === 'MIDGE' || s.subject === 'DATABASE_SYSTEMS'
      ).length === 3;

    redirect(done ? '/dashboard' : '/onboarding');
  }

  // Public landing
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center p-6">
      <div className="w-full space-y-4 rounded border p-6 bg-white">
        <h1 className="text-2xl font-semibold">Welcome to LeedsBot</h1>
        <p className="text-gray-600">Sign in to start personalised tutoring and quizzes.</p>
        <LoginLink className="block w-full rounded bg-black px-4 py-2 text-center text-white">
          Sign in
        </LoginLink>
        <RegisterLink className="block w-full rounded border px-4 py-2 text-center">
          Create account
        </RegisterLink>
      </div>
    </main>
  );
}
