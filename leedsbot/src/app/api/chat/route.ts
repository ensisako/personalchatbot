// src/app/api/chat/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { mentionsAssessedWork, ruleGuard } from '@/lib/academicGuard';
import { llmGuard } from '@/lib/academicClassifier';

const SUBJECTS = ['MATHS', 'MIDGE', 'DATABASE_SYSTEMS'] as const;
type Subject = typeof SUBJECTS[number];

type JsonReply = { answer: string; nextSteps?: string[]; ask?: string[] };

function trim(str: string, max = 8000) {
  return str.length <= max ? str : str.slice(0, max);
}
const m = (role: 'system' | 'user' | 'assistant', content: string): ChatCompletionMessageParam => ({ role, content });

function refusalMessage() {
  return `I can’t generate or complete assessed work for you.
But I can help you learn it:
• clarify the brief and marking criteria,
• co-create an outline or plan,
• explain concepts with examples,
• review your draft and give feedback,
• create practice questions.

Upload your notes or paste your draft, and I’ll help you improve it.`;
}
function refusalPayload() {
  return {
    blocked: true,
    policy: 'academic-integrity',
    message: refusalMessage(),
    alternatives: [
      { id: 'outline', label: 'Build an outline together' },
      { id: 'plan', label: 'Plan–Do–Review study plan' },
      { id: 'critique', label: 'Get feedback on YOUR draft (not mine)' },
      { id: 'explain', label: 'Explain the rubric & criteria' },
      { id: 'practice', label: 'Generate practice questions (not graded work)' },
    ],
  };
}

