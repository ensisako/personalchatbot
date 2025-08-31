import { NextRequest, NextResponse } from 'next/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Item = { question: string; choices: string[]; answerIndex: number; explanation: string; topic?: string };

export async function POST(req: NextRequest) {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subject } = await req.json();
  const profile = await prisma.user.findUnique({ where: { email: user.email }, include: { subjectLvls: true } });
  const lvl = profile?.subjectLvls.find(s=>s.subject===subject)?.level || 'BEGINNER';

  const prompt = `Create 5 multiple-choice questions (with exactly 4 options) for Higher Education ${subject} at ${lvl} level. Return JSON array with fields: question, choices (4 strings), answerIndex (0-3), explanation.`;
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You return only valid JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
  });

  let items: Item[] = [];
  try { items = JSON.parse(completion.choices[0]?.message?.content || '[]'); }
  catch { items = []; }
  if (!Array.isArray(items) || items.length === 0) {
    items = [
      { question: 'What is 2 + 2?', choices:['1','2','3','4'], answerIndex:3, explanation:'2+2=4' }
    ];
  }

  return NextResponse.json({ items });
}

export async function PUT(req: NextRequest) {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subject, items, answers } = await req.json() as { subject: string; items: Item[]; answers: Record<number, number> };
  const score = items.reduce((acc,it,idx)=> acc + ((answers[idx]===it.answerIndex)?1:0), 0);
  const max = items.length;

  await prisma.quizAttempt.create({ data: {
    userEmail: user.email,
    subject: subject as any,
    items,
    responses: answers,
    score,
    maxScore: max,
  }});

  return NextResponse.json({ score, max });
}