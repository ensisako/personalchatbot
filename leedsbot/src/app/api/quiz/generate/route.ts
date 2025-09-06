// src/app/api/quiz/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey?.trim() ? new OpenAI({ apiKey }) : null;

type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
type Item = {
  question: string;
  choices: string[]; // exactly 4
  answerIndex: number; // 0..3
  explanation: string;
  topic?: string;
  difficulty?: Level;
};

function trim(s: string, max = 8000) { return s.length <= max ? s : s.slice(0, max); }
function bump(level: Level, dir: 1 | -1): Level {
  const order: Level[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  const i = order.indexOf(level);
  return order[Math.max(0, Math.min(order.length - 1, i + dir))];
}

/** Extract JSON object/array from possibly wrapped text. */
function extractJson<T = any>(text: string): T | null {
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch {}
  const a = text.indexOf('['), b = text.indexOf('{');
  const start = (a === -1) ? b : (b === -1 ? a : Math.min(a,b));
  const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end+1)) as T; } catch {}
  return null;
}

/** Ensure 4 choices, valid answerIndex, strings trimmed, difficulty/topic filled. */
function sanitize(itemsIn: Item[], level: Level): Item[] {
  const out: Item[] = [];
  for (const it of itemsIn) {
    let choices = Array.isArray(it.choices) ? it.choices.filter(Boolean).map(String) : [];
    // de-dup and cap at 4
    const seen = new Set<string>();
    choices = choices.filter(c => { const k = c.trim(); if (!k || seen.has(k.toLowerCase())) return false; seen.add(k.toLowerCase()); return true; }).slice(0,4);
    // pad choices if <4
    while (choices.length < 4) choices.push(`Option ${choices.length+1}`);
    let answerIndex = Number.isInteger(it.answerIndex) ? it.answerIndex : 0;
    if (answerIndex < 0 || answerIndex > 3) answerIndex = 0;

    out.push({
      question: String(it.question || 'Untitled question').slice(0, 400),
      choices: choices.map(c => c.slice(0, 120)),
      answerIndex,
      explanation: String(it.explanation || 'Explanation unavailable.').slice(0, 600),
      topic: (it.topic || 'general').slice(0, 80),
      difficulty: (it.difficulty || level),
    });
  }
  return out;
}

/** Take first 6, or sample/expand to exactly 6. */
function exactSix(items: Item[], level: Level): Item[] {
  const arr = items.slice(0, 6);
  while (arr.length < 6) {
    arr.push({
      question: 'Which SQL statement inserts a new row?',
      choices: ['ADD ROW', 'INSERT INTO', 'CREATE ROW', 'MAKE ROW'],
      answerIndex: 1,
      explanation: '`INSERT INTO` adds new rows to a table.',
      topic: 'sql-dml',
      difficulty: level,
    });
  }
  return arr;
}

/** Global syllabus topics to steer generation when notes/questions are thin. */
const GLOBAL_TOPICS: Record<string, Record<Level, string[]>> = {
  DATABASE_SYSTEMS: {
    BEGINNER: ['keys', 'joins', 'sql-dml', 'normalization', 'constraints'],
    INTERMEDIATE: ['indexes', 'query-plans', 'transactions', 'isolation-levels', 'views'],
    ADVANCED: ['partitioning', 'sharding', 'concurrency', 'materialized-views', 'optimizer-hints'],
  },
  MATHS: {
    BEGINNER: ['arithmetic', 'fractions', 'basic-algebra'],
    INTERMEDIATE: ['quadratics', 'functions', 'trig-basics'],
    ADVANCED: ['calculus', 'linear-algebra', 'probability'],
  },
  MIDGE: { BEGINNER: ['intro'], INTERMEDIATE: ['core'], ADVANCED: ['advanced'] }
};