async function ensureUserAndLevel(email: string, subject: Subject) {
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      studentId: email,
      degree: 'BACHELORS',
    },
  });

  await prisma.userSubjectLevel.upsert({
    where: { userEmail_subject: { userEmail: email, subject } },
    update: {},
    create: { userEmail: email, subject, level: 'BEGINNER' },
  });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const client = apiKey?.trim() ? new OpenAI({ apiKey }) : null;

  try {
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    if (!user?.email) {
      const r = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      r.headers.set('Cache-Control', 'no-store');
      return r;
    }

    const body = await req.json();
    const raw = String(body.subject || 'MATHS').toUpperCase();
    const subject = (SUBJECTS.includes(raw as Subject) ? raw : 'MATHS') as Subject;

    const message = typeof body.message === 'string' ? body.message : '';
    const trimmedMsg = (message || '').trim();
    const init = !!body.init;
    const intake: Array<{ q: string; a: string }> | undefined = Array.isArray(body.intake) ? body.intake : undefined;

    // 🔒 Guard (only when there is a user message; allow intake/init)
    if (trimmedMsg) {
      // fast keyword guard
      const rule = ruleGuard(trimmedMsg);
      if (rule.blocked) {
        const r = NextResponse.json(refusalPayload());
        r.headers.set('Cache-Control', 'no-store');
        return r;
      }

      // run LLM guard only when it mentions assessed work
      if (mentionsAssessedWork(trimmedMsg) && client) {
        try {
          const llm = await llmGuard(trimmedMsg);
          if (llm.blocked) {
            const r = NextResponse.json(refusalPayload());
            r.headers.set('Cache-Control', 'no-store');
            return r;
          }
        } catch { /* ignore and continue */ }
      }
    }

    // --- FAQ short-circuits for simple questions (before DB/LLM work) ---
    if (trimmedMsg) {
      const faqs: Array<{ test: (s: string) => boolean; payload: JsonReply }> = [
        {
          test: (s) => /^\s*what\s+is\s+sql\??\s*$/i.test(s),
          payload: {
            answer:
              'SQL stands for Structured Query Language. It is the standard language for relational databases—used to define tables (DDL), query data (SELECT), modify data (INSERT/UPDATE/DELETE), and control transactions & permissions.',
            nextSteps: [
              'Run a simple SELECT on a demo table',
              'Filter with WHERE and sort with ORDER BY',
              'Join two tables with an INNER JOIN',
            ],
            ask: [
              'Which database are you using (MySQL, Postgres, SQL Server, Oracle)?',
              'Do you prefer worked examples or compact theory?',
            ],
          },
        },
        {
          test: (s) => /\b(how|what)\b.*\b(insert(ing)? data|insert into)\b/i.test(s),
          payload: {
            answer:
              'INSERT adds new rows. Basic form: `INSERT INTO table_name (col1, col2) VALUES (val1, val2);`. You can insert multiple rows, or insert from a SELECT.',
            nextSteps: [
              'Create a tiny table and insert 2 rows',
              'Insert multiple rows with one statement',
              'Insert-from-select to copy rows from another table',
            ],
            ask: [
              'Want examples for your specific database?',
              'Do you have a table schema I can use for the demo?',
            ],
          },
        },
        {
          test: (s) => /^\s*what\s+is\s+(a\s+)?primary\s+key\??\s*$/i.test(s),
          payload: {
            answer:
              'A primary key uniquely identifies each row in a table. It is unique and not null, often implemented as an ID column.',
            nextSteps: [
              'Create a table with an ID PRIMARY KEY',
              'Insert two rows and try inserting a duplicate ID to see the error',
            ],
            ask: ['Want me to show the syntax for your database?'],
          },
        },
        {
          test: (s) => /^\s*what\s+is\s+(a\s+)?foreign\s+key\??\s*$/i.test(s),
          payload: {
            answer:
              'A foreign key enforces a relationship from one table to another by referencing the other table’s primary key, maintaining referential integrity.',
            nextSteps: [
              'Create two tables (parent and child) with a foreign key',
              'Try inserting a child row that references a non-existent parent to see the constraint',
            ],
            ask: ['Should I target MySQL, Postgres, SQL Server, or Oracle?'],
          },
        },
      ];

      const hit = faqs.find((f) => f.test(trimmedMsg));
      if (hit) {
        const r = NextResponse.json(hit.payload);
        r.headers.set('Cache-Control', 'no-store');
        return r;
      }
    }

    // Ensure user + baseline level records
    await ensureUserAndLevel(user.email, subject);

    // Profile (for level + degree)
    const profile = await prisma.user.findUnique({
      where: { email: user.email },
      include: { subjectLvls: true },
    });
    const level = profile?.subjectLvls.find((s) => s.subject === subject)?.level ?? 'BEGINNER';
    const degree = profile?.degree ?? 'BACHELORS';

    // Documents (prefer own uploads; fallback to pool)
    const ownDocs = await prisma.document.findMany({
      where: { ownerEmail: user.email, subject: subject as any, level: level as any },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const poolDocs =
      ownDocs.length > 0
        ? []
        : await prisma.document.findMany({
            where: { subject: subject as any, level: level as any },
            orderBy: { createdAt: 'desc' },
            take: 12,
          });

    const docs = [...ownDocs, ...poolDocs];
    const usedDocIds = docs.map((d) => d.id);
    const hasDocs = docs.length > 0;
    const docsText = trim(
      docs.map((d, i) => `#Doc${i + 1} (${d.filename})\n${(d.textContent || '').slice(0, 2000)}`).join('\n\n'),
      10_000
    );

    // INIT: ask intake questions (tailored to docs if available)
    if (init) {
      if (client && docs.length) {
        try {
          const sys =
            `You create 4-5 short intake questions tailored to ${subject} at ${level} level, ` +
            `based ONLY on the document snippets below. Return JSON: { "ask": string[] } and nothing else.`;
          const c = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            messages: [m('system', sys), m('user', `Documents:\n${docsText}`)],
          });
          const raw = c.choices[0]?.message?.content?.trim() || '';
          try {
            const json = JSON.parse(raw) as { ask?: string[] };
            if (json.ask && json.ask.length) {
              const r = NextResponse.json({ ask: json.ask.slice(0, 6) });
              r.headers.set('Cache-Control', 'no-store');
              return r;
            }
          } catch { /* fall through */ }
        } catch { /* fall through */ }
      }

      const r = NextResponse.json({
        ask: [
          `Which topics in ${subject.replace('_', ' ')} are you working on now?`,
          'What’s your immediate goal (exam, assignment, concept mastery)?',
          'Where do you feel least confident?',
          'Do you prefer worked examples or compact theory?',
          'Any deadlines?',
        ],
      });
      r.headers.set('Cache-Control', 'no-store');
      return r;
    }

    // OPTIONAL: persist intake summary into goals
    if (intake?.length) {
      const goalsSummary =
        'Goal: ' +
        (intake.find((x) => /goal/i.test(x.q))?.a || '') +
        ' | Topics: ' +
        (intake.find((x) => /topics?/i.test(x.q))?.a || '') +
        ' | Weakness: ' +
        (intake.find((x) => /(least confident|weak|struggl)/i.test(x.q))?.a || '');
      await prisma.user.update({
        where: { email: user.email },
        data: { goals: goalsSummary.slice(0, 1000) },
      });
    }

    // Short conversation history for multi-turn coherence
    const historyRaw = await prisma.interaction.findMany({
      where: { userEmail: user.email, subject: subject as any, level: level as any },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    const history = historyRaw.reverse();

    // For short generic questions, ignore history to avoid derailment
    const isGeneric = trimmedMsg.length > 0 && trimmedMsg.length <= 30;
    const historyMessages: ChatCompletionMessageParam[] = isGeneric
      ? []
      : history.flatMap<ChatCompletionMessageParam>((h) => [m('user', h.prompt), m('assistant', h.answer ?? '')]);

    // Compose tutoring prompt
    const sys = [
      `You are LeedsBot, a concise HE tutor for ${subject} at ${level} level (degree: ${degree}).`,
      hasDocs
        ? `Use ONLY the "Documents" plus the student's current question and the brief chat history. If documents do not cover the question, say "Insufficient context from uploaded notes." and ask for the missing file/detail.`
        : `There are no uploaded documents. Use widely accepted core syllabus knowledge for ${subject} at ${level}. DO NOT say "insufficient context" when there are no documents.`,
      `Return ONLY JSON -> { "answer": string, "nextSteps": string[], "ask"?: string[] }`,
      `Style: step-by-step, brief, practical. End with 3–6 actionable nextSteps. Include 2–4 probing follow-up questions in "ask" when helpful.`,
    ].join(' ');

    const currentUserMsg = [
      `Documents:\n${docsText || '(none found for this subject/level)'}\n`,
      trimmedMsg ? `Question:\n${trimmedMsg}` : 'No direct question; give a short study plan based on intake + docs.',
    ].join('\n\n');

    // No key → deterministic fallback (still helpful)
    if (!client) {
      const fallback: JsonReply = {
        answer:
          'Model unavailable. Based on your notes, focus on: definitions → 2 practice problems → self-explanation. Upload more targeted notes if context is insufficient.',
        nextSteps: [
          'Skim your notes and extract 3 key points.',
          'Solve 2 related practice questions.',
          'Write a 3-bullet summary and one worked example.',
        ],
        ask: ['Which topic should we zoom into first?', 'Do you prefer examples or theory?'],
      };
      const r = NextResponse.json(fallback);
      r.headers.set('Cache-Control', 'no-store');
      return r;
    }

    // Call OpenAI
    let answer = 'Here is a brief explanation.';
    let nextSteps: string[] | undefined;
    let askBack: string[] | undefined;

    try {
      const messages: ChatCompletionMessageParam[] = [
        m('system', sys),
        ...historyMessages,
        m('user', currentUserMsg),
      ];

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages,
      });

      const rawOut = completion.choices[0]?.message?.content?.trim() || '';
      try {
        const json = JSON.parse(rawOut) as { answer?: string; nextSteps?: string[]; ask?: string[] };
        answer = json.answer || answer;
        nextSteps = Array.isArray(json.nextSteps) ? json.nextSteps.slice(0, 8) : undefined;
        askBack = Array.isArray(json.ask) ? json.ask.slice(0, 5) : undefined;
      } catch {
        // Non-JSON fallback
        answer = rawOut || answer;
        nextSteps =
          nextSteps ?? ['Review key definitions', 'Try 2 practice problems', 'Summarise one concept in your own words'];
      }
    } catch {
      answer =
        'AI quota hit. Quick plan: focus on key terms, a worked example, and 2 practice questions. Upload specific notes to tailor further.';
      nextSteps = ['Extract 3 key ideas', 'Solve 2 problems', 'Write a brief summary'];
    }

    // Gentle nudge to upload docs if none exist
    if (!hasDocs && Array.isArray(nextSteps)) {
      nextSteps.push('Upload class notes or slides so I can tailor explanations to your course.');
    }

    // Log interaction (don’t crash on failure)
    try {
      await prisma.interaction.create({
        data: {
          userEmail: user.email,
          subject: subject as any,
          level: level as any,
          prompt: (trimmedMsg || '[intake/plan]').slice(0, 8000),
          answer: (answer || '').slice(0, 8000),
          usedDocIds,
        },
      });
    } catch (e) {
      console.error('interaction log failed:', e);
    }

    const r = NextResponse.json({ answer, nextSteps, ask: askBack });
    r.headers.set('Cache-Control', 'no-store');
    return r;
  } catch (e) {
    console.error(e);
    const r = NextResponse.json({ error: 'Chat failed' }, { status: 500 });
    r.headers.set('Cache-Control', 'no-store');
    return r;
  }
}
