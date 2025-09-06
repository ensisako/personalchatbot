// src/app/chat/page.tsx
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ChatClient from './ChatClient';

async function isOnboarded(email: string) {
  const u = await prisma.user.findUnique({ where: { email }, include: { subjectLvls: true } });
  const hasStudentId = !!u?.studentId;
  const hasDegree = !!u?.degree;
  const hasProgramme = !!u?.degreeName;
  const hasAllSubjects =
    (u?.subjectLvls ?? []).filter((s) => ['MATHS', 'MIDGE', 'DATABASE_SYSTEMS'].includes(s.subject as any)).length === 3;
  return hasStudentId && hasDegree && hasProgramme && hasAllSubjects;
}

export default async function ChatPage() {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user?.email) redirect('/');

  if (!(await isOnboarded(user.email))) redirect('/onboarding');

  return <ChatClient />;
}