/** Hard fallback bank so we *always* show something sensible. */
function fallbackBank(subject: string, level: Level): Item[] {
  if (subject === 'DATABASE_SYSTEMS') {
    const L = level;
    return sanitize([
      {
        question: 'What is a primary key?',
        choices: ['Allows NULL duplicates', 'Uniquely identifies each row', 'References another table', 'Used only for sorting'],
        answerIndex: 1,
        explanation: 'A primary key uniquely identifies rows and cannot be NULL.',
        topic: 'keys', difficulty: L,
      },
      {
        question: 'Which statement inserts a new row?',
        choices: ['ADD ROW', 'INSERT INTO', 'CREATE ROW', 'APPEND'],
        answerIndex: 1,
        explanation: '`INSERT INTO` adds new rows.',
        topic: 'sql-dml', difficulty: L,
      },
      {
        question: 'A foreign key enforces…',
        choices: ['Uniqueness inside same table', 'Referential integrity to a parent table', 'Automatic indexes', 'Faster full scans'],
        answerIndex: 1,
        explanation: 'Foreign keys ensure child values exist in the parent table.',
        topic: 'keys', difficulty: L,
      },
      {
        question: 'Which JOIN returns only matches in both tables?',
        choices: ['LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN', 'INNER JOIN'],
        answerIndex: 3,
        explanation: 'INNER JOIN keeps rows that match on both sides.',
        topic: 'joins', difficulty: L,
      },
      {
        question: 'Which clause filters aggregated groups?',
        choices: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT/FETCH'],
        answerIndex: 1,
        explanation: 'HAVING filters *after* GROUP BY, WHERE filters rows *before* grouping.',
        topic: 'aggregation', difficulty: L,
      },
      {
        question: 'What is 3NF about?',
        choices: ['Combining all data into one table', 'Encrypting data', 'Reducing redundancy with well-structured tables', 'Only using denormalization'],
        answerIndex: 2,
        explanation: '3NF reduces redundancy and anomalies via proper dependencies.',
        topic: 'normalization', difficulty: L,
      },
    ], level);
  }
  // Generic
  return sanitize([
    { question: 'What is 2 + 2?', choices: ['1','2','3','4'], answerIndex: 3, explanation: '2 + 2 = 4', topic: 'arithmetic', difficulty: level },
  ], level);
}

