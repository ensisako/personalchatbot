import type { ReactNode } from 'react';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user?.email) redirect('/');

  const email = user.email as string;

  const dbUser = await prisma.user.findUnique({
    where: { email },
    include: { subjectLvls: true },
  });

  // Must have a valid Student ID and at least a chosen degree (and ideally degreeName)
  const hasValidStudentId = !!(dbUser?.studentId && /^c\d{8}$/i.test(dbUser.studentId));
  const hasDegree = !!dbUser?.degree;
  const hasDegreeName = !!dbUser?.degreeName; // optional in DB, but required by our UX

  if (!hasValidStudentId || !hasDegree || !hasDegreeName) {
    redirect('/onboarding');
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <div className="font-semibold">LeedsBot</div>
          <nav className="flex gap-4 text-sm">
            <a href="/dashboard">Dashboard</a>
            <a href="/chat">Chat</a>
            <a href="/quiz">Quiz</a>
            <a href="/uploads">Uploads</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
