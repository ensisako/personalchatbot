// src/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  studentId: z.string().regex(/^c\d{8}$/i, 'Student ID must be c########'),
  degree: z.enum(['BACHELORS', 'MASTERS', 'PHD']),
  degreeName: z.string().min(2, 'Select your programme'),
  goals: z.string().optional(),
  levels: z.object({
    MATHS: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
    MIDGE: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
    DATABASE_SYSTEMS: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  }),
});

export async function GET() {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = user.email as string; // make non-null for Prisma types

  const dbUser = await prisma.user.findUnique({
    where: { email },
    include: { subjectLvls: true },
  });

  const levelsObj: Record<
    'MATHS' | 'MIDGE' | 'DATABASE_SYSTEMS',
    'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | undefined
  > = {
    MATHS: dbUser?.subjectLvls.find((s) => s.subject === 'MATHS')?.level as any,
    MIDGE: dbUser?.subjectLvls.find((s) => s.subject === 'MIDGE')?.level as any,
    DATABASE_SYSTEMS: dbUser?.subjectLvls.find((s) => s.subject === 'DATABASE_SYSTEMS')?.level as any,
  };

  const completed =
    !!dbUser?.studentId &&
    !!dbUser?.degree &&
    !!dbUser?.degreeName &&
    !!levelsObj.MATHS &&
    !!levelsObj.MIDGE &&
    !!levelsObj.DATABASE_SYSTEMS;

  return NextResponse.json({
    completed,
    profile: {
      studentId: dbUser?.studentId ?? '',
      degree: dbUser?.degree ?? 'BACHELORS',
      degreeName: dbUser?.degreeName ?? '',
      goals: dbUser?.goals ?? '',
      levels: {
        MATHS: levelsObj.MATHS ?? 'BEGINNER',
        MIDGE: levelsObj.MIDGE ?? 'BEGINNER',
        DATABASE_SYSTEMS: levelsObj.DATABASE_SYSTEMS ?? 'BEGINNER',
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = user.email as string; // make non-null for Prisma types

  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { studentId, degree, degreeName, goals, levels } = parsed.data;

  // Upsert user core fields
  await prisma.user.upsert({
    where: { email },
    update: { studentId, degree, degreeName, goals },
    create: { email, studentId, degree, degreeName, goals },
  });

  // Upsert per-subject levels
  await Promise.all(
    (['MATHS', 'MIDGE', 'DATABASE_SYSTEMS'] as const).map((subject) =>
      prisma.userSubjectLevel.upsert({
        where: { userEmail_subject: { userEmail: email, subject } },
        update: { level: levels[subject] },
        create: { userEmail: email, subject, level: levels[subject] },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