/** Build “context” used by the prompt from docs, questions, cohort, global topics. */
async function buildContext(userEmail: string, subject: string, level: Level) {
  // 1) Notes (docs)
  const ownDocs = await prisma.document.findMany({
    where: { ownerEmail: userEmail, subject: subject as any, level: level as any },
    orderBy: { createdAt: 'desc' }, take: 12,
  });
  const poolDocs = ownDocs.length ? [] : await prisma.document.findMany({
    where: { subject: subject as any, level: level as any },
    orderBy: { createdAt: 'desc' }, take: 12,
  });
  const docs = [...ownDocs, ...poolDocs];
  const docsText = trim(docs.map((d,i) => `#Doc${i+1} (${d.filename})\n${(d.textContent || '').slice(0,2000)}`).join('\n\n'), 10_000);

  // 2) Student questions (recent)
  const recentQs = await prisma.interaction.findMany({
    where: { userEmail, subject: subject as any, AND: [{ prompt: { not: '' } }] },
    orderBy: { createdAt: 'desc' }, take: 15, select: { createdAt: true, prompt: true },
  });
  const questionsText = trim(recentQs.map((m,i) => `#Q${i+1} (${m.createdAt.toISOString()}):\n${(m.prompt || '').slice(0,600)}`).join('\n\n'), 5000);

  // 3) Cohort weak topics (last 14 days)
  let cohortWeakTopics: string[] = [];
  try {
    const recent = await prisma.quizAttempt.findMany({
      where: { subject: subject as any, createdAt: { gte: new Date(Date.now() - 1000*60*60*24*14) } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    const tally = new Map<string, number>();
    for (const a of recent) {
      const its = a.items as unknown as Item[];
      const resp = a.responses as unknown as Record<number, number>;
      its?.forEach((it,i) => { if (it?.topic && resp?.[i] !== it?.answerIndex) tally.set(it.topic, (tally.get(it.topic)||0)+1); });
    }
    cohortWeakTopics = [...tally.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
  } catch {}

  // 4) Global topics
  const global = GLOBAL_TOPICS[subject as keyof typeof GLOBAL_TOPICS]?.[level] || [];

  return { docs, docsText, questionsText, cohortWeakTopics, globalTopics: global };
}

export async function POST(req: NextRequest) {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subject, mode } = (await req.json()) as { subject: string; mode?: 'new' | 'focus' };

  // profile + base level
  const profile = await prisma.user.findUnique({ where: { email: user.email }, include: { subjectLvls: true } });
  const baseLevel = (profile?.subjectLvls.find(s => s.subject === subject)?.level || 'BEGINNER') as Level;

  // Adapt difficulty from last 3 attempts
  const attempts = await prisma.quizAttempt.findMany({
    where: { userEmail: user.email, subject: subject as any },
    orderBy: { createdAt: 'desc' }, take: 3,
  });
  let targetLevel: Level = baseLevel;
  if (attempts.length) {
    const avg = attempts.reduce((s,a)=>s + a.score/Math.max(1,a.maxScore), 0) / attempts.length;
    if (avg >= 0.8) targetLevel = bump(baseLevel, +1);
    else if (avg < 0.5) targetLevel = bump(baseLevel, -1);
  }

  // Weak topics from last attempt
  let weakTopics: string[] = [];
  if (attempts[0]) {
    try {
      const lastItems = attempts[0].items as unknown as Item[];
      const lastResp  = attempts[0].responses as unknown as Record<number, number>;
      const wrong = lastItems?.map((it,i)=>({ t: it?.topic || '', ok: lastResp?.[i] === it?.answerIndex }))
        .filter(x => !x.ok && x.t);
      const freq = new Map<string, number>();
      wrong?.forEach(x => freq.set(x.t, (freq.get(x.t)||0)+1));
      weakTopics = [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
    } catch {}
  }

  // Build multi-source context
  const { docs, docsText, questionsText, cohortWeakTopics, globalTopics } =
    await buildContext(user.email, subject, targetLevel);
  const hasDocs = docs.length > 0;

  const focus = mode === 'focus' && weakTopics.length > 0;
  const guidingTopics = focus ? weakTopics
    : (cohortWeakTopics.length ? cohortWeakTopics : globalTopics);

  // Prompt with variety & quality rules
  const contextInstruction = hasDocs
    ? `Use ONLY the "Documents" AND the student's "Questions". If a detail isn't in those, rely on general ${subject} knowledge to keep quality high.`
    : `No documents available. Use widely accepted ${subject} core syllabus for ${targetLevel} level.`;

  const topicInstruction = guidingTopics.length
    ? `Prioritise these topics (≥3 questions across them): ${guidingTopics.join(', ')}.`
    : `Cover 2–3 distinct core topics appropriate for ${targetLevel}.`;

  const qualityRules = [
    'Exactly 6 questions',
    'Each question has exactly 4 plausible options and 1 correct answer',
    'Mix recall + understanding + application (not all definition-only)',
    'Clear, one-paragraph explanation for each answer',
    'Vary topics; avoid duplicates',
  ].join('; ');

  const prompt = [
    `Create a high-quality multiple-choice quiz for Higher Education ${subject} at ${targetLevel} difficulty.`,
    contextInstruction,
    topicInstruction,
    `Quality rules: ${qualityRules}.`,
    `Respond as a SINGLE JSON object: { "items": [ { "question": string, "choices": [string,string,string,string], "answerIndex": 0|1|2|3, "explanation": string, "topic": string, "difficulty": "${targetLevel}" } ... ] }`,
    `No extra text, no code fences.`,
  ].join('\n');

  // Call LLM with JSON mode, with one retry if parse fails
  let items: Item[] = [];
  if (client) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are a strict quiz generator that returns valid JSON only.' },
            { role: 'user', content: `Documents:\n${docsText || '(none)'}` },
            { role: 'user', content: `Student Questions:\n${questionsText || '(none)'}` },
            { role: 'user', content: prompt },
          ],
        });
        const raw = completion?.choices?.[0]?.message?.content || '';
        const parsed = extractJson<{ items?: Item[] }>(raw);
        if (parsed?.items && Array.isArray(parsed.items) && parsed.items.length) {
          items = parsed.items;
          break;
        }
      } catch (e) {
        console.error('quiz LLM error attempt', attempt+1, e);
      }
    }
  }

  // Post-process and fallback to guarantee a good quiz
  if (!Array.isArray(items) || items.length === 0) {
    items = fallbackBank(subject, targetLevel);
  }
  items = exactSix(sanitize(items, targetLevel), targetLevel);

  return NextResponse.json({ available: true, items, weakTopics, targetLevel });
}



export async function PUT(req: NextRequest) {
  try {
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    if (!user?.email) {
      const r = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      r.headers.set('Cache-Control', 'no-store');
      return r;
    }

    const { subject, items, answers } = (await req.json()) as {
      subject: string;
      items: Item[];
      answers: Record<number, number>;
    };

    // basic validation
    if (!Array.isArray(items) || items.length === 0) {
      const r = NextResponse.json({ error: 'No items to grade' }, { status: 400 });
      r.headers.set('Cache-Control', 'no-store');
      return r;
    }

    // score
    const score = items.reduce(
      (acc, it, idx) => acc + (answers?.[idx] === it.answerIndex ? 1 : 0),
      0
    );
    const max = items.length;

    // persist attempt (assumes JSON columns for items/responses)
    await prisma.quizAttempt.create({
      data: {
        userEmail: user.email,
        subject: subject as any,
        items,
        responses: answers,
        score,
        maxScore: max,
      },
    });

    const r = NextResponse.json({ score, max });
    r.headers.set('Cache-Control', 'no-store');
    return r;
  } catch (e) {
    console.error('PUT /api/quiz/generate error:', e);
    const r = NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
    r.headers.set('Cache-Control', 'no-store');
    return r;
  }
}