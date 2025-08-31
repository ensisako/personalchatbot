import { NextRequest, NextResponse } from 'next/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { studentId, degree, degreeName, goals, levels } = await req.json();

  // Validate studentId
  if (!/^c\d{8}$/i.test(String(studentId))) {
    return NextResponse.json({ error: 'Invalid studentId (must be c########)' }, { status: 400 });
  }

  // Upsert user (degreeName is optional in DB but we try to save it if provided)
  await prisma.user.upsert({
    where: { email: user.email },
    update: {
      studentId: String(studentId).toLowerCase(),
      degree,
      degreeName: degreeName ? String(degreeName) : null,
      goals: goals ?? null,
    },
    create: {
      email: user.email,
      studentId: String(studentId).toLowerCase(),
      degree,
      degreeName: degreeName ? String(degreeName) : null,
      goals: goals ?? null,
    },
  });

  // Upsert per-subject levels if provided
  if (levels) {
    const subjects = ['MATHS','MIDGE','DATABASE_SYSTEMS'] as const;
    await Promise.all(subjects.map((s) =>
      prisma.userSubjectLevel.upsert({
        where: { userEmail_subject: { userEmail: user.email!, subject: s as any } },
        update: { level: levels[s] as any },
        create: { userEmail: user.email!, subject: s as any, level: levels[s] as any },
      })
    ));
  }

  return NextResponse.json({ ok: true });
}
