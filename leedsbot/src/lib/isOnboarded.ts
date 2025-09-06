// src/lib/isOnboarded.ts
import { prisma } from '@/lib/prisma';

export async function isOnboarded(email: string) {
  const u = await prisma.user.findUnique({ where: { email }, include: { subjectLvls: true } });
  const hasStudentId = !!u?.studentId;
  const hasDegree = !!u?.degree;
  const hasProgramme = !!u?.degreeName;
  const hasAllSubjects =
    (u?.subjectLvls ?? []).filter((s) => ['MATHS', 'MIDGE', 'DATABASE_SYSTEMS'].includes(s.subject as any)).length === 3;
  return hasStudentId && hasDegree && hasProgramme && hasAllSubjects;
}
