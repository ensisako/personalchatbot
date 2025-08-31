// src/app/(protected)/dashboard/page.tsx
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs/components';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';

const SUBJECTS = ['MATHS', 'MIDGE', 'DATABASE_SYSTEMS'] as const;
type Subject = typeof SUBJECTS[number];

export default async function Dashboard() {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  const email = user?.email as string | undefined;

  if (!email) {
    return <div className="p-6">Not authenticated.</div>;
  }

  const dbUser = await prisma.user.findUnique({
    where: { email },
    include: { subjectLvls: true, attempts: true },
  });

  const masteryBySubject = (dbUser?.attempts || []).reduce<Record<string, { score: number; max: number }>>(
    (acc, a) => {
      const k = a.subject as string;
      acc[k] ||= { score: 0, max: 0 };
      acc[k].score += a.score;
      acc[k].max += a.maxScore;
      return acc;
    },
    {}
  );

  const getPct = (s: Subject) => {
    const agg = masteryBySubject[s] || { score: 0, max: 0 };
    return agg.max ? Math.round((agg.score / agg.max) * 100) : 0;
  };

  const totalQuizzes = dbUser?.attempts.length ?? 0;
  const avgScore = (() => {
    const atts = dbUser?.attempts || [];
    if (!atts.length) return 0;
    const sum = atts.reduce((t, a) => t + (a.maxScore ? a.score / a.maxScore : 0), 0);
    return Math.round((sum / atts.length) * 100);
  })();

  const sortedSubjects: Subject[] = Array.from(SUBJECTS).sort((a, b) => getPct(a) - getPct(b));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <LogoutLink className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
          Log out
        </LogoutLink>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><span className="text-gray-500">Email:</span> {dbUser?.email}</div>
            <div><span className="text-gray-500">Student ID:</span> {dbUser?.studentId}</div>
            <div><span className="text-gray-500">Degree Type:</span> {dbUser?.degree}</div>
            <div><span className="text-gray-500">Programme:</span> {dbUser?.degreeName ?? '—'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Overall performance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-gray-600">Average score</div>
            <Progress value={avgScore} />
            <div className="text-xs text-gray-500">{avgScore}%</div>
            <div className="mt-4 text-sm text-gray-600">Quizzes taken</div>
            <div className="text-xl font-semibold">{totalQuizzes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Next steps</CardTitle></CardHeader>
          <CardContent className="text-sm text-gray-700">
            {Object.keys(masteryBySubject).length === 0 ? (
              <div>Take a quiz to see recommendations.</div>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                {sortedSubjects.map((s) => (
                  <li key={s}>
                    Focus on <strong>{s.replace('_', ' ')}</strong> — mastery {getPct(s)}%
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {SUBJECTS.map((s) => {
          const lvl = dbUser?.subjectLvls.find((x) => x.subject === s)?.level ?? 'BEGINNER';
          const pct = getPct(s);
          return (
            <Card key={s}>
              <CardHeader><CardTitle>{s.replace('_', ' ')}</CardTitle></CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">Level: {lvl}</div>
                <div className="mt-2"><Progress value={pct} /></div>
                <div className="mt-1 text-xs text-gray-500">Mastery: {pct}%</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
